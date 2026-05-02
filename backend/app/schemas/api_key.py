import uuid
from datetime import datetime

from pydantic import BaseModel


class ApiKeyCreate(BaseModel):
    name: str
    rate_limit_rpm: int = 60
    expires_in_days: int | None = None
    model_ids: list[str] | None = None


class AllowedModelInfo(BaseModel):
    id: uuid.UUID
    model_name: str
    display_name: str

    class Config:
        from_attributes = True


class ApiKeyResponse(BaseModel):
    id: uuid.UUID
    name: str
    key_prefix: str
    is_enabled: bool
    rate_limit_rpm: int
    last_used_at: datetime | None
    expires_at: datetime | None
    created_at: datetime
    allowed_models: list[AllowedModelInfo] = []

    class Config:
        from_attributes = True


class ApiKeyCreatedResponse(ApiKeyResponse):
    full_key: str


class ApiKeyUpdateModels(BaseModel):
    model_ids: list[str]
