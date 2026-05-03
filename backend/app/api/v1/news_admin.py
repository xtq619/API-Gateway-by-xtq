import uuid
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, async_session
from app.core.dependencies import require_admin
from app.schemas.ai_news import NewsCreate, NewsList, NewsResponse, NewsUpdate
from app.services import ai_news_service
from app.services.news_fetcher import RSS_SOURCES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/news", tags=["admin-news"])


_auto_fetch_running = False


async def _run_auto_fetch():
    """Background task wrapper for auto-fetch."""
    global _auto_fetch_running
    try:
        async with async_session() as db:
            await ai_news_service.fetch_and_summarize(db)
    except Exception:
        logger.exception("Auto-fetch background task failed")
    finally:
        _auto_fetch_running = False


@router.post("/auto-fetch")
async def trigger_auto_fetch(
    background_tasks: BackgroundTasks,
    user=Depends(require_admin),
):
    """Trigger AI news auto-fetch in the background."""
    global _auto_fetch_running
    if _auto_fetch_running:
        return {"message": "抓取任务已在运行中", "status": "running"}

    _auto_fetch_running = True
    background_tasks.add_task(_run_auto_fetch)
    return {"message": "已开始自动抓取 AI 资讯", "status": "started"}


@router.get("/auto-fetch/sources")
async def list_rss_sources(user=Depends(require_admin)):
    """List built-in RSS sources."""
    return {"sources": RSS_SOURCES}


@router.get("", response_model=NewsList)
async def list_all_news(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0),
    published_only: bool = Query(default=False),
    user=Depends(require_admin),
):
    items, total = await ai_news_service.list_all(db, limit, offset, published_only)
    return NewsList(
        items=[NewsResponse.model_validate(n) for n in items],
        total=total,
    )


@router.post("", response_model=NewsResponse)
async def create_news(
    req: NewsCreate,
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    n = await ai_news_service.create_news(
        db,
        title=req.title,
        summary=req.summary,
        content=req.content,
        category=req.category,
        source_name=req.source_name,
        source_url=req.source_url,
        is_published=req.is_published,
    )
    return NewsResponse.model_validate(n)


@router.get("/{news_id}", response_model=NewsResponse)
async def get_news(
    news_id: str,
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    n = await ai_news_service.get_by_id(db, uuid.UUID(news_id))
    if not n:
        raise HTTPException(status_code=404, detail="不存在")
    return NewsResponse.model_validate(n)


@router.patch("/{news_id}", response_model=NewsResponse)
async def update_news(
    news_id: str,
    req: NewsUpdate,
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    n = await ai_news_service.get_by_id(db, uuid.UUID(news_id))
    if not n:
        raise HTTPException(status_code=404, detail="不存在")
    n = await ai_news_service.update_news(db, n, req.model_dump(exclude_unset=True))
    return NewsResponse.model_validate(n)


@router.delete("/{news_id}", status_code=204)
async def delete_news(
    news_id: str,
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    n = await ai_news_service.get_by_id(db, uuid.UUID(news_id))
    if not n:
        raise HTTPException(status_code=404, detail="不存在")
    await ai_news_service.delete_news(db, n)
    return None
