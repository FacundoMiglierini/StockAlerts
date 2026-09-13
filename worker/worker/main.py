"""Long-lived loop wrapper around run_once(), for the docker-compose
service. A plain cron job calling `python -m worker.run` once per invocation
is an equally valid way to run this (see worker/CLAUDE.md) — pick whichever
fits the deployment.
"""

from __future__ import annotations

import logging
import time

from . import config
from .run import run_once

logger = logging.getLogger(__name__)


def main() -> None:
    while True:
        try:
            run_once()
        except Exception:
            logger.exception("Unhandled error during evaluation pass")
        time.sleep(config.POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
