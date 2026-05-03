from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


class UserDigestPrefResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_enabled: bool
    email: str
    send_time: str
    updated_at: datetime


class UserDigestPrefUpdate(BaseModel):
    is_enabled: bool | None = None
    email: str | None = None
    send_time: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        if v is not None and v and "@" not in v:
            raise ValueError("请输入有效邮箱")
        return v

    @field_validator("send_time")
    @classmethod
    def validate_time(cls, v):
        if v is not None:
            parts = v.split(":")
            if len(parts) != 2:
                raise ValueError("时间格式: HH:MM")
            h, m = int(parts[0]), int(parts[1])
            if not (0 <= h <= 23 and 0 <= m <= 59):
                raise ValueError("时间范围: 00:00 - 23:59")
        return v
