from fastapi import HTTPException, status


class AppException(HTTPException):
    def __init__(self, status_code: int, detail: str, code: str = ""):
        super().__init__(status_code=status_code, detail={"code": code, "message": detail})


class InvalidAPIKey(AppException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED,
                         detail="无效的 API 密钥", code="INVALID_API_KEY")


class InactiveAPIKey(AppException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED,
                         detail="API 密钥已禁用或已过期", code="INACTIVE_API_KEY")


class RateLimitExceeded(AppException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                         detail="请求频率超限", code="RATE_LIMIT_EXCEEDED")


class InsufficientBalance(AppException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_402_PAYMENT_REQUIRED,
                         detail="余额不足", code="INSUFFICIENT_BALANCE")


class ModelNotFound(AppException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND,
                         detail="模型未找到或不可用", code="MODEL_NOT_FOUND")


class UpstreamError(AppException):
    def __init__(self, detail: str = "上游 API 错误"):
        super().__init__(status_code=status.HTTP_502_BAD_GATEWAY,
                         detail=detail, code="UPSTREAM_ERROR")
