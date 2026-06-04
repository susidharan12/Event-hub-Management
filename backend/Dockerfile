# ─────────────────────────────────────────────────────────────────
# EventHub consolidated backend with AI and Payment services
# Multi-service: Node.js backend + Java AI service + Java Payment service
# All services orchestrated with supervisord in a single container.
# ─────────────────────────────────────────────────────────────────

# ── Stage 1: Build AI service JAR ────────────────────────────────
FROM maven:3.9-eclipse-temurin-21 AS ai-build
WORKDIR /build-ai
COPY ai-service-final/pom.xml .
RUN mvn -B -q dependency:go-offline
COPY ai-service-final/src ./src
RUN mvn -B -q clean package -DskipTests

# ── Stage 2: Build Payment service JAR ───────────────────────────
FROM maven:3.9-eclipse-temurin-21 AS payment-build
WORKDIR /build-payment
COPY razorpay-payment-service-final/pom.xml .
RUN mvn -B -q dependency:go-offline
COPY razorpay-payment-service-final/src ./src
RUN mvn -B -q clean package -DskipTests

# ── Stage 3: Install Node dependencies ────────────────────────────
FROM node:20-alpine AS node-deps
WORKDIR /app-node
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund

# ── Stage 4: Runtime — multi-service orchestration ────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Install Node, supervisord, curl, tini, and other utilities
RUN apk add --no-cache \
    nodejs npm \
    supervisor \
    tini \
    curl \
    bash \
    ca-certificates

# Create directories for each service
RUN mkdir -p /app/node-backend /app/ai-service /app/payment-service

# ── Copy Node.js backend ──────────────────────────────────────────
COPY --from=node-deps /app-node/node_modules ./node-backend/node_modules
COPY --chown=nobody:nobody . ./node-backend/
RUN rm -rf ./node-backend/ai-service-final ./node-backend/razorpay-payment-service-final

# ── Copy AI service JAR ───────────────────────────────────────────
COPY --from=ai-build /build-ai/target/*.jar ./ai-service/app.jar

# ── Copy Payment service JAR ──────────────────────────────────────
COPY --from=payment-build /build-payment/target/*.jar ./payment-service/app.jar

# ── Create supervisord configuration ──────────────────────────────
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# ── Environment variables ─────────────────────────────────────────
# Node backend defaults
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=postgresql://eventhub:eventhub@db:5432/eventhub \
    JWT_SECRET=change_me_in_production \
    AI_BASE_URL=http://localhost:8080 \
    PAYMENT_BASE_URL=http://localhost:8081 \
    # Java service defaults
    SERVER_PORT_AI=8080 \
    SERVER_PORT_PAYMENT=8081 \
    SPRING_PROFILES_ACTIVE=docker

EXPOSE 3000 8080 8081

# Container-level healthcheck — check if Node backend is responsive
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/events >/dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
