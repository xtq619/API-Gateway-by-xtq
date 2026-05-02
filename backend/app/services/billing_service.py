import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import BillingAccount, BillingTransaction


async def get_balance(db: AsyncSession, user_id: uuid.UUID) -> float:
    result = await db.execute(
        select(BillingAccount).where(BillingAccount.user_id == user_id)
    )
    account = result.scalar_one_or_none()
    return account.balance if account else 0.0


from decimal import Decimal

async def deduct_balance(db: AsyncSession, user_id: uuid.UUID, amount: float, description: str) -> bool:
    result = await db.execute(
        select(BillingAccount).where(BillingAccount.user_id == user_id).with_for_update()
    )
    account = result.scalar_one_or_none()
    if not account:
        return False
    amount_dec = Decimal(str(amount))
    if account.balance < amount_dec:
        return False

    account.balance -= amount_dec

    transaction = BillingTransaction(
        user_id=user_id,
        amount=-amount,
        type="deduction",
        description=description,
        balance_after=account.balance,
    )
    db.add(transaction)
    return True


async def recharge_balance(db: AsyncSession, user_id: uuid.UUID, amount: float) -> float:
    result = await db.execute(
        select(BillingAccount).where(BillingAccount.user_id == user_id).with_for_update()
    )
    account = result.scalar_one_or_none()
    if not account:
        account = BillingAccount(id=uuid.uuid4(), user_id=user_id, balance=0)
        db.add(account)
        await db.flush()

    account.balance += Decimal(str(amount))

    transaction = BillingTransaction(
        user_id=user_id,
        amount=amount,
        type="recharge",
        description="账户充值",
        balance_after=account.balance,
    )
    db.add(transaction)
    return account.balance


async def get_transactions(db: AsyncSession, user_id: uuid.UUID, limit: int = 50, offset: int = 0):
    result = await db.execute(
        select(BillingTransaction)
        .where(BillingTransaction.user_id == user_id)
        .order_by(BillingTransaction.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    items = result.scalars().all()

    count_result = await db.execute(
        select(func.count()).select_from(BillingTransaction).where(BillingTransaction.user_id == user_id)
    )
    total = count_result.scalar()
    return items, total
