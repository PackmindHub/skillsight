# Skillsight

Self-hosted observability dashboard for Claude Code skill usage in air-gapped / enterprise environments.

## Prerequisites

- Docker and Docker Compose
- Bun 1.2+ (development mode only)

## Quick start — Docker

```bash
# Build the image
docker build -t skillsight:latest .

# Start (supply required env vars inline or via a .env file)
POSTGRES_PASSWORD=changeme \
JWT_SECRET=change-me-in-production-at-least-32-chars \
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD_INITIAL=admin \
  docker compose up -d
```

Open http://localhost:4200 and sign in with the credentials you set above.

### Required environment variables

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `JWT_SECRET` | HS256 signing secret, minimum 32 characters |
| `ADMIN_EMAIL` | Bootstrap admin email |
| `ADMIN_PASSWORD_INITIAL` | Bootstrap admin password (used once on first start) |

Optional:
- `JWT_SECRET_PREVIOUS` — for zero-downtime secret rotation.
- `PUBLIC_BASE_URL` — when set, locks CORS to this origin and uses it in onboarding instructions. When unset, the app derives the base URL from the incoming request (`Host` / `X-Forwarded-*`), so it works on any URL out of the box.
- `HOST_BIND` (default `0.0.0.0`) and `HOST_PORT` (default `4200`) — control how the production container's port is published on the host.

> **Reverse proxies**: If you put nginx / Caddy / Traefik in front for HTTPS, make sure it forwards `X-Forwarded-Proto` and `X-Forwarded-Host` so the app can build correct URLs and mark cookies `Secure` under HTTPS.

## Development mode

Uses Docker Compose only for infrastructure (PostgreSQL + MailHog). The app runs locally with Bun hot reload.

```bash
# Start infrastructure (PostgreSQL)
docker compose -f docker-compose.dev.yml up -d

# Install dependencies
bun install

# Copy env (defaults work with the dev compose out of the box)
cp .env.example .env

# Run backend + frontend in parallel
bun run dev
```

| Service | URL |
|---|---|
| App | http://localhost:4200 |
| Frontend dev server | http://localhost:5173 |

## Connecting Claude Code

1. Sign in to the dashboard and go to **Tokens** → create an ingestion token.
2. Set these environment variables before running `claude`:

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json   # must be http/json, not grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4200
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <your-token>"
export OTEL_LOG_TOOL_DETAILS=1                  # required for real skill names
```

For org-wide rollout via managed settings (`.claude/settings.json`):

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://<your-host>:4200",
    "OTEL_EXPORTER_OTLP_HEADERS": "Authorization=Bearer <your-token>",
    "OTEL_LOG_TOOL_DETAILS": "1"
  }
}
```

> Without `OTEL_LOG_TOOL_DETAILS=1`, all custom skill activations are reported as `"custom_skill"` instead of their real names.

## Architecture

Single Docker container: a Hono (Node 22) backend serves the React SPA as static files and exposes `POST /v1/logs` for OTLP HTTP/JSON ingestion. PostgreSQL stores events. Database migrations run automatically at startup.
