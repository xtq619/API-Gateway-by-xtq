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
        content = n.get("content") or n["summary"]
        content_snippet = content[:1500] if content else ""
        lines.append(
            f"{i}. [{n['category']}] {n['title']}\n"
            f"   原文：{content_snippet}\n"
            f"   来源：{n['source_name']} | 链接：{n['source_url']}"
        )

    articles_text = "\n".join(lines)

    return f"""你是一位专业的军事新闻编辑。以下是今天抓取到的 {len(news_list)} 条国外军事新闻，请逐条翻译为中文并输出完整内容。

要求：
1. 每条新闻单独输出，格式：
   ### 序号. 中文标题
   - **来源**：来源名称 | [原文链接](链接)
   - **正文**：将原文完整翻译为中文，保留关键细节、数据、人名、装备名称等
2. 翻译要准确流畅，军事术语使用国内常用译法
3. 如果原文较长，可以适当精简但不要丢失核心信息
4. 全部用中文输出

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
            "content": item.content,
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
    lines = [f"# 军事日报 — {today}\n"]
    lines.append(f"今天共抓取 **{len(news_list)}** 条军事新闻：\n")

    for i, n in enumerate(news_list, 1):
        link = f"[原文链接]({n['source_url']})" if n.get("source_url") else ""
        content = n.get("content") or n["summary"]
        lines.append(f"### {i}. {n['title']}")
        lines.append(f"- **来源**：{n['source_name']} | {link}")
        lines.append(f"- **摘要**：{content[:300]}")
        lines.append("")

    return "\n".join(lines)
