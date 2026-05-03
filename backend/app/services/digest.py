import json
import logging
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_news import AiNews
from app.services.news_fetcher import get_first_enabled_model, summarize_with_ai
from app.core.security import decrypt_api_key

logger = logging.getLogger(__name__)


def _build_digest_prompt(news_list: list[dict]) -> str:
    lines = []
    for i, n in enumerate(news_list, 1):
        lines.append(f"{i}. [{n['category']}] {n['title']}\n   摘要：{n['summary']}\n   来源：{n['source_name']}")

    articles_text = "\n".join(lines)

    return f"""你是一位专业的 AI 行业分析师。以下是今天抓取到的 {len(news_list)} 条 AI 新闻，请为我编写一份简洁有力的每日摘要日报。

要求：
1. 用 3-5 句话总结今天 AI 领域的整体动态和趋势
2. 按重要程度选出 Top 5 新闻，每条用：**标题** + 一句话核心内容 + 链接
3. 最后给出一段「今日观察」：对行业的简单点评或值得关注的方向
4. 全部用中文，保持简洁专业

新闻列表：
{articles_text}

请用 Markdown 格式输出，适合邮件阅读。"""


async def compile_daily_digest(db: AsyncSession) -> str | None:
    """Compile today's news into a digest. Returns Markdown string or None if no news."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(AiNews)
        .where(AiNews.created_at >= today_start, AiNews.is_published == True)
        .order_by(AiNews.created_at.desc())
    )
    news_items = result.scalars().all()

    if not news_items:
        logger.info("No news today, skipping digest")
        return None

    news_dicts = [
        {
            "title": item.title,
            "summary": item.summary,
            "category": item.category,
            "source_name": item.source_name,
            "source_url": item.source_url,
        }
        for item in news_items
    ]

    model = await get_first_enabled_model(db)
    if not model:
        logger.error("No enabled model for digest compilation")
        return _build_fallback_digest(news_dicts)

    prompt = _build_digest_prompt(news_dicts)
    api_key = decrypt_api_key(model.api_key_encrypted)

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0)) as client:
            resp = await client.post(
                f"{model.base_url.rstrip('/')}/chat/completions",
                json={
                    "model": model.model_name,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 2000,
                    "temperature": 0.5,
                },
                headers={"Authorization": f"Bearer {api_key}"},
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"].strip()
            return content
    except Exception as e:
        logger.error("Digest compilation failed: %s", e)
        return _build_fallback_digest(news_dicts)


def _build_fallback_digest(news_list: list[dict]) -> str:
    """Build a simple digest without LLM when model is unavailable."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    lines = [f"# AI 日报 — {today}\n"]
    lines.append(f"今天共抓取 **{len(news_list)}** 条 AI 新闻：\n")

    for i, n in enumerate(news_list, 1):
        link = f"[链接]({n['source_url']})" if n.get("source_url") else ""
        lines.append(f"{i}. **[{n['category']}] {n['title']}** — {n['summary'][:80]}... {link}")

    return "\n".join(lines)
