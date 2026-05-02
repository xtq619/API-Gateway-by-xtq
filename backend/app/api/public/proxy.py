"""Public OpenAI-compatible API endpoints.

End-users call these with their API Key (Bearer sk-xxx).
"""
import time
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session, get_db
from app.core.dependencies import get_api_key_from_header
from app.core.exceptions import InsufficientBalance, ModelNotFound, RateLimitExceeded, UpstreamError
from app.models.api_key import ApiKey
from app.models.model_registry import ModelRegistry
from app.models.usage_log import UsageLog
from app.services.billing_service import deduct_balance, get_balance
from app.services.proxy_service import (
    UsageCollector, proxy_service, record_stream_usage, stream_with_collector,
)
from app.services.rate_limiter import rate_limiter

router = APIRouter()


@router.post("/chat/completions")
async def chat_completions(
    request: Request,
    background_tasks: BackgroundTasks,
    api_key: ApiKey = Depends(get_api_key_from_header),
    db: AsyncSession = Depends(get_db),
):
    client_ip = request.client.host if request.client else None

    is_limited = await rate_limiter.is_rate_limited(str(api_key.id), api_key.rate_limit_rpm)
    if is_limited:
        raise RateLimitExceeded()

    body = await request.json()
    model_name = body.get("model", "")
    is_stream = body.get("stream", False)
    start_time = time.time()

    result = await db.execute(
        select(ModelRegistry).where(
            ModelRegistry.model_name == model_name, ModelRegistry.is_enabled == True
        )
    )
    model = result.scalar_one_or_none()
    if not model:
        raise ModelNotFound()

    if api_key.allowed_models:
        allowed_ids = {m.id for m in api_key.allowed_models}
        if model.id not in allowed_ids:
            raise ModelNotFound()

    if model.pricing_input > 0 or model.pricing_output > 0:
        balance = await get_balance(db, api_key.user_id)
        if balance <= 0:
            raise InsufficientBalance()

    try:
        resp_body, stream_response, usage_log = await proxy_service.chat_completion(
            model, body, dict(request.headers), request_ip=client_ip,
        )
    except httpx.HTTPStatusError as e:
        async with async_session() as err_db:
            err_db.add(UsageLog(
                api_key_id=api_key.id,
                user_id=api_key.user_id,
                model_id=model.id,
                request_tokens=0, response_tokens=0, cost=0,
                latency_ms=int((time.time() - start_time) * 1000),
                status="error",
                error_message=f"Upstream {e.response.status_code}",
                request_ip=client_ip,
            ))
            await err_db.commit()
        raise UpstreamError(str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise

    await db.execute(
        update(ApiKey).where(ApiKey.id == api_key.id).values(
            last_used_at=datetime.now(timezone.utc)
        )
    )

    if not is_stream:
        usage_log.api_key_id = api_key.id
        usage_log.user_id = api_key.user_id
        db.add(usage_log)

        if usage_log.cost and usage_log.cost > 0:
            deducted = await deduct_balance(
                db, api_key.user_id, usage_log.cost,
                f"API调用：{model.model_name}",
            )
            if not deducted:
                raise InsufficientBalance()
        return resp_body

    collector = UsageCollector()
    background_tasks.add_task(
        record_stream_usage,
        api_key.id, api_key.user_id, model.id, collector, start_time, client_ip,
    )
    return StreamingResponse(
        stream_with_collector(stream_response, collector),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/models")
async def list_public_models(
    api_key: ApiKey = Depends(get_api_key_from_header),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ModelRegistry).where(ModelRegistry.is_enabled == True)
    )
    models = result.scalars().all()
    if api_key.allowed_models:
        allowed_ids = {m.id for m in api_key.allowed_models}
        models = [m for m in models if m.id in allowed_ids]
    return {
        "object": "list",
        "data": [
            {
                "id": m.model_name,
                "object": "model",
                "created": 0,
                "owned_by": m.provider,
            }
            for m in models
        ],
    }
