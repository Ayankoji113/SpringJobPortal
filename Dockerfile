# One image: the React build is bundled into the Spring Boot jar as static resources and served
# by the same process (same origin, so no CORS setup is needed). Deep links fall back to
# index.html in common/config/SpaWebConfig.

# --- Frontend ---
FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY src/main/frontend/package.json src/main/frontend/package-lock.json ./
RUN npm ci
COPY src/main/frontend/ ./
# Relative API base: the SPA and the API share an origin.
ENV VITE_API_URL=/api
RUN npm run build

# --- Backend ---
FROM eclipse-temurin:21-jdk-alpine AS backend
WORKDIR /app
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline
COPY src/main/java src/main/java
COPY src/main/resources src/main/resources
COPY --from=frontend /frontend/dist src/main/resources/static
# Tests need a database; CI runs them (./mvnw clean verify) before an image is built.
RUN ./mvnw -B -q package -DskipTests && cp target/*.jar app.jar

# --- Runtime ---
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S -G app app \
    && mkdir -p /app/uploads && chown app:app /app/uploads
WORKDIR /app
COPY --from=backend /app/app.jar app.jar
USER app
ENV APP_UPLOAD_DIR=/app/uploads
VOLUME /app/uploads
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:8080/actuator/health | grep -q '"UP"' || exit 1
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
