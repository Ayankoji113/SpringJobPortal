# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

The git repo root is `SpringJobPortal/` (one level below the usual working directory `D:\JOB_Portal project`). The React frontend lives *inside* the Maven source tree at `src/main/frontend/` — it is a separate npm project, not a Maven module, and is only wired to the backend by the Docker build (`npm run build` then `mvnw package`).

## Commands

Backend (from repo root; on Windows use `mvnw.cmd`):

```bash
./mvnw spring-boot:run          # run on :8080 (needs Postgres up)
./mvnw test                     # all tests
./mvnw test -Dtest=ClassName#methodName
./mvnw package -DskipTests
```

Frontend (from `src/main/frontend`):

```bash
npm install && npm run dev      # Vite dev server on :5173
npm run lint                    # eslint (no test runner configured)
npm run build
```

Full stack with a throwaway Postgres: `docker compose up --build`.

## Database

Requires a running PostgreSQL `JobPortalDB` — there is no in-memory/H2 fallback, so **every** backend test boots a real Spring context against Postgres and fails without it. Schema is managed by `ddl-auto=update`; there are no migrations. Override connection details with the standard `SPRING_DATASOURCE_*` env vars (what CI and docker-compose do) rather than editing `application.properties`.

`src/main/resources/application.properties` contains committed dev credentials and a committed `jwt.secret`. Treat them as dev-only defaults; override via env in any real deployment.

## Architecture

Package-by-feature under `com.tausib.springjobportal`: `user/`, `company/`, `job/`, `application/`, `notification/`, `matching/`, `dashboard/`, `file/`, plus `common/` (aop, security, mail, exception, Swagger config). Each feature package holds its own entity, repo, service, controller, mapper and `dto/`. Features depend on `common` and on `user`, never the reverse. `matching/` is top-level, not nested in `job/`, because `AIController.autoApply` needs `JobApplicationService` while `application/` needs `JobPost`. There is no top-level `model/ repo/ service/ controller/ dto/` any more — `docs/ARCHITECTURE.md` is the fuller map.

`user`, `company` and `job` take and return DTOs (`*Request`/`*Response` + a mapper). `application`, `notification` and `matching` still return JPA entities directly, so serialization there is controlled by `@JsonIgnore`/`@JsonIgnoreProperties` on the entity — adding a field to one of those entities changes the API payload.

Auth: JWT, stateless. `UserPrincipal` (not the `User` entity) is the security principal, so controllers take `@AuthenticationPrincipal UserPrincipal principal` and get an id + role, not a loaded entity. `JwtAuthFilter` populates the context; `RefreshToken` is a DB-backed entity with its own service. Route rules live in two places and both matter: coarse path rules in `common/security/SecurityConfig.java`, and per-endpoint `@PreAuthorize` on controller methods (`@EnableMethodSecurity` is on).

CORS is hardcoded to `http://localhost:5173` / `:3000` in `SecurityConfig`, and the frontend's axios `baseURL` is hardcoded to `http://localhost:8080/api` in `src/main/frontend/src/services/api.js`. There is no Vite proxy. Changing ports or deploying means touching both sides.

`AIService` is deliberately not an LLM call — it is rule-based keyword/skill matching and templated cover-letter text, with results cached in the `MatchScore` entity. The class comment marks it as swappable for a real provider.

Notifications are plain REST (`/api/notifications`) polled by the frontend every 30s. There is no WebSocket dependency, config, or handler anywhere, despite what the README says.

`common/aop/` holds two aspects that apply globally to controller and service methods: logging (which logs whole returned objects at INFO) and timing.

Frontend state: a single `context/AuthContext.jsx` plus `localStorage` for token/user. The axios response interceptor in `services/api.js` hard-redirects to `/login` on any 401, so a failing authenticated call logs the user out rather than surfacing an error.

## CI

`.github/workflows/ci.yml` runs on push to `main`/`develop`: frontend `npm ci && npm run build`, then `./mvnw test` against a Postgres service container, then `./mvnw package`. The Docker image build only runs on `main`.

## Notes

`run-log.txt` (1.4 MB) is a committed agent log — do not read it wholesale. `ralph.sh` is a generic autonomous-agent retry loop, not part of the build.
