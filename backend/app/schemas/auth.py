import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str

    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('密码长度不能少于8个字符')
        return v


class LoginRequest(BaseModel):
    email: str
    password: str


class WxLoginRequest(BaseModel):
    code: str
    nickname: str = ""
    avatar_url: str = ""


class WxBindRequest(BaseModel):
    code: str
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str
    role: str
    is_active: bool
    avatar_url: str | None = None
    created_at: datetime
