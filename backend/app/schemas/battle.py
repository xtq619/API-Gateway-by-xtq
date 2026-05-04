import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BattleRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=500)
    model_a_id: uuid.UUID
    model_b_id: uuid.UUID
    judge_model_id: uuid.UUID
    rounds: int = Field(default=3, ge=1, le=5)


class BattleTurn(BaseModel):
    round: int
    model: str  # "a" | "b"
    model_name: str
    content: str


class BattleHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    topic: str
    model_a_name: str
    model_b_name: str
    judge_model_name: str
    rounds: int
    history: list[BattleTurn] | None = None
    judge_summary: str | None = None
    created_at: datetime


class BattleHistoryList(BaseModel):
    items: list[BattleHistoryResponse]
    total: int
