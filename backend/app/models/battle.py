import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BattleRecord(Base):
    __tablename__ = "battle_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    topic: Mapped[str] = mapped_column(Text, nullable=False)
    model_a_name: Mapped[str] = mapped_column(String(200), nullable=False)
    model_b_name: Mapped[str] = mapped_column(String(200), nullable=False)
    judge_model_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    rounds: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    history: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    judge_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
