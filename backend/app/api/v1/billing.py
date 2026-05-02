import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.schemas.billing import BalanceResponse, RechargeRequest, TransactionList, TransactionResponse
from app.services import billing_service

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/balance", response_model=BalanceResponse)
async def get_balance(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    balance = await billing_service.get_balance(db, uuid.UUID(user_id))
    return {"balance": balance}


@router.post("/recharge", response_model=BalanceResponse)
async def recharge(
    req: RechargeRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    new_balance = await billing_service.recharge_balance(db, uuid.UUID(user_id), req.amount)
    return {"balance": new_balance}


@router.get("/transactions", response_model=TransactionList)
async def list_transactions(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0),
):
    items, total = await billing_service.get_transactions(db, uuid.UUID(user_id), limit, offset)
    return TransactionList(
        items=[TransactionResponse(
            id=str(i.id), amount=float(i.amount), type=i.type,
            description=i.description, balance_after=float(i.balance_after),
            created_at=i.created_at,
        ) for i in items],
        total=total,
    )
