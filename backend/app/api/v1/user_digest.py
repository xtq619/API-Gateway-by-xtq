import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.models.user_digest import UserDigestPref
from app.schemas.user_digest import UserDigestPrefResponse, UserDigestPrefUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/digest", tags=["user-digest"])


async def _get_or_create(db: AsyncSession, user_id: str) -> UserDigestPref:
    result = await db.execute(
        select(UserDigestPref).where(UserDigestPref.user_id == user_id)
    )
    pref = result.scalar_one_or_none()
    if not pref:
        pref = UserDigestPref(user_id=user_id)
        db.add(pref)
        await db.commit()
        await db.refresh(pref)
    return pref


@router.get("", response_model=UserDigestPrefResponse)
async def get_my_digest_pref(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    pref = await _get_or_create(db, user_id)
    return UserDigestPrefResponse.model_validate(pref)


@router.patch("", response_model=UserDigestPrefResponse)
async def update_my_digest_pref(
    req: UserDigestPrefUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    pref = await _get_or_create(db, user_id)
    data = req.model_dump(exclude_unset=True)

    # 开启时必须填邮箱
    if data.get("is_enabled") and not (data.get("email") or pref.email):
        raise HTTPException(status_code=400, detail="请先填写邮箱地址")

    for k, v in data.items():
        setattr(pref, k, v)

    await db.commit()
    await db.refresh(pref)

    # 通知调度器更新
    try:
        from app.main import _refresh_digest_jobs
        await _refresh_digest_jobs()
    except Exception:
        logger.warning("Failed to refresh digest jobs")

    return UserDigestPrefResponse.model_validate(pref)
