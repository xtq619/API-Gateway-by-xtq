import json
import time
import uuid

import httpx
from sqlalchemy import select

from app.core.config import settings
from app.core.security import decrypt_api_key
from app.models.api_key import ApiKey
from app.models.model_registry import ModelRegistry
from app.models.usage_log import UsageLog


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

    async def resolve_model(self, db, model_name: str, api_key: ApiKey | None = None) -> ModelRegistry:
        """Resolve and load-balance a model, respecting per-key permissions."""
        result = await db.execute(
            select(ModelRegistry)
            .where(ModelRegistry.model_name == model_name, ModelRegistry.is_enabled == True)
            .order_by(ModelRegistry.weight.desc())
            .limit(1)
        )
        model = result.scalar_one_or_none()
        if model is None:
            result = await db.execute(
                select(ModelRegistry)
                .where(ModelRegistry.is_enabled == True)
                .order_by(ModelRegistry.weight.desc())
                .limit(1)
            )
            model = result.scalar_one_or_none()
        if model is None:
            raise ValueError("没有可用的模型")

        if api_key and api_key.allowed_models:
            allowed_ids = {m.id for m in api_key.allowed_models}
            if model.id not in allowed_ids:
                raise ValueError("该密钥无权访问此模型")

        return model

    async def proxy_chat_completion(
        self, db, api_key: ApiKey, model_name: str, request_body: dict,
        request_headers: dict, request_ip: str | None = None,
    ):
        model = await self.resolve_model(db, model_name, api_key=api_key)

        # Build upstream request
        upstream_body = {**request_body}
        upstream_body["model"] = model.model_name
        upstream_headers = {k: v for k, v in request_headers.items()
                           if k.lower() not in ("authorization", "host", "x-api-key")}
        upstream_headers["authorization"] = f"Bearer {decrypt_api_key(model.api_key_encrypted)}"

        is_stream = upstream_body.get("stream", False)
        start_time = time.time()

        client = await self.get_client()

        try:
            response = await client.post(
                f"{model.base_url.rstrip('/')}/chat/completions",
                json=upstream_body,
                headers=upstream_headers,
            )

            latency_ms = int((time.time() - start_time) * 1000)

            # Handle non-streaming
            if not is_stream:
                resp_body = response.json()
                usage = resp_body.get("usage", {})
                request_tokens = usage.get("prompt_tokens", 0)
                response_tokens = usage.get("completion_tokens", 0)
                cost = self._calculate_cost(model, request_tokens, response_tokens)

                usage_log = UsageLog(
                    api_key_id=api_key.id,
                    user_id=api_key.user_id,
                    model_id=model.id,
                    request_tokens=request_tokens,
                    response_tokens=response_tokens,
                    cost=cost,
                    latency_ms=latency_ms,
                    status="success" if response.status_code < 400 else "error",
                    request_ip=request_ip,
                )
                db.add(usage_log)
                return resp_body, None, cost

            # Handle streaming — return raw response for StreamingResponse
            return None, response, None

        except httpx.HTTPStatusError as e:
            latency_ms = int((time.time() - start_time) * 1000)
            usage_log = UsageLog(
                api_key_id=api_key.id,
                user_id=api_key.user_id,
                model_id=model.id,
                request_tokens=0,
                response_tokens=0,
                cost=0,
                latency_ms=latency_ms,
                status="error",
                error_message=f"Upstream {e.response.status_code}",
            )
            db.add(usage_log)
            raise

    def _calculate_cost(self, model: ModelRegistry, input_tokens: int, output_tokens: int) -> float:
        input_cost = (input_tokens / 1000) * float(model.pricing_input) * settings.MARKUP_RATIO
        output_cost = (output_tokens / 1000) * float(model.pricing_output) * settings.MARKUP_RATIO
        return round(input_cost + output_cost, 6)

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()


proxy_service = ProxyService()
