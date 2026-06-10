---
description: 'Run the full local pre-PR quality gate (frozen-lockfile install, lint, typecheck, tests, build, and optional Docker build) to catch CI and type errors early and ensure your pull request against main passes on the first try.'
---

# Pre-PR Quality Check

Run every gate locally before opening a pull request so CI passes on the first try. CI (`.github/workflows/ci.yml`) runs lint, test, build, and a Docker image build — but it does **not** run `typecheck`, so type errors can slip past CI entirely. This command runs the CI gates plus `typecheck` to close that gap.

## When to Use

- Before creating a pull request against `main`.
- After finishing a feature, to confirm CI will pass.
- When CI fails and you want to reproduce it locally.

## Checkpoints

- Are dependencies installed with a frozen lockfile (`bun install --frozen-lockfile`), matching CI?
- For the Docker step, is the Docker daemon running locally?

## Steps

### 1. Install dependencies (match CI)

Run `bun install --frozen-lockfile` so your local tree matches what CI resolves.

### 2. Lint

Run `bun run lint` (Biome across backend + frontend). Use `bun run check` in `frontend/` if you also want format checking.

### 3. Type check (CI gap — do not skip)

Run `bun run typecheck`. CI does not run this, so it is the most common source of a green CI followed by a broken `main`.

### 4. Test

Run `bun run test` (Bun test runner across all packages).

### 5. Build

Run `bun run build` (Vite frontend, then Bun backend build).

### 6. Optional: production Docker image

If your change touches the Dockerfile or runtime, mirror the CI `docker-build` job: `docker build -t skillsight:ci .`.
