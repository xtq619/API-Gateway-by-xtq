import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from cryptography.fernet import Fernet
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _init_fernet() -> Fernet:
    key = settings.ENCRYPTION_KEY
    if len(key) != 44:
        raise ValueError(
            "ENCRYPTION_KEY 必须是 44 字符的 base64 Fernet 密钥。"
            "生成方式: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    try:
        base64.urlsafe_b64decode(key)
    except Exception:
        raise ValueError("ENCRYPTION_KEY 不是有效的 base64 编码，请提供有效的 Fernet 密钥。")
    return Fernet(key.encode())


_fernet = _init_fernet()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def generate_api_key() -> tuple[str, str, str]:
    raw = secrets.token_hex(24)
    prefix = raw[:8]
    full_key = f"{settings.API_KEY_PREFIX}{raw}"
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()
    return full_key, key_hash, prefix


def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode()).hexdigest()


def encrypt_api_key(plain: str) -> str:
    return _fernet.encrypt(plain.encode()).decode()


def decrypt_api_key(encrypted: str) -> str:
    return _fernet.decrypt(encrypted.encode()).decode()
