from fastapi import Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import InactiveAPIKey, InvalidAPIKey
from app.core.security import decode_access_token, hash_api_key
from app.models.api_key import ApiKey


async def get_current_user_id(request: Request) -> str:
    """Extract user_id from JWT for dashboard API calls."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise InvalidAPIKey()
    token = auth[7:]
    payload = decode_access_token(token)
    if payload is None or "sub" not in payload:
        raise InvalidAPIKey()
    return payload["sub"]


async def get_api_key_from_header(
    request: Request,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
) -> ApiKey:
    """Authenticate via API Key for public proxy endpoints."""
    api_key_str = None
    if authorization and authorization.startswith("Bearer "):
        api_key_str = authorization[7:]

    if not api_key_str:
        # Also check x-api-key header
        api_key_str = request.headers.get("x-api-key", "")

    if not api_key_str:
        raise InvalidAPIKey()

    key_hash = hash_api_key(api_key_str)
    result = await db.execute(
        select(ApiKey).where(ApiKey.key_hash == key_hash)
    )
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise InvalidAPIKey()
    if not api_key.is_active:
        raise InactiveAPIKey()

    return api_key
