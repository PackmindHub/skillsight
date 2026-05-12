# Contributing to Skillsight

Thanks for taking the time to contribute. This document covers how to get a local development environment running and what we expect from pull requests.

## Prerequisites

- **[Bun](https://bun.sh)** 1.3+ — the runtime and package manager.
- **Docker** with Compose — for PostgreSQL (and optionally the rest of the stack).
- **Git** — to clone the repo.

## Running the stack locally

You have two options. Pick whichever fits your workflow.

### Option A — Bun on the host, PostgreSQL in Docker (recommended)

Fast iteration, full IDE integration, no container layer between your editor and the running code.

```bash
git clone https://github.com/PackmindHub/skills-obs.git
cd skills-obs

# 1. Start PostgreSQL (and only PostgreSQL) on :5432
docker compose -f docker-compose.dev.yml up -d postgres

# 2. Install dependencies and copy the example env
bun install
cp .env.example .env

# 3. Run backend + frontend with hot reload
bun run dev
```

- Backend on http://localhost:4200 (auto-runs migrations on first boot)
- Frontend (Vite dev server) on http://localhost:5173, proxying `/api` to the backend
- Default admin: `admin@example.com` / `admin` (from `.env.example`)

### Option B — Everything in Docker

If you'd rather not install Bun on your host, or you want to validate the Docker image's `dev` stage:

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts PostgreSQL, the backend (`:4200`, hot reload via `bun --hot`), and the frontend (`:5173`, Vite dev server). Source files are bind-mounted so edits trigger reloads. The backend is reachable at http://localhost:4200, the frontend at http://localhost:5173.

To rebuild the dev image after changing `package.json` or the Dockerfile:

```bash
docker compose -f docker-compose.dev.yml build
```

## Common commands

All from the repo root unless noted.

```bash
bun run dev          # Backend + frontend with hot reload
bun run build        # Build frontend (Vite) then backend
bun run lint         # Biome lint on both packages
bun run typecheck    # TypeScript strict check on all packages
bun run test         # Run tests across all packages
```

Run a single test file:

```bash
bun test backend/src/path/to/file.test.ts
bun test frontend/src/path/to/file.test.tsx
```

## Database changes

The schema is the single source of truth at `backend/src/db/schema.ts`. After editing it:

```bash
cd backend
bun run migrate:generate   # Generate a new migration from the schema delta
bun run migrate:run        # Apply pending migrations (also runs at startup)
```

Commit the generated SQL files under `backend/src/db/migrations/` along with the schema change. Do **not** hand-author migration files or edit `meta/_journal.json` — the journal's `when` timestamps must stay strictly increasing or migrations get silently skipped in production.

## Architecture

The backend follows a hexagonal layout (`domain` / `application` / `infrastructure` / `http`). The frontend is a React 18 SPA with React Router v7 and Tailwind v4. Dependencies are injected at startup via `backend/src/bootstrap/compose.ts`. See [README.md → Architecture](README.md#architecture) for a one-paragraph overview.

## Pull requests

- Open against `main`. CI runs `bun install` → `lint` → `test` → `build`; please make sure it's green before requesting review.
- Keep PRs focused. One unrelated cleanup in a feature PR is fine; ten is not.
- Match the surrounding code style — Biome handles formatting; just run `bun run lint`.
- Update or add tests for behavior changes. Use Bun's test runner (`bun:test`); frontend tests use `happy-dom` (configured in `frontend/src/test-setup.ts`).

## Reporting issues

Bug reports and feature requests: [GitHub Issues](https://github.com/PackmindHub/skills-obs/issues). Please include the version (visible in the Sidebar or returned by `/health`), how you're ingesting events (OTLP push vs Loki pull), and steps to reproduce.
