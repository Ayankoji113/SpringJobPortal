FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app

# Copy maven files
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .
RUN chmod +x mvnw

# Download dependencies
RUN ./mvnw dependency:go-offline -B

# Copy source code
COPY src ./src

# Build frontend
RUN apk add --no-cache nodejs npm
WORKDIR /app/src/main/frontend
RUN npm ci && npm run build
WORKDIR /app

# Build backend
RUN ./mvnw package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
