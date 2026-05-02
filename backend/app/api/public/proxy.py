"""Public OpenAI-compatible API endpoints.

End-users call these with their API Key (Bearer sk-xxx).
"""
import json
import time
from datetime import datetime, timezone

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
from app.services.proxy_service import proxy_service
from app.services.rate_limiter import rate_limiter

router = APIRouter()


class _UsageCollector:
    def __init__(self):
        self.usage_info = None


async def _handle_stream(response, collector: _UsageCollector):
    async for chunk in response.aiter_bytes():
        try:
            line = chunk.decode(errors="ignore")
            if "usage" in line:
                for part in line.split("\n"):
                    if part.startswith("data: ") and part != "data: [DONE]":
                        try:
                            inner = json.loads(part[6:])
                            if "usage" in inner:
                                collector.usage_info = inner["usage"]
                        except json.JSONDecodeError:
                            pass
        except Exception:
            pass
        yield chunk


async def _record_stream_usage(
    api_key_id, user_id, model_id, collector: _UsageCollector,
    start_time: float, request_ip: str | None,
):
    async with async_session() as db:
        try:
            usage_info = collector.usage_info
            request_tokens = usage_info.get("prompt_tokens", 0) if usage_info else 0
            response_tokens = usage_info.get("completion_tokens", 0) if usage_info else 0
            latency_ms = int((time.time() - start_time) * 1000)

            model_result = await db.execute(select(ModelRegistry).where(ModelRegistry.id == model_id))
            model = model_result.scalar_one_or_none()

            if model:
                cost = proxy_service._calculate_cost(model, request_tokens, response_tokens)
                usage_log = UsageLog(
                    api_key_id=api_key_id,
                    user_id=user_id,
                    model_id=model_id,
                    request_tokens=request_tokens,
                    response_tokens=response_tokens,
                    cost=cost,
                    latency_ms=latency_ms,
                    status="success",
                    request_ip=request_ip,
                )
                db.add(usage_log)

                if cost > 0:
                    await deduct_balance(db, user_id, cost, f"API 调用：{model.model_name}")

            await db.commit()
        except Exception:
            await db.rollback()


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
        select(ModelRegistry).where(ModelRegistry.model_name == model_name, ModelRegistry.is_enabled == True)
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
        resp_body, stream_response, cost = await proxy_service.proxy_chat_completion(
            db, api_key, model_name, body, dict(request.headers),
            request_ip=client_ip,
        )

        await db.execute(
            update(ApiKey).where(ApiKey.id == api_key.id).values(last_used_at=datetime.now(timezone.utc))
        )

        if not is_stream:
            if cost and cost > 0:
                deducted = await deduct_balance(db, api_key.user_id, cost, f"API 调用：{model.model_name}")
                if not deducted:
                    raise InsufficientBalance()
            return resp_body

        collector = _UsageCollector()
        background_tasks.add_task(
            _record_stream_usage,
            api_key.id, api_key.user_id, model.id, collector, start_time, client_ip,
        )
        return StreamingResponse(
            _handle_stream(stream_response, collector),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        raise UpstreamError(str(e))


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
