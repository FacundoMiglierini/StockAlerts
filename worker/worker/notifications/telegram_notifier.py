from __future__ import annotations

import logging

import requests

from .. import config
from .base import Contact

logger = logging.getLogger(__name__)

CHANNEL_TYPE = "TELEGRAM"


class TelegramNotifier:
    """Free — no per-message cost, unlike SMS/WhatsApp providers. Requires
    a bot token (one-time setup via @BotFather) and each user's chat id
    (they get theirs by messaging the bot once — see worker/CLAUDE.md).
    """

    def send(self, contact: Contact, subject: str, body: str) -> None:
        if not config.TELEGRAM_BOT_TOKEN:
            return  # Telegram not set up at all for this deployment.
        chat_id = contact.channels.get(CHANNEL_TYPE)
        if not chat_id:
            return  # This user hasn't linked Telegram.

        response = requests.post(
            f"{config.TELEGRAM_API_BASE_URL}/bot{config.TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": chat_id, "text": f"{subject}\n\n{body}"},
            timeout=10,
        )
        response.raise_for_status()
        logger.info("Sent Telegram message to chat %s: %s", chat_id, subject)
