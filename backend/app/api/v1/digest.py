import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_admin
from app.models.digest import DigestSetting
from app.schemas.digest import DigestSettingResponse, DigestSettingUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/digest", tags=["admin-digest"])


async def _get_or_create(db: AsyncSession) -> DigestSetting:
    result = await db.execute(select(DigestSetting).limit(1))
    setting = result.scalar_one_or_none()
    if not setting:
        setting = DigestSetting()
        db.add(setting)
        await db.commit()
        await db.refresh(setting)
    return setting


@router.get("", response_model=DigestSettingResponse)
async def get_smtp_settings(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_admin),
):
    setting = await _get_or_create(db)
    return DigestSettingResponse.from_model(setting)


@router.patch("", response_model=DigestSettingResponse)
async def update_smtp_settings(
    req: DigestSettingUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_admin),
):
    setting = await _get_or_create(db)
    data = req.model_dump(exclude_unset=True)

    if "smtp_password" in data:
        if not data["smtp_password"]:
            del data["smtp_password"]

    for k, v in data.items():
        setattr(setting, k, v)

    await db.commit()
    await db.refresh(setting)
    return DigestSettingResponse.from_model(setting)


@router.post("/test")
async def send_test_email(
    recipient_email: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_admin),
):
    """发送测试邮件到指定地址"""
    from app.services.notifier import send_digest_email

    setting = await _get_or_create(db)

    if not setting.smtp_user or not setting.smtp_password:
        raise HTTPException(status_code=400, detail="请先配置 SMTP 邮箱信息")

    test_content = "# 测试邮件\n\n这是一封测试邮件，用于验证 SMTP 配置是否正确。\n\n如果你收到这封邮件，说明配置成功！"

    success = await send_digest_email(
        digest_markdown=test_content,
        smtp_host=setting.smtp_host,
        smtp_port=setting.smtp_port,
        smtp_user=setting.smtp_user,
        smtp_password=setting.smtp_password,
        smtp_sender=setting.smtp_sender or setting.smtp_user,
        recipients=[recipient_email],
        subject_prefix="[测试] ",
    )

    if success:
        return {"message": "测试邮件已发送"}
    else:
        raise HTTPException(status_code=500, detail="发送失败，请检查 SMTP 配置")
