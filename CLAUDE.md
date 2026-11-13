# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

The git repo root is `SpringJobPortal/` (one level below the usual working directory `D:\JOB_Portal project`). The React frontend lives *inside* the Maven source tree at `src/main/frontend/`. It is a separate npm project, not a Maven module. The two meet only in the Docker build, which runs `npm run build` and copies the output into the jar as `static/`.

## Commands

Backend (from repo root; on Windows use `mvnw.cmd`). Always use `clean`: incremental builds have hidden errors here.

```bash
./mvnw spring-boot:run          # run on :8080 (needs Postgres up)
./mvnw clean verify             # all tests
./mvnw test -Dtest=ClassName#methodName
./mvnw clean package -DskipTests
```

Frontend (from `src/main/frontend`):

```bash
npm install && npm run dev      # Vite dev server on :5173, talks to http://localhost:8080/api
npm run lint
npm run build
npm run shots                   # Playwright screenshots of the main pages (e2e/shots.mjs)
```

Full stack: copy `.env.example` to `.env`, then `docker compose up --build` (app on :8080).

## Configuration and secrets

`src/main/resources/application.properties` holds no secrets. Every deploy-relevant value is a `${ENV_VAR:default}` placeholder; `.env.example` at the repo root lists them all. `SPRING_DATASOURCE_PASSWORD` and `JWT_SECRET` have no default, so the app refuses to start without them. For local development the real values live in the git-ignored `config/application.properties` (Spring Boot loads `./config/` automatically); never print or commit that file.

## Database

Requires a running PostgreSQL. There is no H2 fallback, so the context tests boot a real Spring context against Postgres and fail without it. The schema is owned by Flyway (`src/main/resources/db/migration`, V1 to V4) and Hibernate runs with `ddl-auto=validate`: a schema change is a new `V<n>__*.sql` file, never an entity edit alone. `baseline-on-migrate` stamps databases created by the old `ddl-auto=update` at V1.

## Architecture

Package-by-feature under `com.tausib.springjobportal`: `user/`, `company/`, `job/`, `application/`, `notification/`, `matching/`, `dashboard/`, `file/`, `admin/`, plus `common/` (aop, config, exception, mail, security). Features depend on `common` and `user`, never the reverse. `docs/ARCHITECTURE.md` is the fuller map.

`user`, `company`, `job`, `application` and `admin` take and return DTOs. `notification` and `matching` still return JPA entities, so serialization there is controlled by `@JsonIgnore` on the entity.

Auth: JWT, stateless. `UserPrincipal` (not the `User` entity) is the principal; controllers take `@AuthenticationPrincipal UserPrincipal`. Route rules live in two places and both matter: path rules in `common/security/SecurityConfig.java` and `@PreAuthorize` on controller methods. In `SecurityConfig`, `/api/**` is authenticated unless listed; non-API `GET`s are permitted because they are the bundled SPA; only `/actuator/health` and `/actuator/info` are public.

Serving the SPA: `common/config/SpaWebConfig` serves `classpath:/static/` and returns `index.html` for client routes (`/job/3`), never for `/api`, actuator or Swagger paths or for missing files. In development nothing is bundled and Vite serves the frontend. CORS origins come from `app.cors.allowed-origins` (default `http://localhost:5173,http://localhost:3000`).

Jobs and moderation: a new posting starts `PENDING_REVIEW` and is public only when `PUBLISHED` and `isActive`. `JobStatus` also has `REJECTED` and `SUSPENDED`. Editing a published posting's content sends it back to review. `admin/` (`/api/admin`, `hasRole('ADMIN')`) reviews postings, features them, bans users and keeps an `admin_actions` log. Registration cannot create an admin: `AdminSeeder` promotes the already-registered account named by `app.admin.email` at startup.

Application lifecycle (`application/`): eight statuses, `PENDING → REVIEWED → INTERVIEW → OFFERED → ACCEPTED`, `REJECTED` from any open stage, `WITHDRAWN` by the seeker (`POST /{id}/withdraw`), and `NO_RESPONSE` set by the system. Each application gets a `respond_by` 14 days out; the hourly `ApplicationDeadlineTask` marks missed ones `NO_RESPONSE` and reminds employers 4 days before. Every status change writes an `application_events` row (`GET /{id}/timeline`). `GET /api/applications/employer/{id}/responsiveness` is public: 90-day response rate and median, withheld under 5 outcomes. Seekers are limited to 20 applications per 24 hours; `POST /api/applications/bulk` applies to at most 5 hand-picked jobs. There is no auto-apply.

`matching/`: `AIService` is rule-based skill matching, not an LLM. `SalaryEstimateService` (`/api/ai/salary-estimate/{jobId}`) uses Gemini through Spring AI's OpenAI-compatible client, with `GEMINI_API_KEY` from the environment; without a key it returns percentiles only.

Notifications are plain REST (`/api/notifications`); the frontend polls the unread count every 60 s. There are no WebSockets.

`common/aop/` logs entry/exit/exceptions and timing for every `*Controller` and `*Service` method.

Frontend: React 19, React Router, TanStack Query, `context/AuthContext.jsx` + `localStorage` for the token. `services/api.js` reads `VITE_API_URL` at build time (fallback `http://localhost:8080/api`; the Docker build sets `/api`). Its response interceptor redirects to `/login` on a 401. The design system (tokens, type, components, banned patterns) is described in `src/main/frontend/DESIGN.md`. Fonts are self-hosted with Fontsource; `vite.config.js` renames "Archivo Variable" to "Archivo".

## CI

`.github/workflows/ci.yml`: a frontend job (`npm ci`, lint, build), a backend job (`./mvnw clean verify` against a Postgres 16 service, Flyway builds the schema, CI-only dummy secrets), and on `main` a Docker image build. No deployment.
