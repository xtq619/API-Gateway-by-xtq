from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse, WxLoginRequest, WxBindRequest
from app.services import auth_service
from app.services.rate_limiter import rate_limiter

router = APIRouter(prefix="/auth", tags=["auth"])

AUTH_RATE_LIMIT_RPM = 5


async def _check_auth_rate_limit(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    is_limited = await rate_limiter.is_rate_limited(f"auth:{client_ip}", AUTH_RATE_LIMIT_RPM)
    if is_limited:
        raise HTTPException(status_code=429, detail="请求过于频繁，请稍后再试")


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    await _check_auth_rate_limit(request)
    try:
        result = await auth_service.register_user(db, req.email, req.password, req.name)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    await _check_auth_rate_limit(request)
    try:
        result = await auth_service.login_user(db, req.email, req.password)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/me", response_model=UserResponse)
async def get_me(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    from app.models.user import User
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户未找到")
    return user


@router.post("/wxlogin", response_model=TokenResponse)
async def wx_login(req: WxLoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    await _check_auth_rate_limit(request)
    try:
        result = await auth_service.wx_login_user(db, req.code, req.nickname, req.avatar_url)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/wxbind", response_model=TokenResponse)
async def wx_bind(req: WxBindRequest, request: Request, db: AsyncSession = Depends(get_db)):
    await _check_auth_rate_limit(request)
    try:
        result = await auth_service.wx_bind_user(db, req.code, req.email, req.password)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
