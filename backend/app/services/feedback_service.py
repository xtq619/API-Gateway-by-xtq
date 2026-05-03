import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.feedback import Feedback


async def create_feedback(db: AsyncSession, user_id: uuid.UUID, content: str, category: str) -> Feedback:
    fb = Feedback(user_id=user_id, content=content, category=category)
    db.add(fb)
    await db.commit()
    await db.refresh(fb)
    return fb


async def list_user_feedback(db: AsyncSession, user_id: uuid.UUID, limit: int, offset: int) -> tuple[list[Feedback], int]:
    total_q = select(func.count(Feedback.id)).where(Feedback.user_id == user_id)
    total = (await db.execute(total_q)).scalar() or 0

    q = (
        select(Feedback)
        .where(Feedback.user_id == user_id)
        .order_by(Feedback.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = list((await db.execute(q)).scalars().all())
    return items, total


async def get_feedback_by_id(db: AsyncSession, feedback_id: uuid.UUID) -> Feedback | None:
    result = await db.execute(select(Feedback).where(Feedback.id == feedback_id))
    return result.scalar_one_or_none()


async def delete_feedback(db: AsyncSession, fb: Feedback) -> None:
    await db.delete(fb)
    await db.commit()


async def reply_feedback(db: AsyncSession, fb: Feedback, reply: str) -> Feedback:
    from datetime import datetime, timezone
    fb.reply = reply
    fb.status = "reviewed"
    fb.replied_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(fb)
    return fb


async def list_all_feedback(db: AsyncSession, limit: int, offset: int) -> tuple[list[Feedback], int]:
    total = (await db.execute(select(func.count(Feedback.id)))).scalar() or 0

    q = (
        select(Feedback)
        .options(selectinload(Feedback.user))
        .order_by(Feedback.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = list((await db.execute(q)).scalars().all())
    return items, total
