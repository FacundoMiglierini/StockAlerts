from unittest.mock import MagicMock

from worker import config
from worker.notifications.base import Contact
from worker.notifications.telegram_notifier import TelegramNotifier


def test_noop_when_bot_token_is_not_configured(monkeypatch):
    monkeypatch.setattr(config, "TELEGRAM_BOT_TOKEN", None)
    mock_post = MagicMock()
    monkeypatch.setattr(
        "worker.notifications.telegram_notifier.requests.post", mock_post
    )

    TelegramNotifier().send(
        Contact(email="a@b.com", channels={"TELEGRAM": "123"}), "s", "b"
    )

    mock_post.assert_not_called()


def test_noop_when_this_user_has_not_linked_telegram(monkeypatch):
    monkeypatch.setattr(config, "TELEGRAM_BOT_TOKEN", "bot-token")
    mock_post = MagicMock()
    monkeypatch.setattr(
        "worker.notifications.telegram_notifier.requests.post", mock_post
    )

    TelegramNotifier().send(Contact(email="a@b.com", channels={}), "s", "b")

    mock_post.assert_not_called()


def test_sends_to_the_linked_chat_id_when_configured(monkeypatch):
    monkeypatch.setattr(config, "TELEGRAM_BOT_TOKEN", "bot-token")
    mock_response = MagicMock()
    mock_post = MagicMock(return_value=mock_response)
    monkeypatch.setattr(
        "worker.notifications.telegram_notifier.requests.post", mock_post
    )

    TelegramNotifier().send(
        Contact(email="a@b.com", channels={"TELEGRAM": "999"}),
        "Stock alert",
        "BUY AAPL",
    )

    mock_post.assert_called_once()
    url, kwargs = mock_post.call_args[0][0], mock_post.call_args[1]
    assert url == "https://api.telegram.org/botbot-token/sendMessage"
    assert kwargs["json"]["chat_id"] == "999"
    assert kwargs["json"]["parse_mode"] == "HTML"
    assert "Stock alert" in kwargs["json"]["text"]
    assert "BUY AAPL" in kwargs["json"]["text"]
    mock_response.raise_for_status.assert_called_once()


def test_bolds_the_subject_and_icon_codes_by_alert_direction(monkeypatch):
    monkeypatch.setattr(config, "TELEGRAM_BOT_TOKEN", "bot-token")
    mock_post = MagicMock(return_value=MagicMock())
    monkeypatch.setattr(
        "worker.notifications.telegram_notifier.requests.post", mock_post
    )

    TelegramNotifier().send(
        Contact(email="a@b.com", channels={"TELEGRAM": "999"}),
        "Stock alert: AAPL",
        "BUY AAPL: price hit trigger US$150.00",
    )

    text = mock_post.call_args[1]["json"]["text"]
    assert text.startswith("<b>\U0001f4c8 Stock alert: AAPL</b>\n\n")


def test_escapes_html_special_characters_in_subject_and_body(monkeypatch):
    monkeypatch.setattr(config, "TELEGRAM_BOT_TOKEN", "bot-token")
    mock_post = MagicMock(return_value=MagicMock())
    monkeypatch.setattr(
        "worker.notifications.telegram_notifier.requests.post", mock_post
    )

    TelegramNotifier().send(
        Contact(email="a@b.com", channels={"TELEGRAM": "999"}),
        "Stock alert: <AAPL>",
        "price < 150 & rising",
    )

    text = mock_post.call_args[1]["json"]["text"]
    assert "<AAPL>" not in text
    assert "&lt;AAPL&gt;" in text
    assert "&amp;" in text
