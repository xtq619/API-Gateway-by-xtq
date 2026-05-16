import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class GuessSubmit(BaseModel):
    score_a: int = Field(ge=0, le=99)
    score_b: int = Field(ge=0, le=99)


class GuessResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    match_id: int
    score_a: int
    score_b: int
    created_at: datetime
    updated_at: datetime


class GuessList(BaseModel):
    items: list[GuessResponse]


class EmotionSubmit(BaseModel):
    emotion: str = Field(min_length=1, max_length=20)


class EmotionStat(BaseModel):
    emotion: str
    count: int
    pct: int


class EmotionResponse(BaseModel):
    match_id: int
    my_emotion: str | None = None
    stats: list[EmotionStat]