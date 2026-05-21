# syntax=docker/dockerfile:1.7

# ---- base ----
FROM oven/bun:1.3.10-alpine AS base
WORKDIR /app

# Install packmind-cli for the Packmind marketplace integration. It ships as
# the npm package @packmind/cli and exposes a `packmind-cli` bin on PATH; the
# sync gateway spawns it directly. Installed in the base stage so dev (used by
# docker-compose.dev.yml) and runtime both get it without duplication. Override
# the binary path with PACKMIND_CLI_BIN if needed.
RUN apk add --no-cache nodejs npm \
    && npm install -g @packmind/cli \
    && packmind-cli --version

# ---- deps: install ALL dependencies (incl. devDependencies) ----
# Cached as long as the lockfile + workspace package.json files don't change.
FROM base AS deps
COPY package.json bun.lock ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN bun install --frozen-lockfile

# ---- dev: full source on top of full deps (used by docker-compose.dev.yml) ----
FROM deps AS dev
COPY . .

# ---- build: produce the frontend bundle at /app/public, then prune devDeps ----
# STATIC_ROOT in backend/src/app.ts expects ./public when NODE_ENV=production.
# Prune step: with Bun's isolated linker, workspace-local node_modules live at
# backend/node_modules and frontend/node_modules (symlinks into /app/node_modules/.bun).
# We can only get a correct --production layout when the workspace dirs are populated,
# so we install in the build stage (where COPY . . already happened) rather than upfront.
FROM dev AS build
RUN cd frontend && bun run build && mv dist /app/public
RUN rm -rf node_modules backend/node_modules frontend/node_modules \
    && bun install --frozen-lockfile --production

# ---- runtime: slim final image ----
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=4200

# Prod node_modules — three locations because Bun uses the isolated linker:
#   /app/node_modules/.bun       — content-addressed package store
#   /app/backend/node_modules    — symlinks resolving the backend's dependencies
#   /app/frontend/node_modules   — symlinks resolving the frontend's dependencies
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/frontend/node_modules ./frontend/node_modules

# Manifests — the /health endpoint reads version from root package.json.
COPY --from=build /app/package.json ./
COPY --from=build /app/backend/package.json ./backend/
COPY --from=build /app/frontend/package.json ./frontend/

# Frontend bundle + backend source. Bun runs the .ts directly (matches dev).
# backend/tsconfig.json is required at runtime — Bun reads it for the `@/*` path alias.
COPY --from=build /app/public ./public
COPY --from=build /app/backend/tsconfig.json ./backend/
COPY --from=build /app/backend/src ./backend/src

EXPOSE 4200

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||4200)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "backend/src/index.ts"]
