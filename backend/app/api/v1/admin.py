from fastapi import APIRouter, Depends, HTTPException, Query

from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_admin
from app.core.security import decrypt_api_key, encrypt_api_key
from app.models.model_registry import ModelRegistry
from app.models.user import User
from app.models.usage_log import UsageLog
from app.models.api_key import ApiKey, api_key_models
from app.models.billing import BillingAccount, BillingTransaction
from app.models.feedback import Feedback
from app.schemas.model import ModelAdminCreate, ModelAdminResponse, ModelAdminUpdate, ModelResponse
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0),
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()).offset(offset).limit(limit))
    return result.scalars().all()


@router.post("/models", response_model=ModelResponse)
async def add_model(
    req: ModelAdminCreate,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    model = ModelRegistry(
        provider=req.provider,
        model_name=req.model_name,
        display_name=req.display_name,
        base_url=req.base_url,
        api_key_encrypted=encrypt_api_key(req.api_key),
        pricing_input=req.pricing_input,
        pricing_output=req.pricing_output,
        max_tokens_limit=req.max_tokens_limit,
    )
    db.add(model)
    try:
        await db.flush()
        await db.refresh(model)
    except IntegrityError:
        raise HTTPException(status_code=409, detail={"code": "DUPLICATE_MODEL", "message": f"模型 {req.model_name} 已存在"})
    return model


@router.get("/models/{model_id}", response_model=ModelAdminResponse)
async def get_model(model_id: str, admin=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """Get model detail including decrypted API key (admin only)."""
    from uuid import UUID
    result = await db.execute(select(ModelRegistry).where(ModelRegistry.id == UUID(model_id)))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="模型未找到")
    return ModelAdminResponse(
        id=model.id,
        provider=model.provider,
        model_name=model.model_name,
        display_name=model.display_name,
        base_url=model.base_url,
        api_key=decrypt_api_key(model.api_key_encrypted),
        is_enabled=model.is_enabled,
        pricing_input=float(model.pricing_input),
        pricing_output=float(model.pricing_output),
        max_tokens_limit=model.max_tokens_limit,
    )


@router.patch("/models/{model_id}/toggle")
async def toggle_model(model_id: str, admin=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    from uuid import UUID
    result = await db.execute(select(ModelRegistry).where(ModelRegistry.id == UUID(model_id)))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="模型未找到")
    model.is_enabled = not model.is_enabled
    await db.flush()
    return {"detail": "ok", "is_enabled": model.is_enabled}


@router.patch("/models/{model_id}", response_model=ModelResponse)
async def update_model(
    model_id: str,
    req: ModelAdminUpdate,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from uuid import UUID
    result = await db.execute(select(ModelRegistry).where(ModelRegistry.id == UUID(model_id)))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="模型未找到")

    updates = req.model_dump(exclude_unset=True)
    if "api_key" in updates:
        updates["api_key_encrypted"] = encrypt_api_key(updates.pop("api_key"))

    for field, value in updates.items():
        setattr(model, field, value)

    try:
        await db.flush()
        await db.refresh(model)
    except IntegrityError:
        raise HTTPException(status_code=409, detail={"code": "DUPLICATE_MODEL", "message": f"模型名已存在"})
    return model


@router.delete("/models/{model_id}")
async def delete_model(model_id: str, admin=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    from uuid import UUID
    result = await db.execute(select(ModelRegistry).where(ModelRegistry.id == UUID(model_id)))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="模型未找到")
    usage_count = (await db.execute(
        select(func.count()).select_from(UsageLog).where(UsageLog.model_id == model.id)
    )).scalar()
    if usage_count > 0:
        raise HTTPException(status_code=409, detail="该模型有关联的使用记录，无法删除")
    await db.delete(model)
    await db.flush()
    return {"detail": "模型已删除"}


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from uuid import UUID
    uid = UUID(user_id)
    if str(admin.id) == user_id:
        raise HTTPException(status_code=400, detail="不能删除自己")

    user = await db.get(User, uid)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # Delete related records
    for fk in [BillingTransaction, UsageLog, Feedback]:
        await db.execute(fk.__table__.delete().where(fk.user_id == uid))

    keys = (await db.execute(select(ApiKey).where(ApiKey.user_id == uid))).scalars().all()
    for key in keys:
        await db.execute(api_key_models.delete().where(api_key_models.c.api_key_id == key.id))
        await db.delete(key)

    billing = (await db.execute(select(BillingAccount).where(BillingAccount.user_id == uid))).scalar_one_or_none()
    if billing:
        await db.delete(billing)

    await db.delete(user)
    await db.commit()
    return None


@router.get("/stats")
async def admin_stats(admin=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar()
    total_calls = (await db.execute(select(func.count()).select_from(UsageLog))).scalar()
    total_revenue = (await db.execute(select(func.sum(UsageLog.cost)))).scalar() or 0
    return {
        "total_users": total_users,
        "total_calls": total_calls,
        "total_revenue": float(total_revenue),
    }
