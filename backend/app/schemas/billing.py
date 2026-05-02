from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


class BalanceResponse(BaseModel):
    balance: float


class RechargeRequest(BaseModel):
    amount: float = Field(gt=0, le=10000)
    payment_method: str = "manual"


class TransactionResponse(BaseModel):
    id: str
    amount: float
    type: str
    description: str
    balance_after: float
    created_at: datetime

    class Config:
        from_attributes = True


class TransactionList(BaseModel):
    items: List[TransactionResponse]
    total: int
