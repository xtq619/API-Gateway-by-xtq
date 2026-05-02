import time
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.core.exceptions import InsufficientBalance
from app.core.security import decrypt_api_key, generate_api_key
from app.models.api_key import ApiKey
from app.models.model_registry import ModelRegistry
from app.models.usage_log import UsageLog
from app.schemas.api_key import ApiKeyCreate, ApiKeyCreatedResponse, ApiKeyResponse, ApiKeyUpdateModels
from app.services.billing_service import deduct_balance, get_balance

router = APIRouter(prefix="/keys", tags=["api-keys"])


@router.get("", response_model=list[ApiKeyResponse])
async def list_keys(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ApiKey).where(ApiKey.user_id == user_id).order_by(ApiKey.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=ApiKeyCreatedResponse)
async def create_key(req: ApiKeyCreate, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    full_key, key_hash, prefix = generate_api_key()
    expires_at = None
    if req.expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=req.expires_in_days)

    api_key = ApiKey(
        user_id=uuid.UUID(user_id),
        name=req.name,
        key_prefix=prefix,
        key_hash=key_hash,
        rate_limit_rpm=req.rate_limit_rpm,
        expires_at=expires_at,
    )
    db.add(api_key)
    await db.flush()
    await db.refresh(api_key)

    if req.model_ids:
        model_result = await db.execute(
            select(ModelRegistry).where(ModelRegistry.id.in_([uuid.UUID(mid) for mid in req.model_ids]))
        )
        models = model_result.scalars().all()
        if len(models) != len(req.model_ids):
            raise HTTPException(status_code=400, detail="部分模型ID无效")
        api_key.allowed_models = list(models)
        await db.flush()
        await db.refresh(api_key)

    return ApiKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        is_enabled=api_key.is_enabled,
        rate_limit_rpm=api_key.rate_limit_rpm,
        last_used_at=api_key.last_used_at,
        expires_at=api_key.expires_at,
        created_at=api_key.created_at,
        full_key=full_key,
        allowed_models=[
            {"id": m.id, "model_name": m.model_name, "display_name": m.display_name}
            for m in api_key.allowed_models
        ],
    )


@router.delete("/{key_id}")
async def delete_key(key_id: uuid.UUID, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user_id))
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="密钥未找到")
    await db.delete(key)
    return {"detail": "密钥已删除"}


@router.patch("/{key_id}/toggle")
async def toggle_key(key_id: uuid.UUID, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user_id))
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="密钥未找到")
    key.is_enabled = not key.is_enabled
    await db.flush()
    return {"detail": "ok", "is_enabled": key.is_enabled}


@router.put("/{key_id}/models", response_model=ApiKeyResponse)
async def update_key_models(
    key_id: uuid.UUID,
    req: ApiKeyUpdateModels,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user_id))
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="密钥未找到")

    if req.model_ids:
        model_result = await db.execute(
            select(ModelRegistry).where(ModelRegistry.id.in_([uuid.UUID(mid) for mid in req.model_ids]))
        )
        models = model_result.scalars().all()
        if len(models) != len(req.model_ids):
            raise HTTPException(status_code=400, detail="部分模型ID无效")
        key.allowed_models = list(models)
    else:
        key.allowed_models = []

    await db.flush()
    await db.refresh(key)
    return key


class KeyTestResponse(BaseModel):
    success: bool
    latency_ms: int
    tokens: dict
    cost: float
    model: str
    response_text: str | None = None
    error_message: str | None = None


class KeyTestRequest(BaseModel):
    message: str = "Hi"

@router.post("/{key_id}/test", response_model=KeyTestResponse)
async def test_key(
    key_id: uuid.UUID,
    req: KeyTestRequest | None = None,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    key_result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user_id)
    )
    api_key = key_result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=404, detail="密钥未找到")
    if not api_key.is_active:
        raise HTTPException(status_code=400, detail="密钥已禁用或已过期，无法测试")

    if api_key.allowed_models:
        enabled = [m for m in api_key.allowed_models if m.is_enabled]
        model = enabled[0] if enabled else None
    else:
        model_result = await db.execute(
            select(ModelRegistry).where(ModelRegistry.is_enabled == True).limit(1)
        )
        model = model_result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=400, detail="没有可用的模型，请先添加模型")

    if model.pricing_input > 0 or model.pricing_output > 0:
        balance = await get_balance(db, api_key.user_id)
        if balance <= 0:
            raise InsufficientBalance()

    test_message = req.message if req else "Hi"
    test_body = {
        "model": model.model_name,
        "messages": [{"role": "user", "content": test_message}],
        "max_tokens": 50,
        "stream": False,
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {decrypt_api_key(model.api_key_encrypted)}",
    }

    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
            resp = await client.post(
                f"{model.base_url.rstrip('/')}/chat/completions",
                json=test_body,
                headers=headers,
            )
        latency_ms = int((time.time() - start) * 1000)

        # 更新密钥最后使用时间
        api_key.last_used_at = datetime.now(timezone.utc)
        await db.flush()

        if resp.status_code >= 400:
            error_text = ""
            try:
                error_text = resp.json().get("error", {}).get("message", resp.text[:200])
            except Exception:
                error_text = resp.text[:200]
            db.add(UsageLog(
                api_key_id=api_key.id,
                user_id=api_key.user_id,
                model_id=model.id,
                request_tokens=0,
                response_tokens=0,
                cost=0,
                latency_ms=latency_ms,
                status="error",
                error_message=f"上游返回 {resp.status_code}: {error_text}",
            ))
            await db.flush()
            return KeyTestResponse(
                success=False,
                latency_ms=latency_ms,
                tokens={"input": 0, "output": 0},
                cost=0,
                model=model.model_name,
                error_message=f"上游返回 {resp.status_code}: {error_text}",
            )

        data = resp.json()
        usage = data.get("usage", {})
        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)
        input_cost = (input_tokens / 1000) * float(model.pricing_input) * settings.MARKUP_RATIO
        output_cost = (output_tokens / 1000) * float(model.pricing_output) * settings.MARKUP_RATIO
        cost = round(input_cost + output_cost, 6)

        choices = data.get("choices", [])
        msg = choices[0].get("message", {}) if choices else {}
        content = msg.get("content") or msg.get("reasoning_content") or ""

        db.add(UsageLog(
            api_key_id=api_key.id,
            user_id=api_key.user_id,
            model_id=model.id,
            request_tokens=input_tokens,
            response_tokens=output_tokens,
            cost=cost,
            latency_ms=latency_ms,
            status="success",
        ))

        if cost > 0:
            await deduct_balance(db, api_key.user_id, cost, f"API测试：{model.model_name}")

        await db.flush()

        return KeyTestResponse(
            success=True,
            latency_ms=latency_ms,
            tokens={"input": input_tokens, "output": output_tokens},
            cost=cost,
            model=model.model_name,
            response_text=content,
        )

    except httpx.TimeoutException:
        latency_ms = int((time.time() - start) * 1000)
        db.add(UsageLog(
            api_key_id=api_key.id,
            user_id=api_key.user_id,
            model_id=model.id,
            request_tokens=0,
            response_tokens=0,
            cost=0,
            latency_ms=latency_ms,
            status="error",
            error_message="请求上游超时",
        ))
        await db.flush()
        return KeyTestResponse(
            success=False,
            latency_ms=latency_ms,
            tokens={"input": 0, "output": 0},
            cost=0,
            model=model.model_name,
            error_message="请求上游超时",
        )
    except Exception as e:
        latency_ms = int((time.time() - start) * 1000)
        db.add(UsageLog(
            api_key_id=api_key.id,
            user_id=api_key.user_id,
            model_id=model.id,
            request_tokens=0,
            response_tokens=0,
            cost=0,
            latency_ms=latency_ms,
            status="error",
            error_message=str(e),
        ))
        await db.flush()
        return KeyTestResponse(
            success=False,
            latency_ms=latency_ms,
            tokens={"input": 0, "output": 0},
            cost=0,
            model=model.model_name,
            error_message=str(e),
        )
