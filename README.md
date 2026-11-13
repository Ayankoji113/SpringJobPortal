# Spring Job Portal

A job board built with Spring Boot and React. Seekers search verified postings, apply and follow each application; employers post jobs and must answer applicants within 14 days, and their response record is shown publicly. Admins review postings before they go live.

## Features

**Job seekers:** JWT sign-up and login, profile with skills and resume, job search and filters, saved jobs, applying with a cover letter, applying to up to 5 picked recommendations at once (20 applications per day), a status timeline for every application, withdrawing an application, skill-match scores and a salary estimate.

**Employers:** company profiles, job postings (reviewed by an admin before they are public), an applicant pipeline (`PENDING → REVIEWED → INTERVIEW → OFFERED → ACCEPTED`, or `REJECTED`), email reminders before the 14-day deadline, and a dashboard.

**Admins:** a review queue for new and edited postings (publish, reject, suspend), featuring jobs, banning users, and an action log.

Notifications are in-app (polled) and by email.

## Tech stack

- Backend: Spring Boot 3.4 (Java 21), Spring Security with JWT, Spring Data JPA, PostgreSQL, Flyway, Spring AI (Gemini, salary narrative only), springdoc OpenAPI, Actuator.
- Frontend: React 19, Vite, React Router, TanStack Query, Axios. Design system in [`src/main/frontend/DESIGN.md`](src/main/frontend/DESIGN.md).

## Local development

Prerequisites: JDK 21 or newer, Node.js 20 or newer, PostgreSQL with a database named `JobPortalDB`.

1. Put local secrets in `config/application.properties` (git-ignored, read automatically):

   ```properties
   spring.datasource.password=your-postgres-password
   jwt.secret=base64-key-from-openssl-rand-base64-64
   # optional
   app.admin.email=you@example.com
   spring.ai.openai.api-key=your-gemini-key
   ```

   Environment variables (`SPRING_DATASOURCE_PASSWORD`, `JWT_SECRET`, ...) work too; see `.env.example`.

2. Backend: `./mvnw spring-boot:run` (Windows: `mvnw.cmd spring-boot:run`). It starts on http://localhost:8080 and Flyway creates or upgrades the schema.
3. Frontend: `cd src/main/frontend && npm install && npm run dev`, then open http://localhost:5173. No `.env` is needed.

Tests: `./mvnw clean verify` (needs the database). Frontend: `npm run lint`, `npm run build`, and `npm run shots` for screenshots.

API docs: http://localhost:8080/swagger-ui.html while `SWAGGER_ENABLED` is not `false`.

## Deploying

The Docker image contains one Spring Boot jar that serves both the API (`/api/**`) and the built React app, so the site and API share an origin and need no CORS setup. Deep links such as `/job/3` return the app. The container runs as a non-root user, stores uploads in the `/app/uploads` volume, and reports health at `/actuator/health`.

**1. Environment.** Copy `.env.example` to `.env` and fill it in. Required: `SPRING_DATASOURCE_PASSWORD` and `JWT_SECRET` (`openssl rand -base64 64`). Set `APP_BASE_URL` to the public URL (used in email links) and the `SPRING_MAIL_*` variables for an SMTP provider; with no mail credentials the app runs and sends nothing. Outside Docker Compose, also set `SPRING_DATASOURCE_URL` and `SPRING_DATASOURCE_USERNAME`. If the frontend is hosted on a separate origin, build it with `VITE_API_URL=https://api.example.com/api` and list its origin in `APP_CORS_ALLOWED_ORIGINS`.

**2. Build and run.**

```bash
docker compose up --build -d        # app on http://localhost:8080 plus Postgres 16
```

Or build only the image (`docker build -t jobportal .`) and run it against any PostgreSQL with the same environment variables. Flyway migrates the database on startup.

**3. First admin.** Register a normal account through the site, set `APP_ADMIN_EMAIL` to that email, and restart the app. The account is promoted to admin at startup. Registration never creates admins, and there is no endpoint for promoting more; change `APP_ADMIN_EMAIL` and restart to seed another.

Swagger is off in the compose file (`SWAGGER_ENABLED=false`). Put a TLS-terminating proxy in front of port 8080.

## License

MIT
