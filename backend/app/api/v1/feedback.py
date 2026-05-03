import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.models.user import User
from app.schemas.feedback import FeedbackCreate, FeedbackList, FeedbackResponse
from app.services import feedback_service

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", response_model=FeedbackResponse)
async def create_feedback(
    req: FeedbackCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    fb = await feedback_service.create_feedback(db, uuid.UUID(user_id), req.content, req.category)
    return FeedbackResponse(
        id=fb.id, content=fb.content, category=fb.category,
        status=fb.status, created_at=fb.created_at,
    )


@router.get("", response_model=FeedbackList)
async def list_all_feedback(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0),
):
    items, total = await feedback_service.list_all_feedback(db, limit, offset)
    return FeedbackList(
        items=[FeedbackResponse(
            id=fb.id, content=fb.content, category=fb.category,
            status=fb.status, reply=fb.reply, replied_at=fb.replied_at,
            created_at=fb.created_at,
            user_name=fb.user.name if fb.user else None,
        ) for fb in items],
        total=total,
    )


@router.delete("/{feedback_id}", status_code=204)
async def delete_feedback(
    feedback_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    fb = await feedback_service.get_feedback_by_id(db, uuid.UUID(feedback_id))
    if not fb:
        raise HTTPException(status_code=404, detail="留言不存在")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    is_admin = user and user.role == "admin"

    if str(fb.user_id) != user_id and not is_admin:
        raise HTTPException(status_code=403, detail="无权删除此留言")

    await feedback_service.delete_feedback(db, fb)
    return None
