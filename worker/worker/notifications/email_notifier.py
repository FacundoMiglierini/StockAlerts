from __future__ import annotations

import logging
import smtplib
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from html import escape as html_escape

from .. import config
from .base import ALERT_ICONS, Contact, classify_alert

logger = logging.getLogger(__name__)

# Hex accents matching the frontend's brand blue for neutral alerts
# (frontend/src/index.css's --active), plus green/red for MANUAL_THRESHOLD's
# BUY/SELL phases — see base.py's classify_alert().
_ACCENT_COLORS = {"bullish": "#16a34a", "bearish": "#dc2626", "neutral": "#4f46e5"}


def _render_html(subject: str, body: str) -> str:
    tone = classify_alert(body)
    icon = ALERT_ICONS[tone]
    accent = _ACCENT_COLORS[tone]
    # Inline styles throughout: most mail clients (Gmail included) strip
    # <style> blocks from the <head>, so anything that needs to render
    # consistently has to be attribute-level. A light card on a soft gray
    # page background reads consistently light OR dark client chrome
    # (unlike a dark-themed card, which can invert unpredictably).
    return f"""\
<html>
  <head><meta charset="utf-8"></head>
  <body style="margin:0;padding:24px;background:#f3f4f6;">
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="background:{accent};padding:16px 24px;">
        <span style="font-size:15px;font-weight:700;color:#ffffff;letter-spacing:0.02em;"><span style="margin-right:8px;">{icon}</span>Stock Alerts</span>
      </div>
      <div style="padding:24px;">
        <h1 style="margin:0 0 12px;font-size:17px;color:#111827;">{html_escape(subject)}</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;white-space:pre-wrap;">{html_escape(body)}</p>
      </div>
      <div style="padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
        You're receiving this because you have an active alarm on Stock Alerts.
      </div>
    </div>
  </body>
</html>
"""


class EmailNotifier:
    def send(self, contact: Contact, subject: str, body: str) -> None:
        # 'alternative': mail clients render the LAST part they support, so
        # plain text (universal fallback) is attached before html (what
        # every modern client actually shows).
        message = MIMEMultipart("alternative")
        message["From"] = formataddr(
            (str(Header(config.MAIL_USERNAME, "utf-8")), config.MAIL_EMAIL)
        )
        message["To"] = contact.email
        message["Subject"] = subject
        message.attach(MIMEText(body, "plain"))
        message.attach(MIMEText(_render_html(subject, body), "html"))

        with smtplib.SMTP_SSL(config.MAIL_HOST, config.MAIL_PORT) as server:
            server.login(config.MAIL_EMAIL, config.MAIL_PASSWORD)
            server.sendmail(config.MAIL_EMAIL, contact.email, message.as_string())
        logger.info("Emailed %s: %s", contact.email, subject)
