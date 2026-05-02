import uuid

from pydantic import BaseModel


class ModelResponse(BaseModel):
    id: uuid.UUID
    provider: str
    model_name: str
    display_name: str
    base_url: str
    is_enabled: bool
    pricing_input: float
    pricing_output: float
    max_tokens_limit: int

    class Config:
        from_attributes = True


class ModelAdminCreate(BaseModel):
    provider: str
    model_name: str
    display_name: str
    base_url: str
    api_key: str
    pricing_input: float = 0
    pricing_output: float = 0
    max_tokens_limit: int = 4096


class ModelAdminResponse(ModelResponse):
    api_key: str


class ModelAdminUpdate(BaseModel):
    provider: str | None = None
    model_name: str | None = None
    display_name: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    pricing_input: float | None = None
    pricing_output: float | None = None
    max_tokens_limit: int | None = None
