import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DigestSetting(Base):
    __tablename__ = "digest_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # SMTP 配置（管理员设置，供所有用户共用发件）
    smtp_host: Mapped[str] = mapped_column(String(200), default="smtp.qq.com")
    smtp_port: Mapped[int] = mapped_column(Integer, default=465)
    smtp_user: Mapped[str] = mapped_column(String(200), default="")
    smtp_password: Mapped[str] = mapped_column(Text, default="")  # 授权码
    smtp_sender: Mapped[str] = mapped_column(String(200), default="")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )
