#!/usr/bin/env bash
# Redeploys Postgres/backend/worker on the home server after new commits.
# The frontend is not handled here — Netlify rebuilds it on push to main.
#
# Steps (see root CLAUDE.md, "Deploying for free", for the why of each):
#   1. git pull --ff-only
#   2. pg_dump backup (a deploy may carry a migration; backend applies it on boot)
#   3. rebuild + recreate postgres/backend, wait for GET /health
#   4. recreate tailscale if it's running — it shares backend's network
#      namespace (network_mode: service:backend), which dies with the old
#      backend container, so Funnel silently stops answering otherwise
#   5. rebuild the worker image only — host cron runs it via `compose run`,
#      so the next run picks it up; never `up -d worker` in production
#
# Usage: scripts/deploy.sh [--no-pull] [--no-backup] [--prune] [--dry-run]
#   --no-pull    deploy the current checkout as-is
#   --no-backup  skip the pg_dump
#   --prune      afterwards, remove dangling images left behind by --build
#   --dry-run    print the commands instead of running them
#
# Env overrides: BACKUP_DIR (default ~/stockalerts-backups),
#   HEALTH_URL (default http://localhost:3000/health),
#   HEALTH_TIMEOUT seconds (default 90).

set -euo pipefail

PULL=1 BACKUP=1 PRUNE=0 DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --no-pull) PULL=0 ;;
    --no-backup) BACKUP=0 ;;
    --prune) PRUNE=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h | --help)
      sed -n '2,/^$/s/^# \{0,1\}//p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (see --help)" >&2
      exit 2
      ;;
  esac
done

BACKUP_DIR="${BACKUP_DIR:-$HOME/stockalerts-backups}"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/health}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-90}"

cd "$(dirname "$0")/.."

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
run() {
  if [ "$DRY_RUN" = 1 ]; then
    printf '[dry-run] %s\n' "$*"
  else
    "$@"
  fi
}
die() {
  printf '\033[31mError: %s\033[0m\n' "$*" >&2
  exit 1
}

BACKUP_FILE=""
on_error() {
  printf '\n\033[31mDeploy failed.\033[0m Inspect with: docker compose logs --tail=100 backend\n' >&2
  if [ -n "$BACKUP_FILE" ]; then
    printf 'Pre-deploy database backup: %s\n' "$BACKUP_FILE" >&2
  fi
}
trap on_error ERR

step "Preflight"
command -v docker >/dev/null || die "docker not found"
docker info >/dev/null 2>&1 || die "docker daemon not reachable"
command -v curl >/dev/null || die "curl not found (needed for the health check)"
[ -f .env ] || die ".env missing — cp .env.example .env and fill it in"

if [ "$PULL" = 1 ]; then
  step "Pulling latest code"
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    die "tracked files have local changes; commit/stash them or use --no-pull"
  fi
  run git pull --ff-only
fi
echo "Deploying $(git log -1 --format='%h %s')"

if [ "$BACKUP" = 1 ]; then
  step "Backing up the database"
  if [ -n "$(docker compose ps --status running -q postgres)" ]; then
    BACKUP_FILE="$BACKUP_DIR/stockalerts-$(date +%Y%m%d-%H%M%S).sql.gz"
    run mkdir -p "$BACKUP_DIR"
    if [ "$DRY_RUN" = 1 ]; then
      echo "[dry-run] docker compose exec -T postgres pg_dump ... | gzip > $BACKUP_FILE"
    else
      # Credentials come from the container's own env, so this works with
      # whatever POSTGRES_USER/POSTGRES_DB .env sets.
      docker compose exec -T postgres sh -c \
        'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip >"$BACKUP_FILE"
      echo "Saved $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
    fi
  else
    echo "postgres isn't running (first deploy?) — nothing to back up"
  fi
fi

step "Rebuilding postgres + backend (migrations apply on backend boot)"
run docker compose up -d --build postgres backend

step "Waiting for $HEALTH_URL"
if [ "$DRY_RUN" = 1 ]; then
  echo "[dry-run] poll $HEALTH_URL for up to ${HEALTH_TIMEOUT}s"
else
  deadline=$((SECONDS + HEALTH_TIMEOUT))
  until curl -fsS "$HEALTH_URL" >/dev/null 2>&1; do
    if [ "$SECONDS" -ge "$deadline" ]; then
      docker compose logs --tail=50 backend >&2
      die "backend not healthy after ${HEALTH_TIMEOUT}s"
    fi
    sleep 3
  done
  echo "Backend healthy"
fi

step "Tailscale Funnel"
if [ -n "$(docker compose --profile funnel ps -a -q tailscale)" ]; then
  run docker compose --profile funnel up -d --force-recreate tailscale
  if [ "$DRY_RUN" = 0 ]; then
    sleep 5
    docker compose exec tailscale tailscale funnel status ||
      echo "Warning: couldn't read funnel status — check: docker compose logs tailscale" >&2
  fi
else
  echo "No tailscale container — skipping (set it up once per root CLAUDE.md Part A)"
fi

step "Rebuilding the worker image (host cron uses it on its next run)"
run docker compose build worker

if [ "$PRUNE" = 1 ]; then
  step "Removing dangling images"
  run docker image prune -f
fi

step "Done"
echo "Frontend: Netlify builds from main on push — check its deploy status."
echo "Optional immediate worker pass:"
echo "  docker compose run --rm worker uv run --no-dev python -m worker.run"
