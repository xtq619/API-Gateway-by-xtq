import logging
import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models.billing import BillingAccount
from app.models.user import User

logger = logging.getLogger(__name__)


async def register_user(db: AsyncSession, email: str, password: str, name: str) -> dict:
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise ValueError("该邮箱已注册")

    user = User(
        id=uuid.uuid4(),
        email=email,
        password_hash=hash_password(password),
        name=name,
    )
    db.add(user)

    # Create billing account with initial balance
    billing = BillingAccount(user_id=user.id, balance=10.0)
    db.add(billing)

    await db.flush()
    await db.refresh(user)

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}


async def login_user(db: AsyncSession, email: str, password: str) -> dict:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise ValueError("邮箱或密码错误")
    if not user.is_active:
        raise ValueError("账号已被禁用")

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}


async def _code2session(code: str) -> dict:
    """Call WeChat code2Session API to get openid."""
    if not settings.WX_APPID or not settings.WX_SECRET:
        raise ValueError("微信登录未配置（缺少 WX_APPID 或 WX_SECRET）")

    url = "https://api.weixin.qq.com/sns/jscode2session"
    params = {
        "appid": settings.WX_APPID,
        "secret": settings.WX_SECRET,
        "js_code": code,
        "grant_type": "authorization_code",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params, timeout=10)
        data = resp.json()

    if "errcode" in data:
        logger.warning("WeChat code2Session error: %s", data)
        raise ValueError(f"微信登录失败: {data.get('errmsg', '未知错误')}")

    openid = data.get("openid")
    if not openid:
        raise ValueError("微信登录失败: 未获取到 openid")

    return {"openid": openid}


async def wx_login_user(db: AsyncSession, code: str, nickname: str = "", avatar_url: str = "") -> dict:
    """Login or register via WeChat code."""
    session_data = await _code2session(code)
    openid = session_data["openid"]

    # Check if user with this openid exists
    result = await db.execute(select(User).where(User.wx_openid == openid))
    user = result.scalar_one_or_none()

    if not user:
        # Create new user with openid
        user = User(
            id=uuid.uuid4(),
            email=f"wx_{openid[:8]}@wx.miniprogram",
            password_hash=hash_password(uuid.uuid4().hex),
            name=nickname or "微信用户",
            wx_openid=openid,
            avatar_url=avatar_url or None,
        )
        db.add(user)
        billing = BillingAccount(user_id=user.id, balance=10.0)
        db.add(billing)
        await db.flush()
        await db.refresh(user)
    else:
        # Update nickname and avatar if provided
        if nickname and nickname != user.name:
            user.name = nickname
        if avatar_url:
            user.avatar_url = avatar_url
        await db.flush()

    if not user.is_active:
        raise ValueError("账号已被禁用")

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}


async def wx_bind_user(db: AsyncSession, code: str, email: str, password: str) -> dict:
    """Bind WeChat openid to existing email account."""
    session_data = await _code2session(code)
    openid = session_data["openid"]

    # Check if openid already bound
    result = await db.execute(select(User).where(User.wx_openid == openid))
    if result.scalar_one_or_none():
        raise ValueError("该微信已绑定其他账号")

    # Find user by email
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise ValueError("邮箱或密码错误")
    if not user.is_active:
        raise ValueError("账号已被禁用")

    user.wx_openid = openid
    await db.flush()

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}
