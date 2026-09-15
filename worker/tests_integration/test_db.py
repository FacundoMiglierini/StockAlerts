from worker import db
from worker.enums import AlarmStatus, Market, NotificationStatus

from .conftest import fetch_alarm_row, insert_alarm, insert_channel, insert_user


class TestFetchActiveAlarmsBySymbol:
    def test_returns_only_active_alarms_grouped_by_symbol(self, engine):
        user_id = insert_user(engine)
        insert_alarm(engine, user_id=user_id, ticker="AAPL", status=AlarmStatus.ACTIVE)
        insert_alarm(engine, user_id=user_id, ticker="AAPL", status=AlarmStatus.ACTIVE)
        insert_alarm(engine, user_id=user_id, ticker="MSFT", status=AlarmStatus.ACTIVE)
        insert_alarm(
            engine, user_id=user_id, ticker="GOOGL", status=AlarmStatus.TRIGGERED
        )
        insert_alarm(
            engine, user_id=user_id, ticker="TSLA", status=AlarmStatus.DISABLED
        )

        grouped = db.fetch_active_alarms_by_symbol()

        assert set(grouped.keys()) == {"AAPL", "MSFT"}
        assert len(grouped["AAPL"]) == 2
        assert len(grouped["MSFT"]) == 1

    def test_same_ticker_on_different_markets_resolves_to_different_symbols(
        self, engine
    ):
        # A US-listed ADR and a same-named company or CEDEAR listed on BYMA can
        # share a raw ticker — they must never be grouped (and therefore
        # price-fetched) together.
        user_id = insert_user(engine)
        insert_alarm(engine, user_id=user_id, ticker="AAPL", market=Market.USA)
        insert_alarm(engine, user_id=user_id, ticker="AAPL", market=Market.BYMA)

        grouped = db.fetch_active_alarms_by_symbol()

        assert set(grouped.keys()) == {"AAPL", "AAPL.BA"}
        assert len(grouped["AAPL"]) == 1
        assert len(grouped["AAPL.BA"]) == 1
        assert grouped["AAPL"][0].market == Market.USA
        assert grouped["AAPL.BA"][0].market == Market.BYMA

    def test_alarm_fields_round_trip_correctly(self, engine):
        user_id = insert_user(engine)
        alarm_id = insert_alarm(
            engine,
            user_id=user_id,
            ticker="AAPL",
            strategy_type="RSI",
            params={"period": 21, "oversold": 25, "overbought": 75},
            notification_status=NotificationStatus.NOT_NOTIFIED,
            market=Market.USA,
        )

        grouped = db.fetch_active_alarms_by_symbol()
        alarm = grouped["AAPL"][0]

        assert alarm.id == alarm_id
        assert alarm.user_id == user_id
        assert alarm.strategy_type == "RSI"
        assert alarm.params == {"period": 21, "oversold": 25, "overbought": 75}
        assert alarm.notification_status == NotificationStatus.NOT_NOTIFIED
        assert alarm.market == Market.USA

    def test_empty_database_returns_an_empty_mapping(self):
        assert db.fetch_active_alarms_by_symbol() == {}


class TestApplyAlarmResult:
    def test_updates_notified_and_status(self, engine):
        user_id = insert_user(engine)
        alarm_id = insert_alarm(
            engine,
            user_id=user_id,
            status=AlarmStatus.ACTIVE,
            notification_status=NotificationStatus.NOT_NOTIFIED,
        )

        db.apply_alarm_result(
            alarm_id,
            notification_status=NotificationStatus.NOTIFIED_ONCE,
            status=AlarmStatus.ACTIVE,
        )

        row = fetch_alarm_row(engine, alarm_id)
        assert row["notificationStatus"] == NotificationStatus.NOTIFIED_ONCE
        assert row["status"] == AlarmStatus.ACTIVE
        assert row["triggeredAt"] is None

    def test_sets_triggered_at_when_status_becomes_triggered(self, engine):
        user_id = insert_user(engine)
        alarm_id = insert_alarm(
            engine,
            user_id=user_id,
            status=AlarmStatus.ACTIVE,
            notification_status=NotificationStatus.NOTIFIED_ONCE,
        )

        db.apply_alarm_result(
            alarm_id,
            notification_status=NotificationStatus.NOTIFIED_TWICE,
            status=AlarmStatus.TRIGGERED,
        )

        row = fetch_alarm_row(engine, alarm_id)
        assert row["status"] == AlarmStatus.TRIGGERED
        assert row["triggeredAt"] is not None

    def test_a_triggered_alarm_then_drops_out_of_the_active_query(self, engine):
        user_id = insert_user(engine)
        alarm_id = insert_alarm(
            engine,
            user_id=user_id,
            ticker="AAPL",
            status=AlarmStatus.ACTIVE,
            notification_status=NotificationStatus.NOTIFIED_ONCE,
        )

        db.apply_alarm_result(
            alarm_id,
            notification_status=NotificationStatus.NOTIFIED_TWICE,
            status=AlarmStatus.TRIGGERED,
        )

        assert db.fetch_active_alarms_by_symbol() == {}


class TestFetchUserContact:
    def test_returns_email_and_linked_channels(self, engine):
        user_id = insert_user(engine, email="a@b.com")
        insert_channel(
            engine, user_id=user_id, channel_type="TELEGRAM", external_id="999"
        )

        contact = db.fetch_user_contact(user_id)

        assert contact.email == "a@b.com"
        assert contact.channels == {"TELEGRAM": "999"}

    def test_empty_channels_dict_when_nothing_is_linked(self, engine):
        user_id = insert_user(engine)

        contact = db.fetch_user_contact(user_id)

        assert contact.channels == {}

    def test_returns_none_for_a_user_id_that_does_not_exist(self):
        assert db.fetch_user_contact("00000000-0000-0000-0000-000000000000") is None
