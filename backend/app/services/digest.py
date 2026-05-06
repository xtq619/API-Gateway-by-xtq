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
        content_snippet = content[:800] if content else ""
        lines.append(
            f"--- 第{i}条 ---\n"
            f"原标题：{n['title']}\n"
            f"来源：{n['source_name']}\n"
            f"链接：{n['source_url']}\n"
            f"原文摘要：\n{content_snippet}"
        )

    articles_text = "\n\n".join(lines)

    return f"""你是军事新闻翻译专家。请将以下 {len(news_list)} 条英文军事新闻翻译为中文。

【严格要求】
1. 所有输出必须是中文，绝对禁止输出英文
2. 标题翻译为中文标题
3. 正文：根据原文内容，用中文撰写 150-300 字的详细摘要，保留关键数据、装备名称、人物
4. 每条格式：
   ### 中文标题
   - **来源**：来源名 | [原文链接](URL)
   - **正文**：中文详细摘要

英文新闻：
{articles_text}

请全部用中文输出："""


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

    api_key = decrypt_api_key(model.api_key_encrypted)
    today = now.strftime("%Y-%m-%d")

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0)) as client:
            # Translate each article individually
            translated_parts = []
            for i, n in enumerate(news_dicts, 1):
                content = n.get("content") or n["summary"]
                content_snippet = content[:4000] if content else ""

                prompt = f"""你是一个翻译机器人。你的唯一任务是把下面的英文文章翻译成中文。禁止输出任何英文字符。

英文原文：
{content_snippet}

翻译要求：
- 保留所有人名、地名、装备型号、数字数据
- 不要省略内容，尽量完整翻译
- 输出纯中文翻译结果，不要加任何英文原文
- 不要加标题、来源等前缀，只输出翻译正文"""

                try:
                    resp = await client.post(
                        f"{model.base_url.rstrip('/')}/chat/completions",
                        json={
                            "model": model.model_name,
                            "messages": [{"role": "user", "content": prompt}],
                            "max_tokens": 2000,
                            "temperature": 0.3,
                        },
                        headers={"Authorization": f"Bearer {api_key}"},
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    text = data["choices"][0]["message"]["content"].strip()
                    if text:
                        # Strip any English that leaked through (first 500+ chars of pure ASCII = likely English)
                        translated_parts.append(
                            f"### {n['title']}\n"
                            f"- **来源**：{n['source_name']} | [原文链接]({n['source_url']})\n\n"
                            f"{text}"
                        )
                except Exception as e:
                    logger.warning("Translation failed for article %d: %s", i, e)
                    translated_parts.append(
                        f"### {n['title']}\n"
                        f"- **来源**：{n['source_name']} | [原文链接]({n['source_url']})\n"
                        f"- **摘要**：{n['summary']}"
                    )

            if not translated_parts:
                return _build_fallback_digest(news_dicts)

            header = f"# 军事日报 — {today}\n\n今天共 **{len(news_dicts)}** 条军事新闻：\n\n"
            return header + "\n\n---\n\n".join(translated_parts)

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
        lines.append(f"### {i}. {n['title']}")
        lines.append(f"- **来源**：{n['source_name']} | {link}")
        lines.append(f"- **摘要**：{n['summary']}")
        lines.append("")

    return "\n".join(lines)
