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
from app.core.config import settings
from app.middleware.cors import setup_cors
from app.services.proxy_service import proxy_service
from app.services.rate_limiter import rate_limiter


def _setup_digest_scheduler():
    """Start APScheduler for daily digest if enabled."""
    import logging

    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger

    logger = logging.getLogger(__name__)

    async def run_daily_digest():
        from app.core.database import async_session
        from app.services.digest import compile_daily_digest
        from app.services.notifier import send_digest_email

        logger.info("Running daily digest job...")
        try:
            async with async_session() as db:
                digest = await compile_daily_digest(db)
                if digest:
                    await send_digest_email(digest)
                    logger.info("Daily digest sent successfully")
                else:
                    logger.info("No news today, digest skipped")
        except Exception as e:
            logger.error("Daily digest job failed: %s", e)

    parts = settings.DIGEST_CRON.split()
    if len(parts) != 5:
        logger.error("Invalid DIGEST_CRON format: %s", settings.DIGEST_CRON)
        return None

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_daily_digest,
        CronTrigger(
            minute=parts[0], hour=parts[1], day=parts[2],
            month=parts[3], day_of_week=parts[4],
        ),
        id="daily_digest",
        name="Daily AI Digest",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Digest scheduler started (cron: %s)", settings.DIGEST_CRON)
    return scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.core.security import _get_fernet
    _get_fernet()  # Validate Fernet key early — crash fast if misconfigured
    await rate_limiter.connect()

    scheduler = None
    if settings.DIGEST_ENABLED:
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
