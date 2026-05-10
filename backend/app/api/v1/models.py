from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.model_registry import ModelRegistry
from app.schemas.model import ModelResponse

router = APIRouter(prefix="/models", tags=["models"])


@router.get("", response_model=list[ModelResponse])
async def list_models(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ModelRegistry).where(ModelRegistry.is_enabled == True).order_by(ModelRegistry.provider)
    )
    return result.scalars().all()
