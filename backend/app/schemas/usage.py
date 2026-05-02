import uuid
from datetime import datetime

from pydantic import BaseModel


class UsageLogResponse(BaseModel):
    id: int
    api_key_id: uuid.UUID
    model_id: uuid.UUID
    model_name: str = ""
    request_tokens: int
    response_tokens: int
    cost: float
    latency_ms: int
    status: str
    error_message: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class UsageStatsResponse(BaseModel):
    date: str
    model_name: str
    request_count: int
    total_tokens: int
    total_cost: float


class UsageSummary(BaseModel):
    total_calls: int
    total_tokens: int
    total_cost: float
    active_keys: int
