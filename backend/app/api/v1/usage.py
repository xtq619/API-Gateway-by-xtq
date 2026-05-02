import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.models.model_registry import ModelRegistry
from app.models.usage_log import UsageLog
from app.schemas.usage import UsageLogResponse, UsageStatsResponse, UsageSummary

router = APIRouter(prefix="/usage", tags=["usage"])


@router.get("/logs", response_model=list[UsageLogResponse])
async def list_logs(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    days: int = Query(default=7, le=90),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(UsageLog)
        .options(selectinload(UsageLog.model))
        .where(UsageLog.user_id == user_id, UsageLog.created_at >= since)
        .order_by(UsageLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    logs = result.unique().scalars().all()
    return [
        UsageLogResponse(
            id=log.id,
            api_key_id=log.api_key_id,
            model_id=log.model_id,
            model_name=log.model.model_name if log.model else "",
            request_tokens=log.request_tokens,
            response_tokens=log.response_tokens,
            cost=log.cost,
            latency_ms=log.latency_ms,
            status=log.status,
            error_message=log.error_message,
            created_at=log.created_at,
        )
        for log in logs
    ]


@router.get("/stats", response_model=list[UsageStatsResponse])
async def get_stats(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    days: int = Query(default=7, le=90),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(
            func.date(UsageLog.created_at).label("date"),
            UsageLog.model_id.label("model_id"),
            func.count().label("request_count"),
            func.sum(UsageLog.request_tokens + UsageLog.response_tokens).label("total_tokens"),
            func.sum(UsageLog.cost).label("total_cost"),
        )
        .where(UsageLog.user_id == user_id, UsageLog.created_at >= since)
        .group_by(func.date(UsageLog.created_at), UsageLog.model_id)
        .order_by("date")
    )
    rows = list(result)
    model_ids = {row.model_id for row in rows if row.model_id}
    model_names: dict[uuid.UUID, str] = {}
    if model_ids:
        model_result = await db.execute(
            select(ModelRegistry.id, ModelRegistry.model_name).where(ModelRegistry.id.in_(model_ids))
        )
        model_names = {mid: name for mid, name in model_result.all()}

    return [
        UsageStatsResponse(
            date=str(row.date),
            model_name=model_names.get(row.model_id, "unknown"),
            request_count=row.request_count,
            total_tokens=row.total_tokens or 0,
            total_cost=float(row.total_cost or 0),
        )
        for row in rows
    ]


@router.get("/summary", response_model=UsageSummary)
async def get_summary(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    days: int = Query(default=1, le=90),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(
            func.count().label("total_calls"),
            func.sum(UsageLog.request_tokens + UsageLog.response_tokens).label("total_tokens"),
            func.sum(UsageLog.cost).label("total_cost"),
        )
        .where(UsageLog.user_id == user_id, UsageLog.created_at >= since)
    )
    row = result.one()

    from app.models.api_key import ApiKey
    key_result = await db.execute(
        select(func.count()).where(ApiKey.user_id == user_id, ApiKey.is_enabled == True)
    )
    active_keys = key_result.scalar() or 0

    return UsageSummary(
        total_calls=row.total_calls or 0,
        total_tokens=row.total_tokens or 0,
        total_cost=float(row.total_cost or 0),
        active_keys=active_keys,
    )
