import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NewsCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    summary: str = Field(min_length=1, max_length=1000)
    content: str | None = None
    category: str = Field(default="军事", pattern="^(新闻|论文|工具|军事|其他)$")
    source_name: str = Field(default="官方", max_length=100)
    source_url: str | None = None
    is_published: bool = False


class NewsUpdate(BaseModel):
    title: str | None = None
    summary: str | None = None
    content: str | None = None
    category: str | None = None
    source_name: str | None = None
    source_url: str | None = None
    is_published: bool | None = None
    is_sensitive: bool | None = None


class NewsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    summary: str
    content: str | None = None
    category: str
    source_name: str
    source_url: str | None = None
    is_published: bool
    is_sensitive: bool = False
    created_at: datetime


class NewsList(BaseModel):
    items: list[NewsResponse]
    total: int


class SendNewsRequest(BaseModel):
    user_id: str
    encrypted: str | None = None


class EncryptNewsRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)
