# ─── Stage 1: Build (Bun) ─────────────────────────────────────────────────────
FROM oven/bun:1.2-alpine AS builder

WORKDIR /app

# Install all deps (frontend + backend) — layer-cached
COPY package.json bun.lock ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN bun install --frozen-lockfile

# Copy source
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Build frontend (Vite outputs to frontend/dist)
RUN cd frontend && bun run build

# Build backend for Node.js target
RUN cd backend && bun build src/index.ts \
    --outdir dist \
    --target node \
    --sourcemap \
    --external @node-rs/argon2 \
    --external postgres

# Install production-only backend deps in a separate folder for the runtime stage
RUN cd backend && bun install --production --frozen-lockfile

# ─── Stage 2: Runtime (Node 22 Alpine) ────────────────────────────────────────
FROM node:22-alpine AS runtime

RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
USER app

# Backend compiled output
COPY --from=builder --chown=app:app /app/backend/dist ./dist/server

# Migrations folder (read at runtime by drizzle migrator)
COPY --from=builder --chown=app:app /app/backend/src/db/migrations ./dist/server/db/migrations

# Frontend build (served as static files)
COPY --from=builder --chown=app:app /app/frontend/dist ./public

# Production node_modules (includes @node-rs/argon2 prebuilt binaries)
COPY --from=builder --chown=app:app /app/backend/node_modules ./node_modules

EXPOSE 4200

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:4200/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server/index.js"]
