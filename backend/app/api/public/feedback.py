from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.feedback import FeedbackList, FeedbackResponse
from app.services import feedback_service

router = APIRouter(prefix="/feedback", tags=["public-feedback"])


@router.get("", response_model=FeedbackList)
async def list_public_feedback(
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
