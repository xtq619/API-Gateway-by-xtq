import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_news import AiNews

logger = logging.getLogger(__name__)

# Beijing time (UTC+8)
_BJ = timezone(timedelta(hours=8))


async def compile_daily_digest(db: AsyncSession) -> str | None:
    """Compile today's news into a digest. Returns Markdown string or None if no news.

    Content is already translated to Chinese at fetch time, so no LLM call needed here.
    Uses Beijing time to determine "today".
    """
    now = datetime.now(_BJ)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_start = today_start + timedelta(days=1)

    result = await db.execute(
        select(AiNews)
        .where(
            AiNews.created_at >= today_start,
            AiNews.created_at < tomorrow_start,
            AiNews.is_published == True,
            AiNews.is_sensitive == False,
        )
        .order_by(AiNews.created_at.desc())
    )
    news_items = result.scalars().all()

    if not news_items:
        logger.info("No news today, skipping digest")
        return None

    today = now.strftime("%Y-%m-%d")
    lines = [f"# 今日速递 — {today}\n"]
    lines.append(f"今天共 **{len(news_items)}** 条军事新闻：\n")

    for i, item in enumerate(news_items, 1):
        link = f"[原文链接]({item.source_url})" if item.source_url else ""
        content = item.content or item.summary or ""

        lines.append(f"### {i}. {item.title}")
        lines.append(f"- **来源**：{item.source_name} | {link}")
        lines.append("")
        lines.append(content[:3000])
        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)
