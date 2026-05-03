import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_admin
from app.schemas.feedback import FeedbackList, FeedbackReply, FeedbackResponse
from app.services import feedback_service

router = APIRouter(prefix="/admin/feedback", tags=["admin-feedback"])


@router.get("", response_model=FeedbackList)
async def list_all_feedback(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0),
    user=Depends(require_admin),
):
    items, total = await feedback_service.list_all_feedback(db, limit, offset)
    return FeedbackList(
        items=[FeedbackResponse(
            id=fb.id, content=fb.content, category=fb.category,
            status=fb.status, reply=fb.reply, replied_at=fb.replied_at,
            created_at=fb.created_at,
        ) for fb in items],
        total=total,
    )


@router.patch("/{feedback_id}/reply", response_model=FeedbackResponse)
async def reply_feedback(
    feedback_id: str,
    req: FeedbackReply,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_admin),
):
    fb = await feedback_service.get_feedback_by_id(db, uuid.UUID(feedback_id))
    if not fb:
        raise HTTPException(status_code=404, detail="留言不存在")
    fb = await feedback_service.reply_feedback(db, fb, req.reply)
    return FeedbackResponse(
        id=fb.id, content=fb.content, category=fb.category,
        status=fb.status, reply=fb.reply, replied_at=fb.replied_at,
        created_at=fb.created_at,
    )
