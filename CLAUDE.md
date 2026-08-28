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

Standard Spring layering: `controller` → `service` → `repo` (Spring Data JPA) over `model` entities. `dto` holds only request/response shapes for auth, search, and stats; **most endpoints return JPA entities directly**, so serialization is controlled by `@JsonIgnore`/`@JsonIgnoreProperties` on the entity (see `model/User.java`) — adding a field to an entity changes the API payload.

Auth: JWT, stateless. `User` itself implements `UserDetails`, so controllers take `@AuthenticationPrincipal User user` and get the full entity. `JwtAuthFilter` populates the context; `RefreshToken` is a DB-backed entity with its own service. Route rules live in two places and both matter: coarse path rules in `config/SecurityConfig.java`, and per-endpoint `@PreAuthorize("hasRole('EMPLOYER'|'JOB_SEEKER'|'ADMIN')")` on controller methods (`@EnableMethodSecurity` is on).

CORS is hardcoded to `http://localhost:5173` / `:3000` in `SecurityConfig`, and the frontend's axios `baseURL` is hardcoded to `http://localhost:8080/api` in `src/main/frontend/src/services/api.js`. There is no Vite proxy. Changing ports or deploying means touching both sides.

`AIService` is deliberately not an LLM call — it is rule-based keyword/skill matching and templated cover-letter text, with results cached in the `MatchScore` entity. The class comment marks it as swappable for a real provider.

The `spring-boot-starter-websocket` dependency is present and `/ws/**` is permitted in `SecurityConfig`, but **no WebSocket config or handler exists**. Messaging and notifications are plain REST (`/api/messages`, `/api/notifications`) that the frontend polls, despite the README calling them real-time.

`aop/` holds three aspects that apply globally to `service` package methods: logging, timing, and `ValidationAspect`, which silently rewrites a negative `postid` argument to `JobService.updateJob` into its absolute value. Be aware of that when debugging odd id behaviour.

Frontend state: a single `context/AuthContext.jsx` plus `localStorage` for token/user. The axios response interceptor in `services/api.js` hard-redirects to `/login` on any 401, so a failing authenticated call logs the user out rather than surfacing an error.

## CI

`.github/workflows/ci.yml` runs on push to `main`/`develop`: frontend `npm ci && npm run build`, then `./mvnw test` against a Postgres service container, then `./mvnw package`. The Docker image build only runs on `main`.

## Notes

`run-log.txt` (1.4 MB) is a committed agent log — do not read it wholesale. `ralph.sh` is a generic autonomous-agent retry loop, not part of the build.
