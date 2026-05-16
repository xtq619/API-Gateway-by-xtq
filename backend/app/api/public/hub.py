from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services import hub_content_service

router = APIRouter(prefix="/hub", tags=["public-hub"])


@router.get("/content")
async def get_hub_content(db: AsyncSession = Depends(get_db)):
    items = await hub_content_service.get_all(db)
    return {item.key: {"title": item.title, "content": item.content} for item in items}
