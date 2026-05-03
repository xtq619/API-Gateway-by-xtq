import logging
from datetime import datetime, timezone
from email.message import EmailMessage

import aiosmtplib

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_digest_email(digest_markdown: str) -> bool:
    """Send daily digest as an HTML email. Returns True on success."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.error("SMTP not configured, cannot send digest email")
        return False

    if not settings.SMTP_RECIPIENTS:
        logger.error("No SMTP recipients configured")
        return False

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Convert markdown to simple HTML for better email rendering
    html_body = _markdown_to_email_html(digest_markdown, today)

    msg = EmailMessage()
    msg["Subject"] = f"AI 日报 — {today}"
    msg["From"] = settings.SMTP_SENDER or settings.SMTP_USER
    msg["To"] = ", ".join(settings.SMTP_RECIPIENTS)
    msg.set_content(digest_markdown)  # Plain text fallback
    msg.add_alternative(html_body, subtype="html")

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=True,
        )
        logger.info("Digest email sent to %s", settings.SMTP_RECIPIENTS)
        return True
    except Exception as e:
        logger.error("Failed to send digest email: %s", e)
        return False


def _markdown_to_email_html(markdown: str, date: str) -> str:
    """Convert digest markdown to a clean HTML email template."""
    import re

    body = markdown

    # Headers
    body = re.sub(r"^# (.+)$", r"<h1>\1</h1>", body, flags=re.MULTILINE)
    body = re.sub(r"^## (.+)$", r"<h2>\1</h2>", body, flags=re.MULTILINE)

    # Bold
    body = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", body)

    # Links
    body = re.sub(r"\[(.+?)\]\((.+?)\)", r'<a href="\2">\1</a>', body)

    # Paragraphs
    body = re.sub(r"^(?!<[hou])(.+)$", r"<p>\1</p>", body, flags=re.MULTILINE)

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
             max-width: 680px; margin: 0 auto; padding: 20px;
             color: #333; line-height: 1.6;">
  <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px;">
    <h1 style="color: #4f46e5; margin: 0;">AI 日报</h1>
    <span style="color: #888;">{date}</span>
  </div>
  {body}
  <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
  <p style="color: #999; font-size: 12px;">由 API Gateway 自动编译推送</p>
</body>
</html>"""
