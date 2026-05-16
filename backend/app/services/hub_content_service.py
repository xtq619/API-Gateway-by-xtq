from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hub_content import HubContent


async def get_content(db: AsyncSession, key: str) -> HubContent | None:
    result = await db.execute(select(HubContent).where(HubContent.key == key))
    return result.scalar_one_or_none()


async def get_all(db: AsyncSession) -> list[HubContent]:
    result = await db.execute(select(HubContent).order_by(HubContent.key))
    return list(result.scalars().all())


async def upsert(db: AsyncSession, key: str, title: str | None = None, content: str | None = None) -> HubContent:
    item = await get_content(db, key)
    if not item:
        item = HubContent(key=key, title=title or "", content=content or "")
        db.add(item)
    else:
        if title is not None:
            item.title = title
        if content is not None:
            item.content = content
    await db.commit()
    await db.refresh(item)
    return item
