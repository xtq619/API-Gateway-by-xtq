import json
import time

import httpx
from sqlalchemy import select

from app.core.config import settings
from app.core.database import async_session
from app.core.security import decrypt_api_key
from app.models.api_key import ApiKey
from app.models.model_registry import ModelRegistry
from app.models.usage_log import UsageLog
from app.services.billing_service import deduct_balance


class UsageCollector:
    """Collects usage info from streaming SSE chunks via JSON parsing."""

    def __init__(self):
        self.usage_info: dict | None = None

    def feed_chunk(self, chunk: bytes):
        try:
            text = chunk.decode(errors="ignore")
            for line in text.split("\n"):
                line = line.strip()
                if not line.startswith("data: ") or line == "data: [DONE]":
                    continue
                try:
                    data = json.loads(line[6:])
                    if "usage" in data:
                        self.usage_info = data["usage"]
                except json.JSONDecodeError:
                    pass
        except Exception:
            pass


async def stream_with_collector(response, collector: UsageCollector):
    """Wrap an httpx stream response, feeding chunks to the collector as they pass through."""
    async for chunk in response.aiter_bytes():
        collector.feed_chunk(chunk)
        yield chunk


async def record_stream_usage(
    api_key_id, user_id, model_id, collector: UsageCollector,
    start_time: float, request_ip: str | None,
):
    """After stream ends, write usage log and deduct balance from a fresh session."""
    async with async_session() as db:
        try:
            usage_info = collector.usage_info
            request_tokens = usage_info.get("prompt_tokens", 0) if usage_info else 0
            response_tokens = usage_info.get("completion_tokens", 0) if usage_info else 0
            latency_ms = int((time.time() - start_time) * 1000)

            model = (await db.execute(
                select(ModelRegistry).where(ModelRegistry.id == model_id)
            )).scalar_one_or_none()

            if model:
                cost = _calculate_cost(model, request_tokens, response_tokens)
                db.add(UsageLog(
                    api_key_id=api_key_id,
                    user_id=user_id,
                    model_id=model_id,
                    request_tokens=request_tokens,
                    response_tokens=response_tokens,
                    cost=cost,
                    latency_ms=latency_ms,
                    status="success",
                    request_ip=request_ip,
                ))
                if cost > 0:
                    await deduct_balance(db, user_id, cost, f"API调用：{model.model_name}")

            await db.commit()
        except Exception:
            await db.rollback()


def _calculate_cost(model: ModelRegistry, input_tokens: int, output_tokens: int) -> float:
    input_cost = (input_tokens / 1000) * float(model.pricing_input) * settings.MARKUP_RATIO
    output_cost = (output_tokens / 1000) * float(model.pricing_output) * settings.MARKUP_RATIO
    return round(input_cost + output_cost, 6)


class ProxyService:
    def __init__(self):
        self._client: httpx.AsyncClient | None = None

    async def get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(120.0, connect=10.0),
                limits=httpx.Limits(max_keepalive_connections=50, max_connections=100),
            )
        return self._client

    async def chat_completion(
        self, model: ModelRegistry, request_body: dict,
        request_headers: dict, request_ip: str | None = None,
    ) -> tuple[dict | None, httpx.Response | None, UsageLog | None]:
        """Send a chat completion to the upstream model.

        Returns (resp_body, stream_response, usage_log).
        - Non-streaming: resp_body is the JSON dict, stream_response is None, usage_log
          is a UsageLog (not yet added to session — caller sets api_key_id/user_id).
        - Streaming: resp_body and usage_log are None, stream_response is the httpx response.
        - Raises httpx.HTTPStatusError on upstream errors.
        """
        upstream_body = {**request_body}
        upstream_body["model"] = model.model_name
        upstream_headers = {
            k: v for k, v in request_headers.items()
            if k.lower() not in ("authorization", "host", "x-api-key")
        }
        upstream_headers["authorization"] = f"Bearer {decrypt_api_key(model.api_key_encrypted)}"

        is_stream = upstream_body.get("stream", False)
        start_time = time.time()

        client = await self.get_client()

        response = await client.post(
            f"{model.base_url.rstrip('/')}/chat/completions",
            json=upstream_body,
            headers=upstream_headers,
        )

        latency_ms = int((time.time() - start_time) * 1000)

        if not is_stream:
            resp_body = response.json()
            usage = resp_body.get("usage", {})
            request_tokens = usage.get("prompt_tokens", 0)
            response_tokens = usage.get("completion_tokens", 0)
            cost = _calculate_cost(model, request_tokens, response_tokens)

            usage_log = UsageLog(
                model_id=model.id,
                request_tokens=request_tokens,
                response_tokens=response_tokens,
                cost=cost,
                latency_ms=latency_ms,
                status="success" if response.status_code < 400 else "error",
                request_ip=request_ip,
            )
            return resp_body, None, usage_log

        return None, response, None

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()


proxy_service = ProxyService()
