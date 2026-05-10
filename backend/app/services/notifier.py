import logging
import re
import asyncio
from datetime import datetime, timedelta, timezone

_BJ = timezone(timedelta(hours=8))
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
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

    today = datetime.now(_BJ).strftime("%Y-%m-%d")
    html_body = _markdown_to_email_html(digest_markdown, today)

    msg = EmailMessage()
    msg["Subject"] = f"{subject_prefix}今日速递 — {today}"
    msg["From"] = smtp_sender or smtp_user
    msg["To"] = ", ".join(recipients)
    msg.set_content(digest_markdown)
    msg.add_alternative(html_body, subtype="html")

    def _send_sync():
        with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30) as server:
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
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


async def send_encrypted_email(
    encrypted_text: str,
    smtp_host: str,
    smtp_port: int,
    smtp_user: str,
    smtp_password: str,
    smtp_sender: str,
    recipients: list[str],
) -> bool:
    """Send encrypted content as a .txt attachment, disguised as a normal news digest."""
    if not smtp_user or not smtp_password or not recipients:
        return False

    today = datetime.now(_BJ).strftime("%Y-%m-%d")

    msg = MIMEMultipart()
    msg["Subject"] = f"今日速递 — {today}"
    msg["From"] = smtp_sender or smtp_user
    msg["To"] = ", ".join(recipients)

    body_text = (
        "今日资讯已整理完毕，请查收附件原文。\n\n"
        "在线阅读：https://xtq619.xyz/decrypt.html"
    )
    body_html = (
        '<div style="font-family:-apple-system,Segoe UI,sans-serif;'
        'max-width:600px;margin:0 auto;padding:20px;color:#333;line-height:1.8">'
        '<div style="border-bottom:2px solid #4f46e5;padding-bottom:12px;margin-bottom:20px">'
        '<h1 style="color:#4f46e5;margin:0;font-size:20px">今日速递</h1>'
        f'<span style="color:#888;font-size:13px">{today}</span>'
        "</div>"
        "<p>今日资讯已整理完毕，请查收附件原文。</p>"
        '<p><a href="https://xtq619.xyz/decrypt.html" '
        'style="display:inline-block;padding:8px 20px;background:#4f46e5;color:#fff;'
        'text-decoration:none;border-radius:4px;font-size:13px">在线阅读</a></p>'
        "<hr style='border:none;border-top:1px solid #eee;margin:30px 0'>"
        '<p style="color:#999;font-size:12px">由 API Gateway 自动编译推送</p>'
        "</div>"
    )

    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    # Attach encrypted text as .txt file with a normal name
    attachment = MIMEBase("text", "plain")
    attachment.set_payload(encrypted_text.encode("utf-8"))
    encoders.encode_base64(attachment)
    attachment.add_header("Content-Disposition", "attachment", filename="原文.txt")
    msg.attach(attachment)

    def _send_sync():
        with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30) as server:
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
            return True

    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _send_sync)
        logger.info("Encrypted email sent to %s", recipients)
        return result
    except Exception as e:
        logger.error("Failed to send encrypted email: %s", e)
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
    <h1 style="color: #4f46e5; margin: 0;">今日速递</h1>
    <span style="color: #888;">{date}</span>
  </div>
  {body}
  <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
  <p style="color: #999; font-size: 12px;">由 API Gateway 自动编译推送</p>
</body>
</html>"""
