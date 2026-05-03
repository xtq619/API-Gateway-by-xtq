import json
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


class DigestSettingResponse(BaseModel):
    id: UUID
    is_enabled: bool
    cron_expr: str
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password_masked: str  # 脱敏显示
    smtp_sender: str
    recipients: list[str]
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, m):
        # 脱敏：只显示前2位和后2位
        pwd = m.smtp_password or ""
        if len(pwd) > 8:
            masked = pwd[:2] + "****" + pwd[-2:]
        elif pwd:
            masked = "****"
        else:
            masked = ""

        try:
            recips = json.loads(m.recipients) if m.recipients else []
        except (json.JSONDecodeError, TypeError):
            recips = []

        return cls(
            id=m.id,
            is_enabled=m.is_enabled,
            cron_expr=m.cron_expr,
            smtp_host=m.smtp_host,
            smtp_port=m.smtp_port,
            smtp_user=m.smtp_user,
            smtp_password_masked=masked,
            smtp_sender=m.smtp_sender,
            recipients=recips,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )


class DigestSettingUpdate(BaseModel):
    is_enabled: bool | None = None
    cron_expr: str | None = None
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None
    smtp_password: str | None = None  # 空字符串表示不修改
    smtp_sender: str | None = None
    recipients: list[str] | None = None

    @field_validator("cron_expr")
    @classmethod
    def validate_cron(cls, v):
        if v is not None:
            parts = v.split()
            if len(parts) != 5:
                raise ValueError("cron 表达式必须是 5 段格式（分 时 日 月 周）")
        return v

    @field_validator("recipients")
    @classmethod
    def validate_recipients(cls, v):
        if v is not None and len(v) > 10:
            raise ValueError("最多 10 个收件人")
        return v


class DigestTestRequest(BaseModel):
    """发送测试邮件"""
    pass
