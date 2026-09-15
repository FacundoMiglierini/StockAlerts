from email import message_from_string
from unittest.mock import MagicMock

from worker import config
from worker.notifications.base import Contact
from worker.notifications.email_notifier import EmailNotifier


def _send_and_capture(monkeypatch, subject, body):
    monkeypatch.setattr(config, "MAIL_HOST", "smtp.example.com")
    monkeypatch.setattr(config, "MAIL_PORT", 465)
    monkeypatch.setattr(config, "MAIL_USERNAME", "Stock Alerts")
    monkeypatch.setattr(config, "MAIL_EMAIL", "alerts@example.com")
    monkeypatch.setattr(config, "MAIL_PASSWORD", "secret")

    mock_server = MagicMock()
    mock_server.__enter__.return_value = mock_server
    monkeypatch.setattr(
        "worker.notifications.email_notifier.smtplib.SMTP_SSL",
        MagicMock(return_value=mock_server),
    )

    EmailNotifier().send(Contact(email="user@example.com", channels={}), subject, body)

    mock_server.login.assert_called_once_with("alerts@example.com", "secret")
    raw = mock_server.sendmail.call_args[0][2]
    return message_from_string(raw)


def _html_part(message) -> str:
    part = next(p for p in message.get_payload() if p.get_content_type() == "text/html")
    return part.get_payload(decode=True).decode()


def test_sends_both_plain_and_html_parts(monkeypatch):
    message = _send_and_capture(
        monkeypatch, "Stock alert: AAPL", "RSI(14) at 72.0, overbought"
    )

    assert message.is_multipart()
    parts = {
        p.get_content_type(): p.get_payload(decode=True).decode()
        for p in message.get_payload()
    }
    assert "text/plain" in parts
    assert "text/html" in parts
    assert "RSI(14) at 72.0, overbought" in parts["text/plain"]
    assert "RSI(14) at 72.0, overbought" in parts["text/html"]
    assert "Stock alert: AAPL" in parts["text/html"]


def test_html_part_comes_last_so_html_capable_clients_prefer_it(monkeypatch):
    message = _send_and_capture(monkeypatch, "s", "b")

    assert [p.get_content_type() for p in message.get_payload()] == [
        "text/plain",
        "text/html",
    ]


def test_buy_gets_green_accent_sell_gets_red_and_other_strategies_stay_neutral(
    monkeypatch,
):
    buy = _send_and_capture(
        monkeypatch, "Stock alert: AAPL", "BUY AAPL: price hit trigger US$150.00"
    )
    sell = _send_and_capture(
        monkeypatch, "Stock alert: AAPL", "SELL AAPL: price hit target US$180.00"
    )
    neutral = _send_and_capture(
        monkeypatch, "Stock alert: AAPL", "AAPL: RSI(14) at 72.0, overbought"
    )

    assert "#16a34a" in _html_part(buy)
    assert "#dc2626" in _html_part(sell)
    assert "#4f46e5" in _html_part(neutral)


def test_escapes_html_special_characters_in_subject_and_body(monkeypatch):
    message = _send_and_capture(
        monkeypatch, "Stock alert: <AAPL>", "price < 150 & rising"
    )

    html = _html_part(message)
    assert "<AAPL>" not in html
    assert "&lt;AAPL&gt;" in html
    assert "&amp;" in html
