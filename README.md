# Skillsight

**A self-hosted dashboard for understanding how your team uses Claude Code skills.**

*[Screenshot: Dashboard hero — top movers and weekly trend]*

Skillsight is small, open-source, and runs entirely on your own infrastructure with one `docker compose up`. No SaaS, no outbound telemetry — Claude Code activity stays on your servers, period.

## Table of contents

- [What it does](#what-it-does)
- [Why Skillsight exists](#why-skillsight-exists)
- [What you get](#what-you-get)
- [The Skills / Plugins / Marketplaces model](#the-skills--plugins--marketplaces-model)
- [Use cases](#use-cases)
- [Quick start](#quick-start)
- [Connecting Claude Code](#connecting-claude-code)
- [Ingesting from Loki instead](#ingesting-from-loki-instead)
- [Marketplace sources](#marketplace-sources)
- [Development mode](#development-mode)
- [Architecture](#architecture)

## What it does

Skillsight does **three** things:

1. **Collects** Claude Code skill-activation events — directly via OTLP, or pulled from an existing Loki stack.
2. **Correlates** them against your plugins and marketplaces (including private, git-backed ones).
3. **Shows you** which skills, plugins, and marketplaces are actually being used.

That's it. No agents, no auto-remediation, no LLM-on-top — a clean, focused view of skill usage with the right relationships to make sense of it.

## Why Skillsight exists

Claude Code emits OpenTelemetry events for every skill activation, but it ships no dashboard for the team rolling skills out. Generic observability stacks (Grafana, Datadog, …) accept the events fine, but they don't understand the **skill / plugin / marketplace** model — so curating an internal skills catalog from raw logs is painful.

Skillsight is the missing thin layer: small enough to deploy in an afternoon, opinionated enough to be useful out of the box.

**Who it's for:** developer-experience teams, AI-enablement teams, and anyone curating a skills marketplace for an organization. It's built to support adoption and curation, not to surveil developers.

## What you get

*[Screenshot: Skills table with status badges and last-used column]*

- **Dashboard** — top-moving skills, week-over-week trends, activation counts split by trigger (user slash, Claude-proactive, nested).
- **Skills** — every skill ever activated, with status (`to_review` / `approved` / `removed`), last-used timestamp, drill-down for triggers and users.
- **Plugins** — read-only list of plugins that own activated skills.
- **Marketplaces** — list of marketplaces, synced from git sources or implicit from inline plugins.
- **Tokens** — manage bearer tokens used for OTLP ingestion.
- **Settings → Integrations** — Loki integrations for pull-based ingestion.
- **Audit log** — every write operation, with CSV export.

## The Skills / Plugins / Marketplaces model

*[Screenshot: Marketplace detail showing nested plugins and skills]*

The relationships are loose on purpose, because Claude Code is loose about them:

- A **skill** may belong to a **plugin**, or be standalone — the bundled built-ins aren't owned by any plugin.
- A **plugin** may belong to a **marketplace**, or be inline / local.
- **Status flows downward**: marketplace → plugin → skill. Approve a marketplace, and its plugins and skills inherit the approval.
- **Bundled skills auto-display as `approved`** so the built-ins don't sit in your review queue forever.
- **Status is informational only.** It organizes your view inside Skillsight; it does **not** gate or allow-list anything on the developer's machine.

## Use cases

- **Spot under-used skills** (e.g. a security or commit-conventions skill) → train the team or rework the skill.
- **Curate the internal marketplace** — promote what's popular, retire what isn't, justify investments.
- **Discover third-party usage** — see which public marketplaces and plugins developers are actually pulling in, and decide whether to officially adopt or steer away.
- **Understand audiences** — which user populations use which skills.

## Quick start

```bash
docker build -t skillsight:latest .

POSTGRES_PASSWORD=changeme \
JWT_SECRET=change-me-in-production-at-least-32-chars \
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD_INITIAL=admin \
  docker compose up -d
```

Open http://localhost:4200 and sign in. On first login you're redirected to `/onboarding`, which auto-mints an ingestion token and renders the exact env block to point Claude Code at this instance.

### Required environment variables

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `JWT_SECRET` | HS256 signing secret, minimum 32 characters |
| `ADMIN_EMAIL` | Bootstrap admin email |
| `ADMIN_PASSWORD_INITIAL` | Bootstrap admin password (used once on first start) |

Optional: `JWT_SECRET_PREVIOUS` for zero-downtime rotation, `PUBLIC_BASE_URL` to lock CORS to one origin, `HOST_BIND` / `HOST_PORT` to change the published port.

## Connecting Claude Code

*[Screenshot: Onboarding page showing the auto-generated env block]*

Point Claude Code at Skillsight's OTLP endpoint:

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json   # must be http/json, not grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4200/api/v0/telemetry/v1/logs
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
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://<your-host>:4200/api/v0/telemetry/v1/logs",
    "OTEL_EXPORTER_OTLP_HEADERS": "Authorization=Bearer <your-token>",
    "OTEL_LOG_TOOL_DETAILS": "1"
  }
}
```

> Without `OTEL_LOG_TOOL_DETAILS=1`, all custom skill activations show up as `"custom_skill"` instead of their real names.

## Ingesting from Loki instead

If your Claude Code fleet already ships logs to a Grafana Loki stack, Skillsight can pull events from Loki rather than receive them directly. Configure integrations in **Settings → Integrations**:

- `url` — Loki base URL.
- `lokiQuery` — LogQL query selecting Claude Code telemetry (a sensible default is pre-filled).
- `syncIntervalMs` — polling interval (min 5 s, default 30 s).
- Optional basic-auth, encrypted at rest.

A scheduler polls each enabled integration and feeds the parsed events into the same pipeline as direct OTLP push.

## Marketplace sources

To populate the marketplace and plugin tables without waiting for events, register **git-backed marketplace sources**. Skillsight clones the repo on a schedule, reads its `marketplace.json`, and upserts the marketplace, its plugins, and their skills.

Configurable fields per source:

- `gitUrl` — repo URL.
- `accessToken` — optional, encrypted at rest, for private repos.
- `branch` — optional; defaults to the repo's default branch.
- `syncIntervalMs` — polling interval (min 60 s, default 1 h).
- `enabled` — pause / resume without deleting.
- `importPluginsAndSkills` — auto-import discovered plugins and skills.

> Marketplace sources are managed via the API today (`/api/marketplace-sources`); the `Marketplaces` page is a read-only view of the synced results.

## Development mode

```bash
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL only
bun install
cp .env.example .env
bun run dev                                       # backend on :4200, frontend on :5173
```

## Architecture

A single Docker container: a Hono (Bun) backend serves the React SPA as static files and exposes `POST /api/v0/telemetry/v1/logs` for OTLP HTTP/JSON ingestion. PostgreSQL stores everything (users, tokens, events, skills, plugins, marketplaces, audit log). Migrations run automatically at startup. Two background schedulers handle Loki polling and marketplace-source git sync.

**Everything stays on your infrastructure.** Skillsight never phones home, never ships events anywhere, and has no external runtime dependencies beyond your PostgreSQL.
