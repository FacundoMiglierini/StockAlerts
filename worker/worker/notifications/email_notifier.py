from __future__ import annotations

import logging
import smtplib
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

from .. import config
from .base import Contact

logger = logging.getLogger(__name__)


class EmailNotifier:
    def send(self, contact: Contact, subject: str, body: str) -> None:
        message = MIMEMultipart()
        message["From"] = formataddr((str(Header(config.MAIL_USERNAME, "utf-8")), config.MAIL_EMAIL))
        message["To"] = contact.email
        message["Subject"] = subject
        message.attach(MIMEText(body, "plain"))

        with smtplib.SMTP_SSL(config.MAIL_HOST, config.MAIL_PORT) as server:
            server.login(config.MAIL_EMAIL, config.MAIL_PASSWORD)
            server.sendmail(config.MAIL_EMAIL, contact.email, message.as_string())
        logger.info("Emailed %s: %s", contact.email, subject)
