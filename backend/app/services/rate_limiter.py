import logging
import time

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)


class RateLimiter:
    def __init__(self):
        self.redis: aioredis.Redis | None = None

    async def connect(self):
        try:
            self.redis = await aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        except Exception:
            logger.warning("Failed to connect to Redis, rate limiting disabled")
            self.redis = None

    async def is_rate_limited(self, key_id: str, rpm: int | None = None) -> bool:
        if self.redis is None:
            return False
        rpm = rpm or settings.DEFAULT_RATE_LIMIT_RPM
        redis_key = f"ratelimit:{key_id}"
        now = time.time()
        window_start = now - 60

        try:
            async with self.redis.pipeline() as pipe:
                await pipe.zremrangebyscore(redis_key, 0, window_start)
                await pipe.zcard(redis_key)
                await pipe.zadd(redis_key, {str(now): now})
                await pipe.expire(redis_key, 120)
                _, count, _, _ = await pipe.execute()
            return count >= rpm
        except Exception:
            logger.warning("Redis error in rate limiter, allowing request through")
            return False


rate_limiter = RateLimiter()
