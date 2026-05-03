import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FeedbackCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    category: str = Field(default="suggestion", pattern="^(suggestion|bug|other)$")


class FeedbackReply(BaseModel):
    reply: str = Field(min_length=1, max_length=2000)


class FeedbackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    content: str
    category: str
    status: str
    reply: str | None = None
    replied_at: datetime | None = None
    created_at: datetime
    user_name: str | None = None


class FeedbackList(BaseModel):
    items: list[FeedbackResponse]
    total: int
