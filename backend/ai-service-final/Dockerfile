# ─────────────────────────────────────────────────────────────────
# Spring Boot AI service — proxies Anthropic/Groq for the chat widget.
# Multi-stage: maven build → slim JRE runtime.
# ─────────────────────────────────────────────────────────────────

# ── Stage 1: build the fat JAR with Maven ────────────────────────
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# Cache the dependency layer first so source-only changes rebuild fast
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -q clean package -DskipTests

# ── Stage 2: runtime ─────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# curl for healthcheck, tini for signal handling
RUN apk add --no-cache tini curl

COPY --from=build /build/target/*.jar /app/app.jar

# Defaults — secrets must come from docker-compose / docker run -e
ENV SERVER_PORT=8080 \
    SPRING_PROFILES_ACTIVE=docker

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://localhost:8080/api/ai/health >/dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
