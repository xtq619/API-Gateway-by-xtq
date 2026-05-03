import logging
import re
import asyncio
from datetime import datetime, timezone
from email.message import EmailMessage
import smtplib

logger = logging.getLogger(__name__)


async def send_digest_email(
    digest_markdown: str,
    smtp_host: str,
    smtp_port: int,
    smtp_user: str,
    smtp_password: str,
    smtp_sender: str,
    recipients: list[str],
    subject_prefix: str = "",
) -> bool:
    """Send daily digest as an HTML email. Returns True on success."""
    if not smtp_user or not smtp_password:
        logger.error("SMTP not configured, cannot send digest email")
        return False

    if not recipients:
        logger.error("No SMTP recipients configured")
        return False

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    html_body = _markdown_to_email_html(digest_markdown, today)

    msg = EmailMessage()
    msg["Subject"] = f"{subject_prefix}AI 日报 — {today}"
    msg["From"] = smtp_sender or smtp_user
    msg["To"] = ", ".join(recipients)
    msg.set_content(digest_markdown)
    msg.add_alternative(html_body, subtype="html")

    def _send_sync():
        with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30) as server:
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
            # send_message 会自动调用 quit，with 语句确保连接关闭
            return True

    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _send_sync)
        logger.info("Digest email sent to %s", recipients)
        return result
    except smtplib.SMTPAuthenticationError as e:
        logger.error("SMTP auth failed: %s", e)
        return False
    except smtplib.SMTPRecipientsRefused as e:
        logger.error("SMTP recipients refused: %s", e)
        return False
    except smtplib.SMTPException as e:
        logger.error("SMTP error: %s", e)
        return False
    except Exception as e:
        logger.error("Failed to send digest email: %s", e)
        return False


def _markdown_to_email_html(markdown: str, date: str) -> str:
    body = markdown
    body = re.sub(r"^# (.+)$", r"<h1>\1</h1>", body, flags=re.MULTILINE)
    body = re.sub(r"^## (.+)$", r"<h2>\1</h2>", body, flags=re.MULTILINE)
    body = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", body)
    body = re.sub(r"\[(.+?)\]\((.+?)\)", r'<a href="\2">\1</a>', body)
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
