# ─────────────────────────────────────────────────────────────────
# Spring Boot Razorpay payment service — order creation, signature
# verification, and manual UPI confirmation endpoints.
# ─────────────────────────────────────────────────────────────────

# ── Stage 1: build the fat JAR with Maven ────────────────────────
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -q clean package -DskipTests

# ── Stage 2: runtime ─────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN apk add --no-cache tini curl

COPY --from=build /build/target/*.jar /app/app.jar

ENV SERVER_PORT=8081 \
    SPRING_PROFILES_ACTIVE=docker

EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://localhost:8081/api/payment/health >/dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
