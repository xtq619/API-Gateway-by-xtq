from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.ai_news import NewsList, NewsResponse
from app.services import ai_news_service

router = APIRouter(prefix="/news", tags=["public-news"])


@router.get("", response_model=NewsList)
async def list_news(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, le=50),
    offset: int = Query(default=0),
    category: str | None = Query(default=None),
):
    items, total = await ai_news_service.list_published(db, limit, offset, category)
    return NewsList(
        items=[NewsResponse.model_validate(n) for n in items],
        total=total,
    )
