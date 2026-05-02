import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

api_key_models = Table(
    "api_key_models",
    Base.metadata,
    Column("api_key_id", UUID(as_uuid=True), ForeignKey("api_keys.id", ondelete="CASCADE"), primary_key=True),
    Column("model_id", UUID(as_uuid=True), ForeignKey("model_registry.id", ondelete="CASCADE"), primary_key=True),
)


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    key_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    rate_limit_rpm: Mapped[int] = mapped_column(Integer, default=60)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="api_keys")
    allowed_models = relationship("ModelRegistry", secondary=api_key_models, lazy="selectin")

    @property
    def is_active(self) -> bool:
        if not self.is_enabled:
            return False
        if self.expires_at and datetime.now(timezone.utc) > self.expires_at:
            return False
        return True
