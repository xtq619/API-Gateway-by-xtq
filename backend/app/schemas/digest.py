from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DigestSettingResponse(BaseModel):
    id: UUID
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password_masked: str
    smtp_sender: str
    updated_at: datetime

    @classmethod
    def from_model(cls, m):
        pwd = m.smtp_password or ""
        if len(pwd) > 8:
            masked = pwd[:2] + "****" + pwd[-2:]
        elif pwd:
            masked = "****"
        else:
            masked = ""

        return cls(
            id=m.id,
            smtp_host=m.smtp_host,
            smtp_port=m.smtp_port,
            smtp_user=m.smtp_user,
            smtp_password_masked=masked,
            smtp_sender=m.smtp_sender,
            updated_at=m.updated_at,
        )


class DigestSettingUpdate(BaseModel):
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_sender: str | None = None
