# ─────────────────────────────────────────────────────────────────
# EventHub Node backend (Express + PostgreSQL client)
# Multi-stage: build on full image, run on slim alpine for smaller size.
# ─────────────────────────────────────────────────────────────────

# ── Stage 1: install dependencies ────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund

# ── Stage 2: runtime ─────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# tini for proper PID-1 signal handling (so Ctrl+C / docker stop work cleanly)
RUN apk add --no-cache tini curl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Persistent uploads outside the read-only image — mounted as a volume
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

# Defaults — override at runtime via docker-compose / docker run -e
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=postgresql://eventhub:eventhub@db:5432/eventhub \
    JWT_SECRET=change_me_in_production \
    AI_BASE_URL=http://ai:8080 \
    PAYMENT_BASE_URL=http://payment:8081

EXPOSE 3000

# Container-level healthcheck — orchestrators use this to know when ready.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/events >/dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
