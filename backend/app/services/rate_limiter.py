import time

import redis.asyncio as aioredis

from app.core.config import settings


class RateLimiter:
    def __init__(self):
        self.redis: aioredis.Redis | None = None

    async def connect(self):
        self.redis = await aioredis.from_url(settings.REDIS_URL, decode_responses=True)

    async def is_rate_limited(self, key_id: str, rpm: int | None = None) -> bool:
        if self.redis is None:
            await self.connect()
        rpm = rpm or settings.DEFAULT_RATE_LIMIT_RPM
        redis_key = f"ratelimit:{key_id}"
        now = time.time()
        window_start = now - 60

        async with self.redis.pipeline() as pipe:
            await pipe.zremrangebyscore(redis_key, 0, window_start)
            await pipe.zcard(redis_key)
            await pipe.zadd(redis_key, {str(now): now})
            await pipe.expire(redis_key, 120)
            _, count, _, _ = await pipe.execute()

        return count >= rpm


rate_limiter = RateLimiter()
