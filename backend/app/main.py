from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.public.proxy import router as public_router
from app.api.public.feedback import router as public_feedback_router
from app.api.public.news import router as public_news_router
from app.api.v1.news_admin import router as news_admin_router
from app.api.v1.admin import router as admin_router
from app.api.v1.feedback import router as feedback_router
from app.api.v1.feedback_admin import router as feedback_admin_router
from app.api.v1.auth import router as auth_router
from app.api.v1.billing import router as billing_router
from app.api.v1.keys import router as keys_router
from app.api.v1.models import router as models_router
from app.api.v1.proxy import router as proxy_router
from app.api.v1.usage import router as usage_router
from app.api.v1.digest import router as digest_router
from app.api.v1.user_digest import router as user_digest_router
from app.api.v1.battle import router as battle_router
from app.core.config import settings
from app.middleware.cors import setup_cors
from app.services.proxy_service import proxy_service
from app.services.rate_limiter import rate_limiter


_digest_scheduler = None


def _setup_digest_scheduler():
    """Start APScheduler. Checks every minute if any user needs a digest."""
    import logging

    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.interval import IntervalTrigger
    from sqlalchemy import select

    logger = logging.getLogger(__name__)

    _last_sent: dict[str, str] = {}  # user_id -> "YYYY-MM-DD" to prevent duplicate sends

    async def check_and_send():
        from app.core.database import async_session
        from app.models.digest import DigestSetting
        from app.models.user_digest import UserDigestPref
        from app.services.digest import compile_daily_digest
        from app.services.notifier import send_digest_email
        from datetime import datetime, timedelta, timezone

        tz_bj = timezone(timedelta(hours=8))
        now = datetime.now(tz_bj)
        current_time = now.strftime("%H:%M")
        today = now.strftime("%Y-%m-%d")

        try:
            async with async_session() as db:
                # Get SMTP config
                smtp_result = await db.execute(select(DigestSetting).limit(1))
                smtp = smtp_result.scalar_one_or_none()

                if not smtp or not smtp.smtp_user or not smtp.smtp_password:
                    return  # SMTP not configured, skip

                # Get all enabled users whose send_time matches now
                result = await db.execute(
                    select(UserDigestPref).where(
                        UserDigestPref.is_enabled == True,
                        UserDigestPref.email != "",
                        UserDigestPref.send_time == current_time,
                    )
                )
                users = result.scalars().all()

                if not users:
                    return

                # Compile digest once for all users
                digest = await compile_daily_digest(db)
                if not digest:
                    logger.info("No news today, skipping digest")
                    return

                for user_pref in users:
                    uid = str(user_pref.user_id)
                    if _last_sent.get(uid) == today:
                        continue  # Already sent today

                    success = await send_digest_email(
                        digest_markdown=digest,
                        smtp_host=smtp.smtp_host,
                        smtp_port=smtp.smtp_port,
                        smtp_user=smtp.smtp_user,
                        smtp_password=smtp.smtp_password,
                        smtp_sender=smtp.smtp_sender or smtp.smtp_user,
                        recipients=[user_pref.email],
                    )
                    if success:
                        _last_sent[uid] = today
                        logger.info("Digest sent to %s", user_pref.email)
        except Exception:
            logger.exception("Digest check job failed")

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        check_and_send,
        IntervalTrigger(minutes=1),
        id="digest_check",
        name="Digest Check",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Digest scheduler started (checking every minute)")
    return scheduler


async def _refresh_digest_jobs():
    """No-op for interval-based scheduler. Placeholder for future per-user jobs."""
    pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.core.security import _get_fernet
    _get_fernet()  # Validate Fernet key early — crash fast if misconfigured
    await rate_limiter.connect()

    scheduler = _setup_digest_scheduler()

    yield

    if scheduler:
        scheduler.shutdown(wait=False)
    if rate_limiter.redis:
        await rate_limiter.redis.close()
    await proxy_service.close()


app = FastAPI(
    title="API Gateway",
    description="LLM API 中转平台",
    version="0.1.0",
    lifespan=lifespan,
)

setup_cors(app)


import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    detail = {
        "code": "INTERNAL_ERROR",
        "message": "服务器内部错误",
    }
    if settings.DEBUG:
        detail["debug"] = f"{type(exc).__name__}: {exc}"
        detail["traceback"] = tb
    return JSONResponse(
        status_code=500,
        content={"detail": detail},
    )


# Management API (for frontend, JWT auth)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(keys_router, prefix="/api/v1")
app.include_router(models_router, prefix="/api/v1")
app.include_router(proxy_router, prefix="/api/v1")
app.include_router(usage_router, prefix="/api/v1")
app.include_router(billing_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(feedback_router, prefix="/api/v1")
app.include_router(feedback_admin_router, prefix="/api/v1")
app.include_router(news_admin_router, prefix="/api/v1")
app.include_router(digest_router, prefix="/api/v1")
app.include_router(user_digest_router, prefix="/api/v1")
app.include_router(battle_router, prefix="/api/v1")

# Public OpenAI-compatible API (for end-users, API Key auth)
app.include_router(public_router, prefix="/v1")

# Public feedback wall (no auth)
app.include_router(public_feedback_router, prefix="/api/v1/public")
app.include_router(public_news_router, prefix="/api/v1/public")


@app.get("/health")
async def health():
    from app.core.database import async_session
    status_details = {"status": "ok", "db": "ok", "redis": "ok"}

    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
    except Exception:
        status_details["db"] = "error"
        status_details["status"] = "degraded"

    try:
        if rate_limiter.redis:
            await rate_limiter.redis.ping()
        else:
            status_details["redis"] = "未连接"
            status_details["status"] = "degraded"
    except Exception:
        status_details["redis"] = "error"
        status_details["status"] = "degraded"

    status_code = 200 if status_details["status"] == "ok" else 503
    return JSONResponse(content=status_details, status_code=status_code)
