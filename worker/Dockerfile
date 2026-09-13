FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

# Dependencies first, cached separately from app code — only reruns when
# pyproject.toml/uv.lock change. --no-install-project: this isn't a
# distributable package (no [build-system]), just a `python -m worker.main`
# script tree, so there's nothing to install for "worker" itself, only its
# dependencies.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-install-project --no-dev

COPY worker ./worker
RUN uv sync --locked --no-dev

CMD ["uv", "run", "python", "-m", "worker.main"]
