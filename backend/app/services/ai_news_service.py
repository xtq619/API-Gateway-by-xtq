import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_news import AiNews


async def list_published(db: AsyncSession, limit: int, offset: int, category: str | None) -> tuple[list[AiNews], int]:
    q = select(AiNews).where(AiNews.is_published == True, AiNews.is_sensitive == False)
    count_q = select(func.count(AiNews.id)).where(AiNews.is_published == True, AiNews.is_sensitive == False)

    if category:
        q = q.where(AiNews.category == category)
        count_q = count_q.where(AiNews.category == category)

    total = (await db.execute(count_q)).scalar() or 0

    items = list((await db.execute(
        q.order_by(AiNews.created_at.desc()).limit(limit).offset(offset)
    )).scalars().all())
    return items, total


async def list_all(db: AsyncSession, limit: int, offset: int, published_only: bool = False) -> tuple[list[AiNews], int]:
    q = select(AiNews)
    count_q = select(func.count(AiNews.id))
    if published_only:
        q = q.where(AiNews.is_published == True)
        count_q = count_q.where(AiNews.is_published == True)

    total = (await db.execute(count_q)).scalar() or 0

    items = list((await db.execute(
        q.order_by(AiNews.created_at.desc()).limit(limit).offset(offset)
    )).scalars().all())
    return items, total


async def get_by_id(db: AsyncSession, news_id: uuid.UUID) -> AiNews | None:
    result = await db.execute(select(AiNews).where(AiNews.id == news_id))
    return result.scalar_one_or_none()


async def create_news(db: AsyncSession, **kwargs) -> AiNews:
    n = AiNews(**kwargs)
    db.add(n)
    await db.commit()
    await db.refresh(n)
    return n


async def update_news(db: AsyncSession, n: AiNews, data: dict) -> AiNews:
    for k, v in data.items():
        if v is not None:
            setattr(n, k, v)
    await db.commit()
    await db.refresh(n)
    return n


async def delete_news(db: AsyncSession, n: AiNews) -> None:
    await db.delete(n)
    await db.commit()


async def fetch_and_summarize(db: AsyncSession, total_count: int = 10) -> dict:
    """Trigger auto-fetch pipeline: RSS → AI summarize → save."""
    from app.services.news_fetcher import auto_fetch_news
    return await auto_fetch_news(db, total_count=total_count)
