import uuid

from sqlalchemy import Boolean, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ModelRegistry(Base):
    __tablename__ = "model_registry"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    base_url: Mapped[str] = mapped_column(String(500), nullable=False)
    api_key_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    pricing_input: Mapped[float] = mapped_column(Numeric(10, 6), default=0)
    pricing_output: Mapped[float] = mapped_column(Numeric(10, 6), default=0)
    max_tokens_limit: Mapped[int] = mapped_column(Integer, default=4096)
    weight: Mapped[int] = mapped_column(Integer, default=1)
    health_status: Mapped[str] = mapped_column(String(20), default="unknown")
