FROM oven/bun:1.3.10-alpine

WORKDIR /app

# Install deps — layer-cached until lockfile or package.json changes
COPY package.json bun.lock ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN bun install --frozen-lockfile

COPY . .

# Build frontend; place output at /app/public (matches STATIC_ROOT in production)
RUN cd frontend && bun run build && cp -r dist ../public

EXPOSE 4200

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||4200)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "backend/src/index.ts"]
