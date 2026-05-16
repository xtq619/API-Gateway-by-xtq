from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_admin
from app.models.user import User
from app.services import hub_content_service

router = APIRouter(prefix="/admin/hub", tags=["admin-hub"])


class HubContentUpdate(BaseModel):
    title: str | None = None
    content: str | None = None


@router.get("/content")
async def get_hub_content_admin(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    items = await hub_content_service.get_all(db)
    return [{"key": item.key, "title": item.title, "content": item.content} for item in items]


@router.put("/content/{key}")
async def update_hub_content(
    key: str,
    req: HubContentUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    item = await hub_content_service.upsert(db, key, title=req.title, content=req.content)
    return {"key": item.key, "title": item.title, "content": item.content}
