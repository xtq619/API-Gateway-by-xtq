from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.news_setting import NewsSetting


async def get_settings(db: AsyncSession) -> NewsSetting:
    """Get news settings. Creates default row if none exists."""
    result = await db.execute(select(NewsSetting).limit(1))
    settings = result.scalar_one_or_none()
    if settings:
        return settings

    settings = NewsSetting(fetch_count=10, fetch_hour=8, fetch_minute=0)
    db.add(settings)
    await db.commit()
    await db.refresh(settings)
    return settings


async def update_settings(db: AsyncSession, **kwargs) -> NewsSetting:
    settings = await get_settings(db)
    for k, v in kwargs.items():
        if v is not None and hasattr(settings, k):
            setattr(settings, k, v)
    await db.commit()
    await db.refresh(settings)
    return settings
