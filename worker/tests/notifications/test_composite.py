from worker.notifications import Contact, CompositeNotifier

CONTACT = Contact(email="a@b.com", channels={})


class FailingNotifier:
    def __init__(self):
        self.called = False

    def send(self, contact, subject, body):
        self.called = True
        raise RuntimeError("channel is down")


class RecordingNotifier:
    def __init__(self):
        self.calls: list[tuple] = []

    def send(self, contact, subject, body):
        self.calls.append((contact, subject, body))


def test_one_channel_failing_does_not_block_the_others():
    failing = FailingNotifier()
    recording = RecordingNotifier()
    composite = CompositeNotifier([failing, recording])

    # Should not raise, even though `failing` does.
    composite.send(CONTACT, "Stock alert: AAPL", "BUY at $150")

    assert failing.called
    assert recording.calls == [(CONTACT, "Stock alert: AAPL", "BUY at $150")]


def test_all_channels_are_attempted_regardless_of_order():
    first = RecordingNotifier()
    second = RecordingNotifier()
    composite = CompositeNotifier([first, second])

    composite.send(CONTACT, "subject", "body")

    assert len(first.calls) == 1
    assert len(second.calls) == 1
