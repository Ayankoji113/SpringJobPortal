# Project Analysis: Spring Job Portal

This document explains how the project actually works, based on reading the source code (backend, frontend,
migrations, tests, Docker and CI files), not just the README. Its companion,
[`INTERVIEW_PREPARATION.md`](INTERVIEW_PREPARATION.md), turns this into spoken answers and practice questions.

Three labels are used throughout:

- **Implemented**: the code exists and is used.
- **Partial**: the code exists but has a gap.
- **Not implemented**: it is a suggestion, not something in the code.

> The analysis covers branch `security/trust-phase-0-1` at commit `27a918a`, read on 2026-11-14. The working
> tree was clean at that point. A few behaviours were also **checked against the running application**
> (started locally on a spare port); those are marked "verified by running". Everything else is from
> reading the code.
>
> One change was made after the analysis and is **not committed yet**: the matching endpoints now return a
> `MatchScoreResponse` DTO instead of the `MatchScore` entity, with a regression test (`AIControllerTest`).
> The commit `27a918a` itself, which is pushed, still has the leak described in §10.8.
>
> `docs/ARCHITECTURE.md` is older than the code in several sections (its own header says which), and
> `docs/MIGRATION-PLAN.md` is abandoned. Where they disagree with this file, the code agrees with this file.

---

## 1. Project Overview

**What it is.** A full-stack job board with three kinds of user. Job seekers search postings, apply, and
follow each application. Employers post jobs and move applicants through a hiring pipeline. Admins review
every posting before the public can see it.

**The problem it solves.** Ordinary job boards have three well-known failures: fake or low-quality
listings, listings that hide the salary, and employers who never answer. The project is built around one
sentence, written at the top of `src/main/frontend/DESIGN.md`:

> every listing is real, shows its pay, and answers you.

Each claim maps to code:

| Claim | How the code backs it | Status |
| --- | --- | --- |
| "is real" | A new posting starts as `PENDING_REVIEW` and is public only after an admin publishes it. Editing a published posting sends it back to review. Posting requires a verified email and a company the employer owns | Implemented (with a gap in email verification, §13.1) |
| "shows its pay" | Salary range on the posting, a salary estimate from comparable postings (`SalaryEstimateService`), sort by pay with undisclosed salaries last | Partial: the salary range is still optional in `JobRequest` |
| "answers you" | Every application gets a 14-day response deadline. A scheduled task marks missed ones `NO_RESPONSE`. Each employer's 90-day response rate is public | Implemented |

**Main objectives.**

1. Let seekers find published jobs, apply, and see exactly where each application stands.
2. Hold employers to an answer, and publish how reliably they give one.
3. Keep unreviewed or abusive postings away from the public.
4. Be a realistic, deployable system (authentication, roles, migrations, tests, CI, Docker), not a toy.

**Target users.** Job seekers and employers in India: salaries are formatted in lakhs (`₹18.0L`, in
`src/main/frontend/src/lib/format.js`) and the salary estimate is labelled `INR`.

**Main features.**

| Feature | Where in the code | Status |
| --- | --- | --- |
| Register and login with JWT, three roles | `user/AuthController`, `user/AuthService`, `common/security/*` | Implemented |
| Forgotten password by emailed link | `AuthService.requestPasswordReset` / `resetPassword`, `pages/auth.jsx` | Implemented |
| Email verification | `AuthService.verifyEmail`, `POST /api/auth/verify-email` | Partial: backend only, the frontend has no page for the link |
| Profile with skills, photo and resume upload | `user/UserService`, `file/FileStorageService`, `Profile` in `pages/misc.jsx` | Implemented |
| Company profiles | `company/*` | Partial: API only, no screen to create a company |
| Job postings with search, filters, sort, pagination | `job/*`, `pages/JobList.jsx`, `pages/JobDetail.jsx` | Implemented |
| Admin review queue, featuring, banning, audit log | `admin/*`, `pages/admin.jsx` | Implemented |
| Apply, bulk-apply to up to 5 picked jobs, withdraw | `application/*`, `pages/JobDetail.jsx`, `pages/seeker.jsx` | Implemented |
| Hiring pipeline with a timeline of every change | `ApplicationStatus`, `JobApplicationService.transition`, `components/ApplicationTimeline.jsx` | Implemented |
| 14-day deadline, reminder, public response rate | `ApplicationDeadlineTask`, `JobApplicationRepo.responsiveness` | Implemented |
| Saved jobs | `job/SavedJobService`, `SavedJobs` in `pages/seeker.jsx` | Implemented |
| Skill-match score and recommendations | `matching/AIService` | Partial: works, but matches by substring and never refreshes a stored score |
| Salary estimate with an LLM explanation | `matching/SalaryEstimateService`, `components/SalaryPanel.jsx` | Implemented |
| In-app notifications and email | `notification/*`, `common/mail/EmailService` | Implemented (polling, no WebSockets) |
| Employer dashboard | `dashboard/DashboardController`, `EmployerDashboard` in `pages/employer.jsx` | Implemented |

**What makes it different from a typical student job portal.**

- **Applications are a state machine**, not a free-text status. Allowed moves live in one method,
  `ApplicationStatus.nextForEmployer()`, and every move writes a history row in the same transaction.
- **Employers are measured.** The response-rate query uses PostgreSQL `FILTER` and `PERCENTILE_CONT`, and
  the result is withheld until there are at least 5 known outcomes so one application cannot define a rate.
- **Moderation is a status, not a boolean**, with a reason the employer can read and an audit log of every
  admin action.
- **The LLM is grounded.** Percentiles are computed in SQL; the model only explains numbers it is given,
  and when the model is slow, down or over quota the endpoint still answers with the numbers.
- **The schema is owned by Flyway migrations** and Hibernate only validates it.
- **One deployable.** The React build is bundled into the Spring Boot jar, so production has one process,
  one port and no CORS.

---

## 2. Main Users and User Roles

There are **three roles**, stored in `users.role` and defined in `user/UserRole.java`.

| Actor | What they can do |
| --- | --- |
| **Anonymous visitor** | Browse and search published jobs, open a job, see company profiles, see an employer's response record, load public images (`/api/files`), use all of `/api/auth/**`, `/actuator/health`, `/actuator/info` |
| **JOB_SEEKER** | Everything above, plus: apply, bulk-apply, withdraw, see own applications and timelines, save jobs, get match scores and recommendations, edit own profile, upload photo and resume |
| **EMPLOYER** | Create and edit own companies and job postings, read applicants of own postings, move applications through stages, read an applicant's resume through the application, see own dashboard |
| **ADMIN** | Review queue (publish, reject, suspend), feature a posting, ban or reinstate a user, read the audit log. An admin can also open unpublished postings |

**How roles are enforced.** Three layers, and all three matter:

1. **Path rules** in `common/security/SecurityConfig.java`. `/api/**` needs a valid token unless the path
   is on the public list (auth endpoints, `GET /api/jobs/**`, `GET /api/companies/**`, the responsiveness
   endpoint, `/api/files/**`).
2. **Method rules** with `@PreAuthorize` on controller methods: `hasRole('EMPLOYER')`,
   `hasRole('JOB_SEEKER')`, `hasRole('ADMIN')`, or `isAuthenticated()`. `AdminController` and
   `DashboardController` carry the rule on the class, so a method added later cannot be forgotten.
   This layer is what protects `GET /api/jobs/my` and `GET /api/jobs/saved`, which sit under the public
   `GET /api/jobs/**` path rule.
3. **Ownership checks in services.** A role is not enough: the employer must own the thing.
   `JobService.requireOwner`, `CompanyService.requireOwner`, `JobApplicationService.requireJobOwner` and
   `requireApplicantOrJobOwner` compare the owner's id with the caller's id and throw
   `ForbiddenOperationException` (403). Notifications are fetched with
   `findByIdAndUserId(id, userId)`, so someone else's notification is simply "not found" (404).

**Where the role comes from.** The JWT carries only the email. On every request `JwtAuthFilter` loads the
user from the database and builds a `UserPrincipal` with one authority, `ROLE_<role>`. A role change or a
ban therefore takes effect on the very next request.

**How an admin comes to exist.** Registration refuses the role (`UserRole.isSelfAssignable()`; verified by
running: `403 "That role cannot be chosen at registration"`). `admin/AdminSeeder` promotes one
already-registered account, named by the `app.admin.email` property, at startup. There is no endpoint that
promotes a second admin.

**Account states.** `users.is_banned` blocks login and blocks every token-authenticated request. `users.is_email_verified` gates posting a job.
`users.is_profile_public` hides a profile from other users.

**Not implemented:** an endpoint to promote or demote admins, account deletion, a company with several
members, a seeker who is also an employer on the same account.

---

## 3. Complete User Flow

```mermaid
flowchart TD
    A[Open the app] --> H[Home: featured and recent jobs]
    H --> J[/jobs: search, filter, sort/]
    J --> D[/job/:id: details, response record, salary panel/]
    D --> L{Signed in?}
    L -- no --> LG[/login or /register/]
    LG --> D
    L -- seeker --> AP[Apply with a cover letter]
    AP --> MA[/my-applications: response clock, stage track, timeline, withdraw/]
    H --> R[/recommendations: tick up to 5, apply to selected/]
    H --> S[/saved-jobs/]

    LG -- employer --> ED[/employer-dashboard/]
    ED --> PJ[/post-job: new or edit/]
    PJ --> Q[(Posting is PENDING_REVIEW)]
    Q --> AD[/admin: publish, reject or suspend with a reason/]
    AD -- publish --> J
    ED --> MG[/manage-applications: move stage, add note, open resume/]
    MG --> MA
```

What happens at each step, on both sides:

**1. Opening the application.**
The browser downloads `index.html` and the JavaScript bundle (from the Spring Boot jar in production, from
the Vite dev server locally). `main.jsx` renders `<App/>`. `App.jsx` wraps everything in
`QueryClientProvider` → `AuthProvider` → `BrowserRouter` → `ToastProvider` → `AppShell`. `AuthProvider`
reads the saved user from `localStorage` once, during the first render. The home page then requests
`GET /api/jobs/featured` and `GET /api/jobs/paginated?page=0&size=6`. Both are public.

**2. Registration.**
*Frontend* (`Register` in `pages/auth.jsx`, built on react-hook-form): role (job seeker or employer), full
name (at least 2 characters), email, password (at least 8 characters). Then `POST /api/auth/register` with
`{fullName, email, password, role}`.
*Backend*: `@Valid` checks `RegisterRequest` (`@NotBlank`, `@Email`, `@NotNull` role). `AuthService.register`
rejects the `ADMIN` role, rejects a taken email (400), hashes the password with BCrypt, saves the user,
stores a random verification token and sends the verification email (asynchronously), and returns
`{token, refreshToken, id, fullName, email, role, profilePhotoPath, skills}`. The user is signed in at once.

**3. Email verification.** *Partial.* The email contains a link to `/verify-email?token=…` on the frontend.
`App.jsx` has **no route for that path**, and `authService.verifyEmail` is never called by any page, so the
link opens the "not found" page. The backend endpoint `POST /api/auth/verify-email` works if called
directly. This matters because an unverified employer cannot post a job (step 8).

**4. Login.**
*Frontend* (`Login`): `POST /api/auth/login` with `{email, password}`.
*Backend*: `AuthService.login` calls Spring Security's `AuthenticationManager`, which uses
`DaoAuthenticationProvider` → `UserDetailsService` (finds the user by email) → BCrypt `matches`. A wrong
email or password gives **401** `"Email or password is incorrect."` (verified by running). A banned account
is refused too. From reading the code, it gets the same 401 message: `DaoAuthenticationProvider` checks
`isAccountNonLocked()` first and throws `LockedException`, so the friendlier
`403 "Your account has been suspended"` branch in `AuthService.login` is never reached. On success the service issues a JWT (24 hours) and a refresh token (a random UUID stored in the
`refresh_tokens` table, 7 days). The page then goes to `/employer-dashboard` for an employer and `/jobs`
for everyone else, or back to the page the user was on when their session ended.

**5. Authentication on later requests.**
`authService.login` saves `token`, `refreshToken` and `user` in `localStorage`. The Axios request
interceptor in `services/api.js` adds `Authorization: Bearer <token>` to every request. On the server,
`JwtAuthFilter` verifies the signature and expiry, loads the user, checks that the account is not banned,
and puts a `UserPrincipal` into the `SecurityContext`.

**6. Authorization.** Described in §2: path rule, then `@PreAuthorize`, then the ownership check in the
service. On the frontend, `ProtectedRoute` redirects a signed-out user to `/login` and a user with the
wrong role to `/`. That is only convenience; the API is what actually refuses.

**7. Seeker: search and apply.**
- *Search* (`JobList.jsx`): **the URL is the state**. Filters live in the query string
  (`/jobs?keyword=java&location=pune&sort=newest&page=0`), so a search can be shared or bookmarked and the
  back button works. With no filters the page calls `GET /api/jobs/paginated`; with filters or a sort it
  calls `GET /api/jobs/search`.
- *Job detail* (`JobDetail.jsx`): `GET /api/jobs/{id}` (which also adds one to the view count), the
  employer's response record, whether the job is saved, and the salary panel.
- *Apply*: a dialog with a cover letter → `POST /api/applications/job/{id}`. The full path of this request
  is traced in §4.1.
- *Recommendations* (`seeker.jsx`): `GET /api/ai/recommended-jobs?threshold=50` returns jobs with a match
  score of 50 or more. The seeker ticks the ones they want and `POST /api/applications/bulk` applies to at
  most 5. Nothing is applied to on their behalf.
- *My applications*: each row shows a **response clock** (one tick per day of the employer's 14 days), a
  stage track (Applied → Reviewed → Interview → Offer → Hired) and an expandable timeline loaded from
  `GET /api/applications/{id}/timeline`. An open application can be withdrawn.

**8. Employer: post and hire.**
- *Post a job* (`PostJob`): title, description, experience, tech stack, salary range, location, type,
  remote, optional company. `POST /api/jobs`. The service refuses a banned or unverified account (gate G1)
  and a company the employer does not own (gate G2). The posting is saved as `PENDING_REVIEW`.
- *Wait for review.* The admin publishes, rejects or suspends it; the employer gets a notification with the
  reason.
- *Manage applications* (`ManageApplications`): pick a posting, see applicants, open a resume
  (`GET /api/applications/{id}/resume`, fetched as a Blob because the request needs the auth header), and
  move an application to one of its `nextStatuses` with an optional note
  (`PATCH /api/applications/{id}/status`).
- *Close a posting.* Switching it off, or deleting one that has applicants, publishes a `JobClosedEvent`;
  every application still open on it is rejected with the note "Position closed", so nobody is left waiting.

**9. Admin: review.** `/admin` shows the pending count, the queue oldest first, and the audit log.
Rejecting or suspending needs a reason. A ban deletes the account's refresh tokens.

**10. The clock.** Every hour `ApplicationDeadlineTask` (a) marks `PENDING` applications past their
deadline as `NO_RESPONSE` and tells the applicant, and (b) warns each employer once, 4 days before the
deadline, with one notification and one email however many applications are waiting.

**11. Profile management.** `GET /api/users/me`, `PUT /api/users/me` (only the fields sent are changed),
photo and resume upload as multipart, and a visibility switch. Email and password cannot be changed while
signed in; the forgotten-password flow is the only way to change a password.

**12. Logout.** Purely a frontend action: `authService.logout()` removes the three `localStorage` keys and
the React state. **No request is sent to the backend.** The JWT stays valid until it expires and the refresh
token stays in the database (§10.8).

**13. Expired session.** *Partial.* The frontend is ready for it: the Axios response interceptor reacts to a
**401** on an authenticated request by clearing storage and firing a `jp:session-expired` event, and
`AppShell` shows a message and sends the user to `/login`. But the backend answers a missing, expired or
malformed token with **403**, not 401 (verified by running), so this path never runs. See §10.8.

---

## 4. How Data Travels Through the Application

### 4.1 The full lifecycle of one request

Example: a job seeker applies to job 12 with a cover letter.

```mermaid
sequenceDiagram
    autonumber
    participant UI as JobDetail.jsx
    participant AX as Axios (services/api.js)
    participant F as JwtAuthFilter
    participant SEC as SecurityConfig + @PreAuthorize
    participant C as JobApplicationController
    participant S as JobApplicationService
    participant R as Repositories
    participant DB as PostgreSQL
    participant M as EmailService (@Async)

    UI->>AX: apply.mutate() calls jobService.applyToJob(12, coverLetter)
    AX->>F: POST /api/applications/job/12 + Authorization: Bearer token + JSON body
    F->>DB: SELECT user by the email inside the token
    F->>F: signature, expiry and "not banned" checked, UserPrincipal into SecurityContext
    F->>SEC: path rule (/api/** authenticated), then hasRole('JOB_SEEKER')
    SEC->>C: applyToJob(jobId, body, principal)
    C->>S: applyToJob(12, userId, coverLetter)
    S->>R: already applied? job published and active? applicant exists? under 20 today?
    R->>DB: four SELECTs
    S->>R: save(JobApplication with respondBy = now + 14 days)
    R->>DB: INSERT INTO job_applications
    S->>R: save(ApplicationStatusEvent null to PENDING)
    R->>DB: INSERT INTO application_events
    S->>R: save(Notification for the employer)
    R->>DB: INSERT INTO notifications
    S->>M: sendApplicationNotification (runs on another thread)
    S-->>C: ApplicationResponse (MapStruct)
    C-->>AX: 200 OK + JSON
    AX-->>UI: promise resolves
    UI->>UI: onSuccess: invalidate ['my-applications'], toast, close dialog
```

**Step 1: the frontend creates the request.** The apply dialog in `JobDetail.jsx` is a react-hook-form
form. Submitting it runs a TanStack Query mutation whose `mutationFn` is one line in
`services/jobService.js`:

```js
export const applyToJob = async (jobId, coverLetter) => {
    const response = await api.post(`/applications/job/${jobId}`, { coverLetter });
    return response.data;
};
```

Axios turns the object into a JSON string, sets `Content-Type: application/json`, and the request
interceptor adds the `Authorization` header.

**Step 2: the request reaches the backend.** The base URL is `VITE_API_URL`, or
`http://localhost:8080/api` when that is not set. In the Docker image it is `/api`, so the browser calls
the same origin that served the page. In local development the page is on port 5173 and the API on 8080,
which is a cross-origin call (that is why CORS exists, §5). Inside Spring Boot the embedded Tomcat server
accepts the connection and passes the request through the Spring Security filter chain.

**Step 3: the filter.** `JwtAuthFilter` reads the header, asks `JwtService.extractUsername(jwt)` to verify
the signature and read the email, loads the user through `UserDetailsService`, and checks
`isAccountNonLocked()` and `isTokenValid`. If all pass it stores an authenticated token in the
`SecurityContextHolder`. If the header is missing or the token is bad it does nothing, and the request is
refused later because the route requires authentication.

**Step 4: authorization.** The path matches `"/api/**" → authenticated()`. Then method security evaluates
`@PreAuthorize("hasRole('JOB_SEEKER')")` on the controller method. An employer calling this endpoint gets
403 here.

**Step 5: the controller.** Spring's `DispatcherServlet` matches `POST /api/applications/job/{jobId}` to
`JobApplicationController.applyToJob`. `@PathVariable Integer jobId` takes `12` from the URL, `@RequestBody
Map<String, String>` takes the JSON body, and `@AuthenticationPrincipal UserPrincipal user` takes the
principal from step 3. The controller holds no rules; it calls the service. Two AOP aspects
(`LoggingAspect`, `PerformanceMonitorAspect`) wrap this call and log the method name and its duration.

**Step 6: the service layer, and why it exists.** `JobApplicationService.applyToJob` is where the rules
live:

```java
@Transactional
public ApplicationResponse applyToJob(Integer jobId, Integer applicantId, String coverLetter) {
    if (applicationRepo.findByJobPostPostIdAndApplicantId(jobId, applicantId).isPresent()) {
        throw new RuntimeException("You have already applied to this job");
    }
    var job = jobRepo.findById(jobId)
            .filter(j -> j.getStatus() == JobStatus.PUBLISHED && Boolean.TRUE.equals(j.getIsActive()))
            .orElseThrow(() -> new ResourceNotFoundException("Job not found with id: " + jobId));
    ...
    if (applicationRepo.countByApplicantIdAndAppliedDateAfter(applicantId, now.minusDays(1))
            >= DAILY_APPLICATION_LIMIT) {
        throw new ForbiddenOperationException("You have reached the limit of 20 applications in 24 hours");
    }
    JobApplication saved = applicationRepo.save(JobApplication.builder()
            .jobPost(job).applicant(applicant).coverLetter(coverLetter)
            .status(ApplicationStatus.PENDING)
            .respondBy(now.plusDays(RESPONSE_DAYS))
            .build());
    record(saved, null, ApplicationStatus.PENDING, applicant, null, now);
    ...
}
```

It also defines the **transaction boundary** (`@Transactional`): the application row, its first timeline
row and the employer's notification commit together or roll back together. Keeping this out of the
controller means the same rules apply to the bulk endpoint, which calls the same method once per job.

**Step 7: the repository talks to the database.** `JobApplicationRepo` is an interface that extends
`JpaRepository<JobApplication, Integer>`. Spring Data generates the implementation at startup. `save()`
hands the entity to Hibernate.

**Step 8: SQL is executed.** Hibernate turns the entity into an `INSERT` and sends it over JDBC through a
HikariCP connection pool. Because the id uses `GenerationType.IDENTITY`, the insert runs immediately and
returns the generated id. PostgreSQL enforces its own rules as well: the status CHECK constraint, the
foreign keys, and the unique index on `(job_post_id, applicant_id)`, which is what really prevents a double
application if two requests arrive at the same moment.

**Step 9: data goes back.** `ApplicationMapper` (MapStruct, generated at compile time) converts the entity
into an `ApplicationResponse`, including `nextStatuses`. The controller wraps it in `ResponseEntity.ok(...)`;
Jackson writes it as JSON with status **200**.

**Step 10: the UI updates.** The mutation's `onSuccess` calls
`queryClient.invalidateQueries({ queryKey: ['my-applications'] })`, so the applications list is refetched
the next time it is shown, and shows a toast. The app refetches rather than patching lists by hand, so what
the user sees is always what the server says.

**If something fails**: the service throws; `GlobalExceptionHandler` turns the exception into a JSON body
with an `error` field; the promise rejects; `errorMessage(err)` in `api.js` reads that field and the page
shows it in a toast or next to the form.

### 4.2 HTTP methods as used in this project

| Method | Meaning | Real example | Success status |
| --- | --- | --- | --- |
| **GET** | Read. No body, can be repeated | `GET /api/jobs/search?keyword=java&page=0&size=10` | 200 |
| **POST** | Create, or run an action | `POST /api/jobs`, `POST /api/auth/login`, `POST /api/applications/{id}/withdraw` | 200 |
| **PUT** | Update a resource | `PUT /api/jobs/12`, `PUT /api/users/me` | 200 |
| **PATCH** | Change one aspect | `PATCH /api/applications/7/status`, `PATCH /api/notifications/3/read`, `PATCH /api/admin/users/9/banned` | 200 |
| **DELETE** | Remove | `DELETE /api/jobs/12`, `DELETE /api/jobs/12/save` | 200 |
| **OPTIONS** | CORS preflight, sent automatically by the browser | permitted for `/**` in `SecurityConfig` | 200 |

Two honest notes. First, **`GET /api/jobs/{id}` is not a pure read**: it increments the view count.
Second, **`PUT` here behaves like PATCH**: `JobService.update` and `UserService.updateProfile` change only
the fields that are present in the body ("absent means leave alone").

### 4.3 Status codes this API returns

| Code | When | Produced by |
| --- | --- | --- |
| 200 OK | Every success, including creates and deletes | `ResponseEntity.ok(...)` everywhere |
| 400 Bad Request | Validation failure; and **any other `RuntimeException`** (already applied, illegal stage move, email taken, bad refresh token, file type not allowed) | `GlobalExceptionHandler` |
| 401 Unauthorized | Wrong email or password at login | `AuthenticationException` handler |
| 403 Forbidden | Wrong role, not the owner, unverified or banned employer posting a job, daily limit reached, **and a missing/expired/invalid token** | `ForbiddenOperationException`, `AccessDeniedException` handlers; Spring Security's default entry point |
| 404 Not Found | Record does not exist, or exists but the caller may not see it (unpublished job, private profile, someone else's notification) | `ResourceNotFoundException` handler |
| 500 | Database or JSON serialization failure, anything unhandled | `DataAccessException` / catch-all handlers |

**Not used:** 201 Created, 204 No Content, 409 Conflict, 429 Too Many Requests. Returning 201 for creates
and 409 for "already applied" would be more precise (§13.4).

### 4.4 The parts of a request and a response

- **Request headers**: `Authorization: Bearer eyJ…` (who you are), `Content-Type: application/json` (what
  the body is), `Origin` (added by the browser, used for CORS).
- **Request body**: JSON for normal calls; `multipart/form-data` for photo, resume and logo uploads
  (`FormData.append('file', file)` → `@RequestParam("file") MultipartFile file`).
- **Query parameters**: optional values after `?`. In `JobController.searchJobs`: `keyword`, `location`,
  `jobType`, `isRemote`, `minExp`, `maxExp`, `page`, `size`, `sortBy`, `sortDir`.
- **Path variables**: the id inside the URL. `@GetMapping("/{postId}")` with `@PathVariable Integer postId`.
- **Response body**: JSON, except file endpoints, which return raw bytes with a `Content-Type` chosen from
  the file extension.

A real exchange:

```http
POST /api/applications/job/12 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
Content-Type: application/json

{"coverLetter":"I have three years of Spring Boot experience..."}
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"id":31,
 "jobPost":{"postId":12,"postProfile":"Backend Engineer","status":"PUBLISHED", "...":"..."},
 "applicant":{"id":14,"fullName":"Asha Rao","email":"asha@example.com","profilePhotoPath":null,"currentJobTitle":null},
 "coverLetter":"I have three years of Spring Boot experience...",
 "status":"PENDING",
 "appliedDate":"2026-11-14T08:40:12.118",
 "respondBy":"2026-11-28T08:40:12.101",
 "respondedAt":null,
 "nextStatuses":["REVIEWED","REJECTED"]}
```

**Error bodies come in three shapes** (all three verified by running):

```json
{"error":"Email already registered"}
```
```json
{"password":"Password is required","email":"Email should be valid"}
```
```json
{"timestamp":"2026-11-14T03:03:47.937+00:00","status":403,"error":"Forbidden","path":"/api/users/me"}
```

The first is every handler in `GlobalExceptionHandler`. The second is the validation handler, which returns
a map of field name to message with no `error` key. The third is Spring Security's own response when the
request never reaches a controller. The frontend's `errorMessage` reads `data.message || data.error`, so it
shows the first shape well, shows only "Forbidden" for the third, and for the second falls back to Axios's
generic "Request failed with status code 400". One shape for all three would be better (§13.4).

A paged response is Spring's `Page` object: `{"content":[…], "totalElements":12, "totalPages":2, "number":0, …}`.

---

## 5. Frontend and Backend Communication

**How they are connected.** They are two programs that share only an HTTP/JSON contract. All calls go
through one Axios instance, `src/main/frontend/src/services/api.js`:

```js
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api',
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use((response) => response, (error) => {
    const status = error.response?.status;
    const hadToken = Boolean(localStorage.getItem('token'));
    if (status === 401 && hadToken) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.dispatchEvent(new CustomEvent('jp:session-expired'));
    }
    return Promise.reject(error);
});
```

**How Axios works here.** `api.get(url, {params})` returns a Promise. Axios serialises `params` into the
query string, serialises object bodies to JSON, parses JSON responses into `response.data`, and **rejects
the promise for any non-2xx status** (the built-in `fetch` only rejects on a network failure).
Interceptors run on every request and response, which is how the token is attached in one place.

**The service layer on the frontend.** Pages never call Axios directly. Eight small files in `services/`
(`authService`, `jobService`, `userService`, `notificationService`, `aiService`, `adminService`,
`dashboardService`, `api`) expose one function per endpoint, and pages pass those functions to TanStack
Query (`useQuery` for reads, `useMutation` for writes).

**How endpoints are defined.** On the backend with annotations: `@RestController` +
`@RequestMapping("/api/jobs")` on the class, then `@GetMapping`, `@PostMapping`, `@PutMapping("/{postId}")`,
`@PatchMapping`, `@DeleteMapping` on methods.

**All endpoints** (59, every one checked in the controllers). "Auth" is the effective requirement after
both the path rule and `@PreAuthorize`.

*Authentication, `/api/auth` (all public)*

| Method and path | Purpose | Called from |
| --- | --- | --- |
| `POST /register` | Create account, returns tokens | `AuthContext.register` |
| `POST /login` | Returns tokens | `AuthContext.login` |
| `POST /refresh-token` | New access token from a refresh token | *defined in `authService`, never called* |
| `POST /verify-email` | Confirm the emailed token | *defined in `authService`, never called* |
| `POST /forgot-password` | Email a reset link; same answer whether or not the email exists | `ForgotPassword` |
| `POST /reset-password` | Token + new password | `ResetPassword` |

*Users, `/api/users` (any signed-in user)*

| Method and path | Purpose | Called from |
| --- | --- | --- |
| `GET /me`, `PUT /me` | Read / update own profile | `Profile` |
| `GET /{id}` | Another user's public profile, with email, phone and resume path removed | *not called by the frontend* |
| `POST /me/photo`, `POST /me/resume` | Multipart upload | `Profile` |
| `PATCH /me/visibility` | Public / private profile | `Profile` |

*Jobs, `/api/jobs`*

| Method and path | Auth | Purpose | Called from |
| --- | --- | --- | --- |
| `GET /` | public | Every published job, no paging | *not called* |
| `GET /paginated` | public | Published jobs, newest first | `Home`, `JobList` |
| `GET /search` | public | Filters, sort, paging | `JobList` |
| `GET /featured` | public | Featured published jobs | `Home` |
| `GET /keyword/{keyword}` | public | Simple keyword search | *not called* |
| `GET /{postId}` | public | One job; adds one to its view count. Unpublished jobs are visible only to their owner and admins | `JobDetail`, `PostJob` |
| `GET /my` | EMPLOYER | Own postings in every status | `EmployerDashboard`, `ManageApplications` |
| `GET /saved`, `GET /{postId}/is-saved` | signed in | Bookmarks | `JobList`, `SavedJobs`, `JobDetail` |
| `POST /`, `PUT /{postId}`, `DELETE /{postId}` | EMPLOYER + owner | Create, update, delete or close | `PostJob`, `EmployerDashboard` |
| `POST /{postId}/save`, `DELETE /{postId}/save` | signed in | Save / unsave | `JobList`, `JobDetail`, `SavedJobs` |

*Applications, `/api/applications`*

| Method and path | Auth | Purpose | Called from |
| --- | --- | --- | --- |
| `POST /job/{jobId}` | JOB_SEEKER | Apply; at most 20 per 24 hours | `JobDetail` |
| `POST /bulk` | JOB_SEEKER | Apply to 1–5 chosen jobs; returns `{applied, skipped}` | `Recommendations` |
| `GET /my` | JOB_SEEKER | Own applications | `MyApplications` |
| `GET /job/{jobId}` | EMPLOYER + job owner | Applicants of one posting | `ManageApplications` |
| `PATCH /{id}/status` | EMPLOYER + job owner | Move to a next stage, optional note | `ManageApplications` |
| `POST /{id}/withdraw` | JOB_SEEKER + applicant | Withdraw | `MyApplications` |
| `GET /{id}/timeline` | applicant or job owner | History of status changes | `ApplicationTimeline` |
| `GET /{id}/resume` | applicant or job owner | Resume bytes | `ManageApplications` |
| `GET /employer/{employerId}/responsiveness` | public | 90-day response rate and median days | `JobDetail`, `EmployerDashboard` |

*Admin, `/api/admin` (ADMIN, on the class)*

| Method and path | Purpose |
| --- | --- |
| `GET /jobs/pending` | Review queue, oldest first, paged |
| `GET /stats` | `{pendingReview}` |
| `POST /jobs/{postId}/decision` | `{status, reason}`: publish, reject or suspend |
| `PATCH /jobs/{postId}/featured` | Feature / unfeature a published posting |
| `PATCH /users/{userId}/banned` | Ban / reinstate |
| `GET /actions` | Audit log, newest first, paged |

*Others*

| Method and path | Auth | Purpose | Called from |
| --- | --- | --- | --- |
| `GET /api/companies`, `GET /api/companies/{id}` | public | Company profiles | *not called* |
| `GET /api/companies/my` | EMPLOYER | Own companies | `PostJob` |
| `POST /api/companies`, `PUT /{id}`, `DELETE /{id}`, `POST /{id}/logo` | EMPLOYER + owner | Manage a company | *not called: no company screen exists* |
| `GET /api/notifications`, `/unread`, `/unread-count` | signed in | Notifications | `Notifications`, `AppShell` (count, every 60 s) |
| `PATCH /api/notifications/{id}/read`, `POST /mark-all-read`, `DELETE /{id}` | signed in, own only | Manage notifications | `Notifications` |
| `GET /api/ai/match-score/{jobId}` | JOB_SEEKER | Score for one job | *not called* |
| `GET /api/ai/recommended-jobs?threshold=` | JOB_SEEKER | Jobs at or above the score | `Recommendations` |
| `GET /api/ai/salary-estimate/{jobId}` | signed in | Percentiles + optional narrative | `SalaryPanel` |
| `GET /api/dashboard/employer` | EMPLOYER | Totals and status breakdown | `EmployerDashboard` |
| `GET /api/files?path=` | public | Photos and logos only | `<img>` tags |
| `GET /actuator/health`, `/actuator/info` | public | Health check | Docker `HEALTHCHECK` |
| `/swagger-ui.html`, `/v3/api-docs` | public | API documentation, switchable with `SWAGGER_ENABLED` | developers |

**How JSON is transferred.** Request and response shapes are DTO classes (Lombok `@Data` classes and Java
`record`s). Jackson maps JSON field names to Java fields by name. `BigDecimal` becomes a JSON number,
`LocalDateTime` an ISO string without a time zone, enums their names (`"PENDING_REVIEW"`).

**CORS: what it is and why it is needed.** Browsers apply the *same-origin policy*: JavaScript on
`http://localhost:5173` may not read a response from `http://localhost:8080` unless that server says so.
For a request with a JSON body or an `Authorization` header the browser first sends an `OPTIONS`
*preflight*; the server answers with `Access-Control-Allow-*` headers, and only then is the real request
sent. In `SecurityConfig`:

```java
configuration.setAllowedOrigins(allowedOrigins...);     // app.cors.allowed-origins
configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "Cache-Control"));
configuration.setAllowCredentials(true);
```

Two things worth knowing:

1. CORS protects **browser users**, not the API. curl ignores it. The API is protected by the JWT.
2. **In the Docker deployment CORS is not involved at all**, because the jar serves the React build and the
   API from one origin. CORS matters only in local development (two ports) or if the frontend is hosted
   somewhere else. `allowCredentials(true)` is not needed, because no cookies are used.

**How authentication information travels.** In the `Authorization: Bearer <jwt>` header. No cookies.

**How responses become UI.** TanStack Query gives every read `data`, `isPending` and `isError`. Pages
render one of four states: skeleton, error (with "Try again"), empty (with what to do next), or content.
Writes are mutations that invalidate the affected query keys, for example `['my-applications']`,
`['saved-jobs']`, `['admin']`. Global defaults in `App.jsx`: results are fresh for 30 seconds, no refetch
on window focus, one retry except after a 401.

---

## 6. Project Architecture

### 6.1 The big picture

```mermaid
flowchart LR
    subgraph Browser
      SPA[React SPA<br/>React Router, TanStack Query,<br/>react-hook-form, Axios]
    end
    subgraph JAR[Spring Boot, one deployable JAR]
      STATIC[SpaWebConfig<br/>serves the React build]
      SEC[Security filter chain<br/>CORS, JwtAuthFilter]
      CTRL[Controllers]
      SVC[Services]
      REPO[Repositories<br/>Spring Data JPA]
      TASK[ApplicationDeadlineTask<br/>hourly]
    end
    DB[(PostgreSQL 16<br/>schema owned by Flyway)]
    FS[(Upload directory<br/>photos, resumes, logos)]
    G[Gemini<br/>OpenAI-compatible API]
    M[SMTP server<br/>optional]

    SPA -- "GET / and assets" --> STATIC
    SPA -- "HTTPS JSON + Bearer JWT" --> SEC --> CTRL --> SVC --> REPO -- JDBC --> DB
    TASK --> SVC
    SVC --> FS
    SVC -. "salary narrative" .-> G
    SVC -. "@Async email" .-> M
```

**Client-server architecture.** The browser asks; the server answers. The server never pushes: there are
no WebSockets, and the notification bell polls every 60 seconds.

**Three tiers.** Presentation (React), application logic (Spring Boot), data (PostgreSQL plus a directory
of uploaded files).

**Monolith.** One Spring Boot application with one database. It is a *modular* monolith: the code is split
by feature. A plan to split it into microservices was written and then abandoned
(`docs/MIGRATION-PLAN.md` carries a banner saying so).

### 6.2 Backend: layered, packaged by feature

```
com.tausib.springjobportal
├── user          User, RefreshToken, UserPrincipal, auth + profile controllers and services, dto/
├── company       Company, service, controller, mapper, dto/
├── job           JobPost, SavedJob, JobStatus, JobType, services, controller, JobClosedEvent, dto/
├── application   JobApplication, ApplicationStatus, ApplicationStatusEvent, service, controller,
│                 ApplicationDeadlineTask, dto/
├── admin         AdminController, AdminService, AdminAction, AdminSeeder, dto/
├── notification  Notification, service, controller
├── matching      MatchScore, AIService (rule-based), SalaryEstimateService (Spring AI), AIController
├── dashboard     DashboardController, dto/
├── file          FileStorageService, FileController
└── common        aop/, config/, exception/, mail/, security/
```

Inside a feature the direction is always **Controller → Service → Repository → Database**. Between
features the direction is one-way: features depend on `common` and `user`, never the reverse.
`UserSecurityConfig` lives in `user/` precisely so that `common/security` depends only on Spring's
interfaces and not on a feature.

| Layer | Job | Knows about HTTP? | Knows about SQL? |
| --- | --- | --- | --- |
| Controller (`@RestController`) | Map URL + JSON to a method call, check the role, pick the status | yes | no |
| Service (`@Service`) | Business rules, ownership checks, transactions, entity → DTO | no | no |
| Repository (interface) | Queries | no | yes |
| Entity (`@Entity`) | One row of one table | no | mapping only |
| Mapper (MapStruct `@Mapper`) | Entity → DTO, generated at compile time | no | no |

**One module talks to another through an event.** `application` depends on `job` (an application belongs to
a posting). When a posting is closed, `job` must tell `application`, and a direct call would make the two
modules depend on each other. So `JobService` publishes a `JobClosedEvent` and
`JobApplicationService.onJobClosed` listens with `@EventListener`. The listener runs synchronously, inside
the transaction that closed the posting.

**Cross-cutting concerns with AOP.** `LoggingAspect` and `PerformanceMonitorAspect` apply to every method
of every class whose name ends in `Controller` or `Service`, and log the method name and its duration.
They deliberately do not log arguments or return values, because an earlier version wrote applicant
contact details and account tokens into the log.

**Is it MVC?** Partly. Spring MVC is the web framework (`spring-boot-starter-web`), and the controllers are
the "C". But the server renders no HTML, so there is no server-side "V". The accurate description is:
*a REST API built on Spring MVC with a layered architecture; the view is a React application that the same
jar happens to serve as static files.*

**REST.** Resources are nouns (`/jobs`, `/applications`, `/companies`, `/notifications`), HTTP methods are
the verbs, and the server keeps no session. Several endpoints are actions rather than resources
(`/auth/login`, `/applications/{id}/withdraw`, `/admin/jobs/{id}/decision`), which is normal.

### 6.3 Frontend architecture

A single-page application: one HTML page, and React Router swaps components when the URL changes.

```
main.jsx           fonts, tokens.css, base.css, renders <App/>
App.jsx            QueryClientProvider > AuthProvider > BrowserRouter > ToastProvider > AppShell > Routes
pages/             JobList, JobDetail, auth.jsx (4 pages), seeker.jsx (3), employer.jsx (3),
                   misc.jsx (Home, Notifications, Profile, NotFound), admin.jsx
components/        AppShell, ProtectedRoute, ErrorBoundary, JobRow, SalaryPanel, ApplicationTimeline
components/ui/     index.jsx (Button, Input, Modal, Toast, ...), kit.jsx (ResponseClock, StageTrack, ...)
context/           AuthContext: the signed-in user, login/register/logout
services/          one function per API endpoint, all through api.js
lib/format.js      lakhs, salaryRange, relativeDate, daysUntil, statusTone
styles/tokens.css  every colour, size, radius and duration as a CSS variable
```

**State management.** Three kinds of state, each with its own tool:

| Kind | Tool | Example |
| --- | --- | --- |
| Server data | TanStack Query cache | `['jobs', filters, sort, page]`, `['my-applications']` |
| Session | React Context + `localStorage` | `AuthContext`: `user`, `isEmployer`, `isJobSeeker`, `isAdmin` |
| Navigation state | The URL | Search filters in `JobList`, page number in the admin queue |
| Form state | react-hook-form | Login, register, post a job, profile, apply |

There is no Redux. Nothing in the app needs a global store beyond the session.

**Styling.** Hand-written CSS with design tokens (`--jp-*` variables in `tokens.css`), no component
library and no CSS framework. The rules are in `DESIGN.md`: no gradients, no shadows except the modal,
marigold (`--jp-signal`) is used only for time. The modal is the one borrowed primitive
(`@radix-ui/react-dialog`), because focus trapping and Escape handling are hard to get right by hand.

### 6.4 Authentication architecture

A stateless JWT access token (24 hours) plus an opaque refresh token stored in the database (7 days).
"Stateless" needs a caveat here: the server keeps no session, but the filter does load the user from the
database on every request. Details in §10.

### 6.5 Database architecture

One PostgreSQL database, 10 entity tables and 4 collection tables, all in one schema. Details in §7.

### 6.6 Deployment architecture

```mermaid
flowchart LR
    U[User's browser] -->|HTTPS| P[TLS-terminating proxy<br/>not in the repo]
    P -->|:8080| APP[app container<br/>Spring Boot jar = API + React build<br/>non-root, HEALTHCHECK]
    APP -->|JDBC, compose network| PG[(db container<br/>postgres:16-alpine<br/>volume pgdata)]
    APP --> UP[(volume uploads)]
    GH[GitHub repo] -->|push or pull request| CI[GitHub Actions<br/>frontend: lint + build<br/>backend: clean verify with Postgres<br/>main only: docker build]
```

The repository contains everything needed to run the stack (`Dockerfile`, `docker-compose.yml`,
`.env.example`, CI). It contains **no hosting configuration**: nothing in the repo deploys it to a cloud
provider. Details in §12.

### 6.7 Why this architecture

- **One jar serving both the API and the SPA** means one process to run, one port, the same origin (so no
  CORS in production) and no way for a frontend build and an API build to drift apart.
- **Layering** keeps HTTP, rules and SQL apart, so each can be tested and changed alone. The service tests
  run without a web server or a database.
- **Package by feature** means a change to applications touches one folder.
- **A monolith** is the right size: one developer, one database, and features that share tables
  (applications join jobs and users in almost every query). Microservices would add network calls and
  distributed transactions with no benefit at this scale.
- **Ownership checks in the service, not the controller**, so every caller of the service gets them.

---

## 7. Database Analysis

### 7.1 Why PostgreSQL

The data is relational (users own companies and postings, postings receive applications, applications have
events) and several features lean on PostgreSQL directly: `PERCENTILE_CONT … WITHIN GROUP` for salary
percentiles and the median response time, `COUNT(*) FILTER (WHERE …)` for the on-time count, CHECK
constraints for enum columns, and a unique index that makes double applications impossible. There is no H2
fallback: tests that start the Spring context need a real PostgreSQL.

### 7.2 ER diagram

```mermaid
erDiagram
    USERS ||--o{ COMPANIES : owns
    USERS ||--o{ JOB_POST : "posts (posted_by_id)"
    USERS ||--o{ JOB_POST : "reviews (reviewed_by_id)"
    USERS ||--o{ JOB_APPLICATIONS : submits
    USERS ||--o{ SAVED_JOBS : bookmarks
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ MATCH_SCORES : "scored for"
    USERS ||--o{ REFRESH_TOKENS : holds
    USERS ||--o{ ADMIN_ACTIONS : performs
    USERS ||--o{ USER_SKILLS : has
    COMPANIES ||--o{ JOB_POST : "listed under"
    JOB_POST ||--o{ JOB_APPLICATIONS : receives
    JOB_POST ||--o{ SAVED_JOBS : "saved as"
    JOB_POST ||--o{ MATCH_SCORES : "scored against"
    JOB_POST ||--o{ JOB_POST_POST_TECH_STACK : requires
    JOB_APPLICATIONS ||--o{ APPLICATION_EVENTS : "history of"
    MATCH_SCORES ||--o{ MATCHED_SKILLS : lists
    MATCH_SCORES ||--o{ MISSING_SKILLS : lists

    USERS {
        integer id PK
        varchar email UK
        varchar password "BCrypt hash"
        varchar role "EMPLOYER, JOB_SEEKER, ADMIN"
        varchar full_name
        varchar resume_path
        boolean is_email_verified
        varchar email_verification_token
        varchar password_reset_token
        timestamp password_reset_expiry
        boolean is_profile_public
        boolean is_banned
    }
    COMPANIES {
        integer id PK
        varchar name
        integer owner_id FK
        varchar logo_path
    }
    JOB_POST {
        integer post_id PK
        varchar post_profile "the job title"
        text post_desc
        integer req_experience
        integer posted_by_id FK
        integer company_id FK "nullable"
        numeric salary_min
        numeric salary_max
        varchar job_type
        boolean is_remote
        boolean is_active "employer's switch"
        boolean is_featured
        varchar status "moderation state"
        text moderation_reason
        integer reviewed_by_id FK
        integer view_count
        timestamp posted_date
    }
    JOB_APPLICATIONS {
        integer id PK
        integer job_post_id FK
        integer applicant_id FK
        text cover_letter
        varchar status "8 values"
        timestamp applied_date
        timestamp respond_by
        timestamp responded_at
        timestamp reminder_sent_at
    }
    APPLICATION_EVENTS {
        integer id PK
        integer application_id FK
        varchar from_status "null for the first row"
        varchar to_status
        integer actor_id FK "null = system"
        text note
        timestamp created_at
    }
    SAVED_JOBS {
        integer id PK
        integer user_id FK
        integer job_post_id FK
    }
    NOTIFICATIONS {
        integer id PK
        integer user_id FK
        varchar title
        varchar type
        varchar action_url
        boolean is_read
    }
    MATCH_SCORES {
        integer id PK
        integer user_id FK
        integer job_post_id FK
        float score "0 to 100"
    }
    REFRESH_TOKENS {
        integer id PK
        integer user_id FK
        varchar token UK
        timestamp expiry_date
        boolean revoked
    }
    ADMIN_ACTIONS {
        integer id PK
        integer admin_id FK
        varchar action
        varchar target_type
        integer target_id
        text reason
        timestamp created_at
    }
```

### 7.3 Tables

| Table | Purpose | Notes |
| --- | --- | --- |
| `users` | Accounts for all three roles | Holds the BCrypt hash, the verification token and the reset token as plain columns |
| `user_skills` | A user's skills | A collection table: `(user_id, skill)`, no id of its own |
| `companies` | Company profiles | Each has exactly one owner |
| `job_post` | Postings | Two independent flags decide visibility: `status = 'PUBLISHED'` (the admin's) **and** `is_active` (the employer's) |
| `job_post_post_tech_stack` | A posting's tech stack | Collection table; the awkward name is Hibernate's default |
| `job_applications` | One row per (job, applicant) | Carries the deadline (`respond_by`) and the first answer (`responded_at`) |
| `application_events` | The timeline | One row per status change, written in the same transaction as the change |
| `saved_jobs` | Bookmarks | A join table with its own id and a timestamp |
| `match_scores`, `matched_skills`, `missing_skills` | Cached match results | One score per (user, job), computed once and never refreshed |
| `notifications` | In-app notifications | Only two types exist: `APPLICATION_RECEIVED`, `APPLICATION_STATUS_CHANGED` |
| `refresh_tokens` | Refresh tokens | A random UUID, not a JWT |
| `admin_actions` | Audit log | One row per admin write, in the same transaction as the write |

### 7.4 Keys and relationships

- **Primary keys**: every entity table has an `INTEGER GENERATED BY DEFAULT AS IDENTITY` id.
- **One-to-many**: user → companies, user → postings, company → postings, posting → applications,
  application → events, user → notifications, user → refresh tokens.
- **Many-to-many, through tables with their own data**: users ↔ jobs appears three times, as
  `job_applications` (an application), `saved_jobs` (a bookmark) and `match_scores` (a score). Each is
  modelled as its own entity with two `@ManyToOne` sides rather than a bare `@ManyToMany`, because each
  carries extra columns.
- **One-to-one**: none.
- **On delete**: only `application_events.application_id` has `ON DELETE CASCADE`. Every other foreign key
  has no delete rule, so PostgreSQL refuses to delete a row that is still referenced. The consequence is in
  §13.1: deleting a posting that someone has saved, or that has a match score, fails.

### 7.5 Constraints

| Constraint | Purpose |
| --- | --- |
| `users.email` UNIQUE, NOT NULL | One account per email |
| `users.role` CHECK in (`EMPLOYER`, `JOB_SEEKER`, `ADMIN`) | The enum is enforced by the database too (widened in V3) |
| `job_post.status` CHECK in 4 values, NOT NULL | Moderation state (V2) |
| `job_post.job_type` CHECK in 5 values | Enum column |
| `job_applications.status` CHECK in 8 values, NOT NULL | Lifecycle state (widened in V4) |
| `notifications.type` CHECK in 2 values | Enum column |
| UNIQUE `(job_post_id, applicant_id)` on `job_applications` | One application per person per job, even under a double click (V4) |
| UNIQUE `(user_id, job_post_id)` on `saved_jobs` | One bookmark per person per job |
| `refresh_tokens.token` UNIQUE | Lookup key |

**What is missing**: no CHECK that `salary_min <= salary_max`, no NOT NULL on the job title or on most
boolean flags, no unique constraint on `match_scores (user_id, job_post_id)` although the code treats that
pair as a cache key, and email uniqueness is case-sensitive (`A@x.com` and `a@x.com` are two accounts).

### 7.6 Indexes

| Index | Why |
| --- | --- |
| `idx_job_post_status_active (status, is_active)` | Every public listing filters on this pair |
| `idx_job_post_posted_date (posted_date)` | "Newest first" |
| `idx_job_post_comparables (is_active, location, req_experience)` | The salary-comparables query |
| `uq_job_applications_job_applicant (job_post_id, applicant_id)` | Uniqueness, and "applicants of this job" |
| `idx_job_applications_status_respond_by (status, respond_by)` | The hourly deadline scan |
| `idx_application_events_application (application_id, created_at)` | Reading one timeline in order |
| `idx_admin_actions_target (target_type, target_id)`, `idx_admin_actions_admin (admin_id, created_at)` | Audit lookups |
| Unique indexes behind `users.email`, `refresh_tokens.token`, `saved_jobs (user_id, job_post_id)` | Created by the constraints |

**Not indexed** (PostgreSQL does not index foreign keys automatically): `job_applications.applicant_id`
("my applications"), `notifications.user_id` (polled every 60 seconds by every open tab),
`job_post.posted_by_id` ("my jobs", and the join in the responsiveness query), and
`match_scores (user_id, job_post_id)`. Fine at the current size; these are the first indexes to add.

### 7.7 Flyway migrations

The schema is created only by SQL files in `src/main/resources/db/migration`. Flyway runs any file it has
not run before, in version order, at startup, and records it in `flyway_schema_history`.

| File | What it does |
| --- | --- |
| `V1__baseline.sql` | The whole schema as Hibernate's `ddl-auto=update` had left it. Existing databases are *stamped* at V1 (`baseline-on-migrate`) and never run this file; a fresh database runs it and arrives at the same place |
| `V2__job_moderation_status.sql` | Replaces the `is_approved` boolean with a `status` column. Adds the column nullable, **backfills** it, then makes it NOT NULL and adds the CHECK. Adds `moderation_reason`, `reviewed_at`, `reviewed_by_id` |
| `V3__admin_role.sql` | Widens the role CHECK to include `ADMIN`; creates `admin_actions` |
| `V4__application_lifecycle.sql` | Widens the status CHECK to 8 values; adds `respond_by`, `responded_at`, `reminder_sent_at`; gives waiting applications 14 days from migration day; **deletes duplicate applications, keeping the earliest**, then adds the unique index; creates `application_events` |

`spring.jpa.hibernate.ddl-auto=validate`: at startup Hibernate compares the entity classes with the real
tables and **refuses to start** if they disagree. Hibernate never changes the schema.

The comments in the migrations explain the reasoning, and two are worth quoting in an interview. V2: the
boolean "could not say 'rejected, and here is why', and every read path that forgot to add
`AND is_approved` silently served unreviewed postings — five of the seven job queries did." V4: "'Already
applied' was a read followed by a write with nothing behind it, so two fast clicks could insert twice."

### 7.8 Entities and mapping

Each table has a class annotated `@Entity`. Example, the important part of `job/JobPost.java`:

```java
@Entity
@Table(name = "job_post", indexes = { @Index(name = "idx_job_post_status_active", columnList = "status, is_active"), ... })
public class JobPost {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer postId;

    @ElementCollection(fetch = FetchType.EAGER)
    private List<String> postTechStack;

    @ManyToOne(fetch = FetchType.EAGER) @JoinColumn(name = "posted_by_id")
    private User postedBy;

    @ManyToOne(fetch = FetchType.EAGER) @JoinColumn(name = "company_id")
    private Company company;

    private BigDecimal salaryMin;

    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 32) @Builder.Default
    private JobStatus status = JobStatus.PENDING_REVIEW;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "reviewed_by_id")
    private User reviewedBy;

    @CreationTimestamp
    private LocalDateTime postedDate;
}
```

Points an interviewer may probe:

- **Associations are real `@ManyToOne` objects, and most are `EAGER`.** Loading one `JobPost` also loads
  its poster, the poster's skills, its company, the company's owner and that owner's skills, and the tech
  stack. For a list of jobs this is the **N+1 query problem** (§13.2). `LAZY` is used for
  `JobPost.reviewedBy`, `SavedJob.user`, `Notification.user`, `MatchScore.user/jobPost`,
  `RefreshToken.user` and both sides of `ApplicationStatusEvent`.
- **`@ElementCollection`** maps a list of plain strings to a separate table without making a class for it.
- **`@Enumerated(EnumType.STRING)`** stores `"PUBLISHED"`, not `1`. Reordering the enum later cannot
  corrupt data.
- **The default status is `PENDING_REVIEW`**, so "a posting is not public until something says so, rather
  than public until something objects" (comment in the entity).
- **`@CreationTimestamp` / `@UpdateTimestamp`** let Hibernate fill in timestamps. They are
  `LocalDateTime`, which means the server's local time zone with no zone stored (§13.4).
- **Lombok** generates getters, setters and builders. `User`, `Company`, `JobPost`, `SavedJob` and
  `AdminAction` use `@Getter @Setter`. `JobApplication`, `Notification`, `MatchScore`, `RefreshToken` and
  `ApplicationStatusEvent` still use `@Data`, which generates `equals`/`hashCode` over every field
  including associations. That is not recommended for JPA entities.
- **Entities stay inside the service layer** in `user`, `company`, `job`, `application` and `admin`:
  services return DTOs, and `matching` now maps `MatchScore` to `MatchScoreResponse` in its controller.
  **`notification` still returns its entity**, controlled with `@JsonIgnore` on the `user` field.
  Returning the `MatchScore` entity is what caused the leak described in §10.8.
- **`spring.jpa.open-in-view` is left at its default (on)**, so the database session stays open while the
  JSON is written. That is what allowed the entity-returning endpoints to serialise lazy fields at all.

### 7.9 How data is inserted, read, updated and deleted

Spring Data JPA offers four ways to define a query. This project uses all four:

1. **Inherited methods** from `JpaRepository`: `save`, `findById`, `deleteById`, `getReferenceById`.
2. **Derived queries**, where the method name *is* the query:
   `findByStatusAndIsActiveTrue(JobStatus status, Pageable pageable)`,
   `findByStatusAndRespondByBeforeAndReminderSentAtIsNull(...)`,
   `countByApplicantIdAndAppliedDateAfter(applicantId, since)`,
   `findByIdAndUserId(id, userId)`.
3. **JPQL with `@Query`** (written against entity and field names), for example the advanced search:
   ```java
   @Query("SELECT j FROM JobPost j WHERE j.isActive = true AND j.status = :status "
        + "AND (CAST(:keyword AS string) IS NULL "
        + "     OR LOWER(j.postProfile) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')) "
        + "     OR LOWER(j.postDesc) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%'))) "
        + "AND (:jobType IS NULL OR j.jobType = :jobType) ...")
   Page<JobPost> advancedSearch(...);
   ```
   The `CAST(... AS string)` is there because when the parameter is null PostgreSQL cannot infer its type
   inside `lower()` and fails with `function lower(bytea) does not exist`.
4. **Native SQL** with `nativeQuery = true`, where PostgreSQL features are needed:
   ```sql
   SELECT COUNT(*) AS decided,
          COUNT(*) FILTER (WHERE a.responded_at <= a.respond_by) AS onTime,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY
              EXTRACT(EPOCH FROM (a.responded_at - a.applied_date)) / 86400.0) AS medianDays
   FROM job_applications a JOIN job_post j ON j.post_id = a.job_post_id
   WHERE j.posted_by_id = :employerId AND a.applied_date >= :since AND a.respond_by IS NOT NULL
     AND (a.responded_at IS NOT NULL OR (a.respond_by < :now AND a.status <> 'WITHDRAWN'))
   ```
   The result is mapped to an **interface projection** (`ResponsivenessStats` with `getDecided()`,
   `getOnTime()`, `getMedianDays()`); Spring matches column aliases to getter names. `SalaryStats` works
   the same way for the salary percentiles.

**How Hibernate executes them.**

- **Insert**: `save(newEntity)` → `INSERT`. With IDENTITY ids the insert happens at once to obtain the id.
- **Read**: every query is a JDBC `PreparedStatement` with `?` placeholders. Values travel separately from
  the SQL text, which is why SQL injection is not possible here.
- **Update**: a loaded entity is *managed*. Changing a field and committing makes Hibernate issue an
  `UPDATE` (dirty checking). The explicit `save(...)` calls in the services are not strictly needed inside
  a transaction, but they make the intent clear.
- **Atomic update**: the view counter does not load, add and save. It runs one statement, so two
  simultaneous views cannot lose each other's increment:
  ```java
  @Modifying
  @Query("UPDATE JobPost j SET j.viewCount = j.viewCount + 1 WHERE j.postId = :postId")
  void incrementViewCount(@Param("postId") Integer postId);
  ```
- **Delete**: `JobService.delete` hard-deletes a posting nobody applied to, and only switches off
  (`isActive = false`) one that has applicants, to keep their history.
- **Pagination**: passing a `Pageable` makes Spring add `ORDER BY … LIMIT ? OFFSET ?` and run a second
  `select count(…)` for the total. The sort field from the query string is checked against a whitelist
  (`postedDate`, `salaryMin`, `salaryMax`, `viewCount`) and sorted with nulls last, so sorting by pay does
  not lead with postings that disclose none.
- **Transactions**: `@Transactional` on service methods in `user`, `company`, `job`, `application` and
  `admin`; `readOnly = true` on reads. `NotificationService` and `AIService` have none of their own.

---

## 8. Codebase and File Structure

### 8.1 Top level (the git repository root is `SpringJobPortal/`)

| Path | Responsibility |
| --- | --- |
| `src/main/java` | Spring Boot API (Maven project) |
| `src/main/resources` | `application.properties`, `db/migration/*.sql` |
| `src/main/frontend` | React SPA: a separate npm project that lives inside the Maven source tree. It is not a Maven module; the two meet only in the Docker build |
| `src/test` | Backend tests |
| `pom.xml`, `mvnw`, `mvnw.cmd`, `.mvn/` | Build and the Maven wrapper |
| `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.env.example` | Container build and local full stack |
| `.github/workflows/ci.yml` | CI |
| `config/application.properties` | Local secrets. Git-ignored; Spring Boot reads `./config/` automatically |
| `uploads/` | Uploaded files at runtime. Git-ignored |
| `docs/` | `ARCHITECTURE.md` (partly out of date), `MIGRATION-PLAN.md` (abandoned), and these two files |
| `README.md`, `CLAUDE.md`, `LICENSE` | Documentation and the MIT licence |

### 8.2 Backend (`src/main/java/com/tausib/springjobportal`)

**Entry point.** `SpringJobPortalApplication.java`: `@SpringBootApplication` plus `@EnableCaching` (the
salary cache), `@EnableAsync` (emails on another thread) and `@EnableScheduling` (the deadline task).

**`common/`**

| File | Responsibility |
| --- | --- |
| `security/SecurityConfig` | The security filter chain (CSRF off, CORS on, stateless, which URLs are open), `@EnableMethodSecurity`, and the CORS rules |
| `security/SecurityBeansConfig` | `PasswordEncoder` (BCrypt) and `AuthenticationManager` beans |
| `security/JwtService` | Creates and verifies JWTs with JJWT (HS256) |
| `security/JwtAuthFilter` | Once per request: turns a valid `Bearer` token into an authenticated `UserPrincipal` |
| `config/SpaWebConfig` | Serves the React build from `classpath:/static/` and answers client routes such as `/job/3` with `index.html`; never for `/api`, actuator, Swagger or a missing file |
| `config/SwaggerConfig` | OpenAPI title and the "Bearer" security scheme for Swagger UI |
| `exception/GlobalExceptionHandler` | `@ControllerAdvice`: turns exceptions into JSON errors |
| `exception/ResourceNotFoundException`, `ForbiddenOperationException` | Thrown by services to signal 404 / 403 |
| `mail/EmailService` | Five `@Async` plain-text emails; a failed send is logged and swallowed |
| `aop/LoggingAspect`, `aop/PerformanceMonitorAspect` | Method tracing and timing |

**`user/`**: `User` (entity), `UserRole`, `UserPrincipal` (the security principal: id, email, hash, role,
banned; *not* the entity), `UserSecurityConfig` (`UserDetailsService` and `DaoAuthenticationProvider`),
`AuthController` + `AuthService` (register, login, refresh, verify, forgot, reset), `UserController` +
`UserService` (profile, uploads, visibility), `RefreshToken` + repository + service, `UserMapper`, and
eleven DTOs in `dto/`.

**`company/`**: `Company`, `CompanyRepo`, `CompanyService` (CRUD with `requireOwner`, and
`getOwnedEntityById` for the job module), `CompanyController`, `CompanyMapper`, three DTOs.

**`job/`**: `JobPost`, `JobStatus`, `JobType`, `JobRepo` (the "visible" finders, the search, the atomic
view counter, the salary-comparables query), `JobService` (visibility rule, create with gates G1 and G2,
patch-style update with re-review, close or delete), `SavedJob` + repository + `SavedJobService`,
`JobClosedEvent`, `SalaryStats` (projection), `JobController`, `JobMapper`, four DTOs.

**`application/`**: `JobApplication`, `ApplicationStatus` (the state machine), `ApplicationStatusEvent`,
two repositories, `JobApplicationService` (391 lines, the largest class: apply, list, transition, withdraw,
timeline, job-closed listener, lapse, reminders, responsiveness, resume), `ApplicationDeadlineTask`,
`JobApplicationController`, `ApplicationMapper`, three DTOs.

**`admin/`**: `AdminController`, `AdminService` (decide, feature, ban, audit log), `AdminAction` +
repository, `AdminSeeder`, three DTOs.

**`notification/`**: `Notification`, `NotificationType`, repository, service, controller.

**`matching/`**: `AIService` (rule-based skill matching; the name is historical, there is no model in it),
`MatchScore` + repository, `SalaryEstimateService` (SQL percentiles + Gemini narrative), `AIController`,
`SalaryEstimateResponse`, `MatchScoreResponse`.

**`dashboard/`**: `DashboardController` (builds the totals itself from `JobService` and
`JobApplicationService`), `DashboardStats`.

**`file/`**: `FileStorageService` (validate, store, load with a path-escape check, content type by
extension), `FileController` (public, photos and logos only).

**Resources**: `application.properties` (every deploy-relevant value is a `${ENV_VAR:default}`
placeholder; the database password and the JWT secret have no default, so the app refuses to start without
them), `db/migration/V1…V4`.

**Build**: `pom.xml` (parent `spring-boot-starter-parent` 3.4.3, Java 21). The compiler plugin runs three
annotation processors in a fixed order: Lombok, the Lombok–MapStruct binding, MapStruct. MapStruct is
configured with `unmappedTargetPolicy=ERROR`, so a DTO field with no source **fails the build** instead of
silently being null.

### 8.3 Frontend (`src/main/frontend/src`)

| File | Responsibility | Depends on / used by |
| --- | --- | --- |
| `main.jsx` | Entry point. Loads self-hosted fonts (Fontsource), `tokens.css`, `base.css`, mounts `<App/>` in `StrictMode` | `index.html` |
| `App.jsx` | Providers, the `QueryClient` defaults, the route table; every route is wrapped in an `ErrorBoundary` | All pages |
| `services/api.js` | The Axios instance, both interceptors, `errorMessage` | Every service file |
| `services/*Service.js` | One exported function per endpoint | Pages |
| `context/AuthContext.jsx`, `auth-context.js` | `AuthProvider`: `user`, `login`, `register`, `logout`, `updateUser`, role flags | `App.jsx`, `AppShell`, `ProtectedRoute`, pages |
| `components/ProtectedRoute.jsx` | Redirects by sign-in state and role | `App.jsx` |
| `components/ErrorBoundary.jsx` | Class component that catches render crashes and offers "Try again" | `App.jsx` |
| `components/layout/AppShell.jsx` | Header, role-based navigation, unread bell (polls every 60 s), footer, phone tab bar, the session-expired listener | `App.jsx` |
| `components/JobRow.jsx` | One job in a list, plus its skeleton | `JobList`, `SavedJobs`, `Recommendations`, `Home` |
| `components/SalaryPanel.jsx` | Percentile band and the narrative | `JobDetail` |
| `components/ApplicationTimeline.jsx` | Loads and shows one application's history when opened | `MyApplications`, `ManageApplications` |
| `components/ui/index.jsx` | `Button`, `IconButton`, `Field`, `Input`, `Textarea`, `Select`, `Badge`, `Card`, `Skeleton`, `EmptyState`, `Modal`, `ToastProvider` | Everywhere |
| `components/ui/kit.jsx` | `ResponseClock`, `StageTrack`, `Monogram`, `Facts`, `Proofs`, `Stat`, `SegmentBar`, `PageHead` | Pages |
| `pages/JobList.jsx`, `JobDetail.jsx` | Search and one job | |
| `pages/auth.jsx` | `Login`, `Register`, `ForgotPassword`, `ResetPassword` | |
| `pages/seeker.jsx` | `MyApplications`, `SavedJobs`, `Recommendations` | |
| `pages/employer.jsx` | `EmployerDashboard`, `ManageApplications`, `PostJob` (944 lines, the largest file) | |
| `pages/misc.jsx` | `Home`, `Notifications`, `Profile`, `NotFound` | |
| `pages/admin.jsx` | `AdminReview` | |
| `lib/format.js` | `lakhs`, `salaryRange`, `relativeDate`, `fullDate`, `daysUntil`, `statusTone`, `titleCase` | Most pages |
| `styles/tokens.css`, `base.css` | Design tokens and base rules | Everything |

**Routes** (from `App.jsx`): public `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`,
`/jobs`, `/job/:id`; signed in `/profile`, `/notifications`; employer `/post-job`, `/post-job/:id`,
`/employer-dashboard`, `/manage-applications`; seeker `/my-applications`, `/saved-jobs`,
`/recommendations`; admin `/admin`; everything else → `NotFound`.

**Hooks.** One custom hook, `useToast()`. Built-in and library hooks in use: `useState`, `useEffect`,
`useContext`, `useRef`, `useMemo`, `useCallback`, `useId`; `useQuery`, `useMutation`, `useQueryClient`;
`useForm`, `useWatch`; `useNavigate`, `useLocation`, `useParams`, `useSearchParams`.

**Frontend config files**: `package.json`, `vite.config.js` (the React plugin and a small plugin that
renames the "Archivo Variable" font family to "Archivo"), `eslint.config.js`, `.env.example`, `DESIGN.md`
(the design rules), `e2e/` (Playwright scripts), `design-audit/` (before and after screenshots).

### 8.4 Tests

| Test class | Kind | What it proves |
| --- | --- | --- |
| `JobApplicationServiceTest` (15) | Unit, Mockito | Cannot list or decide someone else's applicants; resume only for the hiring employer and the applicant; one stage at a time, no skipping; the first move is the response and is written to the timeline; a later stage does not move the response time; cannot apply to a posting the public cannot see; the daily limit; a missed deadline is marked but never counts as an answer; only the applicant can withdraw; closing a posting rejects what is open; no response rate from a handful of applications |
| `AdminServiceTest` (7) | Unit, Mockito | Publishing clears an earlier refusal and records who did it; refusing needs a reason; "pending" is not a decision; only a published posting can be featured; a ban ends the account's sessions; reinstating does not; an admin cannot ban themselves or another admin |
| `SalaryEstimateServiceTest` (7) | Unit, Mockito | Percentiles + narrative when comparables exist; fallback to percentiles when the model fails; small samples are flagged; no comparables means no model call; the rate limit skips the model; confidence bands; null location and experience |
| `AIControllerTest` (1) | Unit, Mockito | The recommendations response carries no password hash, reset token or email of the seeker or the employer |
| `FileStorageServiceTest` (3) | Unit, temp directory | Serves a file inside the upload directory; refuses `../..`; refuses an absolute path |
| `SpaAndOpsEndpointsTest` (4) | Full context, MockMvc, real PostgreSQL | Deep links return the SPA; `/api` is untouched by the fallback; a missing asset is 404, not HTML; only `health` and `info` are public |
| `NoCommittedApiKeyTest` (2) | Repository scan | No model API key is committed anywhere; the key property reads from the environment |
| `SpringJobPortalApplicationTests` (1) | Smoke | The Spring context starts (Flyway runs, Hibernate validates) |

Total: **40 backend tests.** The frontend has **no unit tests**; it has two Playwright scripts that are run
by hand: `npm run shots` (screenshots of every page at three widths against a mocked API) and
`node e2e/smoke.mjs` (registers a throwaway seeker and employer against a real backend, walks their pages,
reports console errors and failed calls).

---

## 9. Technology Stack and Design Decisions

Versions are taken from `pom.xml` and `package.json`.

### 9.1 Backend

**Java 21**
- *What / why*: a statically typed, compiled language on the JVM; 21 is a long-term support release.
- *Features this project uses*: `record` (`JobClosedEvent`, `EmployerResponsiveness`, `TimelineEntry`,
  `SalaryEstimateResponse`, `ResumeDownload`), text blocks `"""` (SQL and prompts), `switch` expressions
  (`ApplicationStatus.nextForEmployer`), `var`, `Optional`, streams, `Stream.toList()`.
- *Advantages*: type safety, mature ecosystem, strong tooling.
- *Limitations*: verbose (reduced here with Lombok); slower startup and more memory than Node or Go.
- *Alternatives*: Node.js with NestJS (one language for both halves), Python with Django or FastAPI.
- *Why Java here*: role-based security, transactions and scheduled work are areas where Spring is strong.

**Spring Boot 3.4.3**
- *What*: a framework that assembles a production-ready Spring application with little configuration.
- *How it works*: **starters** pull in groups of libraries; **auto-configuration** creates beans from what
  is on the classpath and in `application.properties`; the **IoC container** creates objects ("beans") and
  injects them (dependency injection); an **embedded Tomcat** makes the app one runnable jar.
- *Limitations*: a lot happens by convention, which makes debugging harder until you know the conventions.

**Spring MVC (`spring-boot-starter-web`)**: `DispatcherServlet` routes each request to a controller
method, converts JSON with Jackson, and resolves `@RequestBody`, `@PathVariable`, `@RequestParam`,
`@AuthenticationPrincipal`. Blocking: one thread per request.

**Spring Security + JJWT 0.11.5**: see §10. Note that 0.11.5 is an older JJWT line (the code uses
`parserBuilder()` and `signWith(key, SignatureAlgorithm.HS256)`, which 0.12 replaced). Alternative: Spring's
own OAuth2 resource-server support could replace the hand-written filter.

**Spring Data JPA / Hibernate**
- *What*: JPA is the standard API for mapping objects to tables; Hibernate implements it; Spring Data JPA
  generates repository implementations from interfaces.
- *Advantages*: CRUD with no code, derived queries, pagination, dirty checking, and still room for JPQL
  and native SQL.
- *Limitations*: it hides the SQL, and eager associations produce N+1 queries (§13.2).
- *Alternatives*: `JdbcTemplate` (full control, more code), MyBatis, jOOQ.

**PostgreSQL**: see §7.1. *Alternative*: MySQL would work for the CRUD, but the percentile and `FILTER`
queries would have to be rewritten.

**Flyway**: versioned SQL migrations. *Alternative*: Liquibase; or `ddl-auto=update`, which this project
used at first and left because "update never drops, so a removed column or entity lingered and a rename
left both names behind" (comment in `application.properties`).

**Bean Validation**: `@NotBlank`, `@Email`, `@NotNull`, `@Size`, `@PositiveOrZero` on request DTOs,
triggered by `@Valid`.

**MapStruct 1.6.3 + Lombok 1.18.42**: MapStruct generates entity → DTO mappers at compile time (no
reflection, and a missing mapping breaks the build). Lombok generates getters, setters, builders and
constructors. *Alternative*: hand-written mappers; Java records for DTOs (used for the newer ones).

**Spring AOP**: the two logging aspects. A proxy wraps each matching bean and runs the advice around the
real method.

**Spring AI 1.0.0** (`spring-ai-starter-model-openai`): `ChatClient` for the salary narrative. The model
is Gemini (`gemini-3.6-flash` in `application.properties`), reached through Google's **OpenAI-compatible
endpoint**, because Spring AI 1.0.0 has no Google AI Studio starter and its Vertex AI starter needs a
Google Cloud project instead of a free API key. `.entity(Narrative.class)` asks Spring AI to parse the
model's JSON into a record (structured output).

**Spring Cache + Caffeine**: an in-memory cache with a time limit (60 minutes, 1,000 entries) for salary
estimates. The default simple cache has no expiry, which is why Caffeine was added.

**Spring Mail**, **`@Async`**, **`@Scheduled`**: plain-text emails sent on a small thread pool (2 to 5
threads); the hourly deadline task.

**springdoc-openapi 2.7.0**: generates OpenAPI and Swagger UI from the controllers.
**Actuator**: `/actuator/health` and `/actuator/info` only, without details.
**commons-io 2.15.1**: `FilenameUtils.getExtension`.

**Maven**: build tool and dependency manager; the wrapper (`mvnw`) means no local install is needed.

**Testing**: JUnit 5, Mockito (service tests with mocked repositories), MockMvc and `@SpringBootTest`
(the two context tests, against a real PostgreSQL supplied by the developer or by CI).

### 9.2 Frontend

**React 19**: a library for building user interfaces from components; the UI is a function of state.
*Alternatives*: Angular (a full framework), Vue. *Limitation*: it is only the view layer.

**Vite 8**: development server with hot reload, and the production bundler. Variables prefixed `VITE_`
are **inlined at build time**; they are public, never secret.

**React Router 7**: client-side routing: `<Routes>`, `<Navigate>`, `useNavigate`, `useParams`,
`useSearchParams` (the last one is what makes "the URL is the state" possible in `JobList`).

**TanStack Query 5**: fetches, caches and refetches server data. It removes the hand-written
`useEffect` + `loading` + `error` pattern and gives cache invalidation after writes. *Alternative*: plain
`useEffect`, or Redux Toolkit Query.

**react-hook-form 7**: form state and validation with few re-renders. *Alternative*: controlled inputs
with `useState`, or Formik.

**Axios**: HTTP client. *Versus fetch*: interceptors, automatic JSON, rejection on HTTP error statuses.

**@radix-ui/react-dialog**: an unstyled, accessible modal. **lucide-react**: icons.
**Fontsource**: self-hosted Archivo, IBM Plex Sans and IBM Plex Mono, so no request goes to Google Fonts.

**No TypeScript, no component library, no CSS framework.** Plain JavaScript and hand-written CSS with
tokens. The trade-off is in §13.4.

**ESLint 9** (`npm run lint`), **Playwright** (screenshots and the smoke script).

### 9.3 Infrastructure

**Docker**: a three-stage `Dockerfile` (Node builds the SPA, a JDK builds the jar with the SPA inside, a
JRE runs it). **Docker Compose**: the app and PostgreSQL 16 together. **GitHub Actions**: CI.

### 9.4 Design decisions

| Decision | Chosen | Alternative | Reason |
| --- | --- | --- | --- |
| Deployable | One jar serves API and SPA | Separate static host + API | One process, same origin, no CORS in production |
| Backend shape | Modular monolith | Microservices | One developer, one database, shared tables. A migration plan was written and dropped |
| Moderation | `JobStatus` enum + reason | `isApproved` boolean | A boolean cannot carry a reason, and five of seven queries had forgotten to filter on it |
| Application status | State machine in one method | Any status settable | Skipped stages and reopened applications become impossible; the UI gets `nextStatuses` from the server |
| History | `application_events` written in the same transaction | Derive from logs | The timeline can never disagree with the status |
| Double applications | Unique index | A check in Java only | The check is a read followed by a write; only the database can close the race |
| Module coupling | `JobClosedEvent` | `JobService` calls `JobApplicationService` | Avoids a circular dependency between `job` and `application` |
| Principal | `UserPrincipal` | The `User` entity implements `UserDetails` | The entity never becomes the security context or crosses a controller |
| First admin | Promote an existing account from a property | Default admin credentials | No default password to forget; the account has a password its owner chose |
| Salary numbers | SQL percentiles; the model only explains | Ask the model for a salary | The model cannot invent a figure it was not given |
| LLM failure | Return percentiles without a narrative | Fail the request | A slow or unavailable model must not break the page |
| Auto-apply | Removed; apply to at most 5 ticked jobs, 20 per day | Apply to every match automatically | Every application puts a deadline on an employer, so flooding them works against "answers you" |
| Schema | Flyway + `validate` | `ddl-auto=update` | Reviewable, repeatable, supports backfills, catches drift at startup |
| Notifications | Polling every 60 s | WebSockets | Simple, and good enough for a status change that is not urgent |
| Server data on the frontend | TanStack Query | `useEffect` + `useState` | Caching and invalidation written once |
| Search filters | In the URL | In component state | Shareable, bookmarkable, back button works |

---

## 10. Authentication and Security

### 10.1 Authentication vs authorization

- **Authentication** = *who are you?* Answered by email and password at login, and afterwards by the JWT.
- **Authorization** = *what may you do?* Here: the path rule, the role (`@PreAuthorize`), and the ownership
  check in the service (§2).

### 10.2 Registration and password handling

`AuthService.register` → `passwordEncoder.encode(request.getPassword())` → `BCryptPasswordEncoder`.

BCrypt is a deliberately slow, salted, one-way hash. *One-way*: the password cannot be recovered from the
hash. *Salted*: a random salt is generated per password and stored inside the hash string, so two users
with the same password have different hashes. *Slow*: a work factor (default 10) makes brute force
expensive. Login compares with `matches(raw, hash)`, which re-hashes with the stored salt.

**Password rules are inconsistent** (§10.8): the register form asks for 8 characters, but the backend's
`RegisterRequest` only has `@NotBlank`, so a one-character password is accepted through the API. The reset
endpoint requires 6.

### 10.3 Login and token generation

```mermaid
sequenceDiagram
    participant B as Browser
    participant C as AuthController
    participant S as AuthService
    participant AM as AuthenticationManager
    participant P as DaoAuthenticationProvider
    participant DB as PostgreSQL
    participant J as JwtService
    B->>C: POST /api/auth/login {email, password}
    C->>S: login(request)
    S->>AM: authenticate(email, password)
    AM->>P: delegate
    P->>DB: find user by email (UserDetailsService)
    P->>P: BCrypt matches?
    alt wrong email or password, or banned (LockedException)
        P-->>B: 401 "Email or password is incorrect."
    else correct
        S->>J: generateToken(UserPrincipal)
        J-->>S: JWT, HS256, sub = email, exp = now + 24 h
        S->>DB: INSERT refresh token (random UUID, 7 days)
        C-->>B: 200 {token, refreshToken, id, fullName, email, role, ...}
        B->>B: save token, refreshToken and user in localStorage
    end
```

`JwtService.buildToken` creates a token with `sub` = the email, `iat`, and `exp` = now + `jwt.expiration`
(86,400,000 ms = 24 hours), signed with HMAC-SHA256. The key is `jwt.secret`, Base64-decoded. **No role is
put in the token.**

**What a JWT is.** Three Base64URL parts joined by dots: `header.payload.signature`. The payload is
**readable by anyone** (it is encoded, not encrypted), so it must not contain secrets. The signature is
computed from the header and payload with the server's secret; change one character of the payload and the
signature no longer matches.

### 10.4 Token validation: the security filter

`SecurityConfig.securityFilterChain`:

```java
http.cors(cors -> cors.configurationSource(corsConfigurationSource()))
    .csrf(csrf -> csrf.disable())
    .authorizeHttpRequests(auth -> auth
        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
        .requestMatchers("/api/auth/**").permitAll()
        .requestMatchers(HttpMethod.GET, "/api/jobs/**").permitAll()
        .requestMatchers(HttpMethod.GET, "/api/companies/**").permitAll()
        .requestMatchers(HttpMethod.GET, "/api/applications/employer/*/responsiveness").permitAll()
        .requestMatchers("/api/files/**").permitAll()
        .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/swagger-ui.html").permitAll()
        .requestMatchers(HttpMethod.GET, "/actuator/health", "/actuator/info").permitAll()
        .requestMatchers("/api/**", "/actuator/**").authenticated()
        .requestMatchers(HttpMethod.GET, "/**").permitAll()      // the bundled SPA
        .anyRequest().authenticated())
    .sessionManagement(sess -> sess.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
    .authenticationProvider(authenticationProvider)
    .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
```

Rules are matched **in order**, first match wins. That is why the public `GET` rules come before
`"/api/**" → authenticated()`, and why the SPA rule (`GET /**`) comes last.

`JwtAuthFilter` (a `OncePerRequestFilter`):

```java
userEmail = jwtService.extractUsername(jwt);          // verifies the signature, throws if bad
UserDetails userDetails = userDetailsService.loadUserByUsername(userEmail);   // one SELECT
if (userDetails.isAccountNonLocked() && jwtService.isTokenValid(jwt, userDetails)) {
    SecurityContextHolder.getContext().setAuthentication(
        new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities()));
}
```

Two consequences of loading the user on every request:

- **Good**: a ban and a role change apply on the next request. The comment in the filter explains that
  `isAccountNonLocked` is otherwise consulted only at password login, so "a ban would otherwise not take
  effect until the access token expired".
- **Cost**: one extra query per authenticated request (plus the eager `user_skills` query), and the
  design is not purely stateless.

Any exception in the filter is caught and printed with `System.err.println`, and the request continues
unauthenticated.

### 10.5 Refresh tokens

`RefreshTokenService.createRefreshToken` stores a random UUID with a 7-day expiry.
`POST /api/auth/refresh-token` checks that the token exists, is not revoked and has not expired, and
returns a new access token **with the same refresh token** (no rotation). *Partial*: the frontend stores
the refresh token and has a `refreshToken()` function in `authService.js`, but nothing calls it, so a user
is simply signed out when the 24-hour token ends. The `revoked` column is never set to true by any code;
tokens are only ever deleted (when the account is banned, or when an expired one is presented).

### 10.6 Password reset and email verification

- `requestPasswordReset`: if the email exists, store a random UUID token with a **1-hour** expiry and
  email a link to `/reset-password?token=…`. The response is identical whether or not the email exists,
  "so it cannot be used to enumerate accounts".
- `resetPassword`: finds the user by token, checks the expiry, stores the new BCrypt hash and clears the
  token (single use).
- `verifyEmail`: finds the user by token, sets `isEmailVerified`, clears the token. The email says the
  link expires in 24 hours, but the code has **no expiry check** for verification tokens.

Both tokens are stored **in plain text** in the `users` table (§10.8).

### 10.7 CSRF and why it is disabled

CSRF attacks work because browsers attach **cookies** automatically, even to requests triggered by another
website. This API uses no cookies: the token is added to a header by JavaScript, which a foreign site
cannot do. So there is nothing for CSRF protection to defend and it is switched off. If the token were
moved into a cookie, CSRF protection would have to be turned back on.

### 10.8 Security features: implemented vs missing

**Implemented**

| Risk | How the project handles it |
| --- | --- |
| Stolen password database | BCrypt hashes with a per-password salt |
| Account fields in match-score responses | **Fixed after commit `27a918a`, not committed yet.** `/api/ai/recommended-jobs` and `/api/ai/match-score/{jobId}` returned the `MatchScore` entity, so the JSON contained `MatchScore.user` and `MatchScore.jobPost.postedBy` as full `User` objects: BCrypt `password` hashes, `passwordResetToken`, `emailVerificationToken` and `isBanned`, of the caller **and of every employer whose job was recommended**. One response held 16 `password` fields, and because a live reset token was included, any job seeker could have taken over an employer's account. The second endpoint failed with a 500 while writing the JSON. Both now return `MatchScoreResponse` (score, matched and missing skills, `JobResponse`); verified by running: no such field in either response, and both return 200. `AIControllerTest` guards it |
| Privilege escalation at sign-up | `UserRole.isSelfAssignable()`; registration with `role: ADMIN` is refused (verified by running) |
| Acting on someone else's data (IDOR) | Ownership checks in services for jobs, companies, applications; `findByIdAndUserId` for notifications; covered by tests |
| Browsing the moderation queue by id | `JobService.isVisibleTo`: an unpublished posting is 404 for everyone but its owner and admins |
| Bypassing review | Editing the content of a published posting sets it back to `PENDING_REVIEW`; `isFeatured` and `status` are not in `JobRequest` at all |
| Posting under another company's name | `CompanyService.getOwnedEntityById` |
| Throwaway employer accounts | Posting requires `isEmailVerified` and not banned (gate G1) |
| Reading files outside the upload folder | `loadFile` normalises the path and checks `path.startsWith(uploadDir)`; tested, and verified by running (`photos/../../pom.xml` → 404) |
| Resumes readable by anyone | `/api/files` serves only `photos/` and `logos/`; a resume is reachable only through an application the caller owns or receives |
| Harvesting profiles by walking ids | `getVisibleProfile` removes email, phone and resume path for anyone but the owner; private profiles are 404 |
| Account enumeration by password reset | Same response for known and unknown emails |
| Bans that do not bite | The filter checks the locked flag on every request; the ban deletes refresh tokens |
| Unaccountable admins | `admin_actions`, written in the same transaction as the change; an admin cannot ban themselves or another admin |
| SQL injection | Only parameterised queries; the sort field is whitelisted |
| XSS | React escapes everything it renders |
| Application spam | 20 applications per 24 hours, 5 per bulk request |
| Secrets in the repository | Environment placeholders with no default for the password and JWT key; `NoCommittedApiKeyTest`; `.dockerignore` keeps `config/` and `.env` out of images |
| PII in logs | The logging aspect logs method names only |
| Container compromise | The image runs as a non-root user |
| Exposed operations endpoints | Only `health` and `info`, no details; Swagger can be switched off |

**Missing or weak** (each is visible in the code; the first was verified by running)

| Gap | Why it matters | Fix |
| --- | --- | --- |
| **A dead token gets 403, not 401** | `SecurityConfig` sets no `authenticationEntryPoint`, so Spring's default answers 403. The frontend's session-expired handling listens for 401 and therefore never runs: after 24 hours the user still looks signed in and every call fails with "Forbidden" | `.exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))` |
| Reset and verification tokens stored in plain text | Anyone who can read the table can use a live token. The leak described above showed how real that is | Store a hash of the token |
| Password reset does not end sessions | Old JWTs and refresh tokens keep working after a reset | Delete the user's refresh tokens on reset; add a token version |
| JWT in `localStorage` | Any XSS bug could read it | Short-lived access token in memory + refresh token in an `HttpOnly; Secure; SameSite` cookie |
| No server-side logout; refresh tokens never rotate; the refresh flow is unused | A copied refresh token works for 7 days; signing out removes nothing on the server | A logout endpoint that deletes the refresh token; rotate on use; wire the refresh call into the Axios interceptor |
| No rate limiting on login, register, forgot-password | Password guessing and mass sign-ups are unlimited | A rate limiter per IP and per account |
| Registration says "Email already registered" | Reveals which emails have accounts | A neutral response plus an email |
| Weak password rules on the backend | `@NotBlank` only at registration | `@Size(min = 8, max = 72)` on both DTOs (BCrypt reads only the first 72 bytes) |
| Upload validation trusts the file extension | A file named `x.pdf` can contain anything | Check the content (magic bytes); always send `Content-Disposition: attachment` for resumes |
| Employer email is public | `UserSummaryResponse` includes `email`, and every public `JobResponse` embeds the poster | A public summary without the email |
| Matching and salary endpoints skip the visibility rule | They load the job with `getEntityById`, so a signed-in user can get an estimate or score for an unpublished posting by id | Use the same `isVisibleTo` check |
| The first admin can never be joined by a second | No promote endpoint; changing a property and restarting is the only way | An admin-only promote endpoint that writes to the audit log |
| Old secrets remain in git history | The first commits contained a database password and a JWT key. They were removed and the JWT key rotated, but the old values are still in a pushed commit (`docs/ARCHITECTURE.md` §9.6) | Rotate the database password at the server; optionally rewrite history |
| `allowCredentials(true)` in CORS | Not needed without cookies | Remove it |
| Errors from the JWT filter go to `System.err` | Not in the normal log format | Use a logger at debug level |
| No Content-Security-Policy or other security headers beyond Spring Security's defaults | Less defence in depth | Configure headers |

---

## 11. Error Handling and Validation

### 11.1 Three lines of defence

| Rule | Frontend (react-hook-form) | Backend | Database |
| --- | --- | --- | --- |
| Email is present and valid | `required` + pattern | `@NotBlank @Email` | `NOT NULL UNIQUE` |
| Password length | at least 8 | `@NotBlank` only (register); `@Size(min = 6)` (reset) | none |
| Job title present | `required`, at least 3 characters | `@NotBlank` | none |
| Salary and experience not negative | input rules | `@PositiveOrZero` | none |
| Role is a known value | radio buttons | enum binding + `isSelfAssignable()` | `CHECK (role IN …)` |
| Status is a known value | buttons built from `nextStatuses` | `ApplicationStatus.valueOf` + `nextForEmployer()` | `CHECK (status IN …)` |
| One application per job | the button changes after applying | `findByJobPostPostIdAndApplicantId` check | unique index |
| Moderation needs a reason | the dialog requires it | `AdminService.decide` | none |
| File type and size | `accept` on the input | extension allowlist, 10 MB, also `spring.servlet.multipart.max-file-size` | none |

Frontend validation exists for **user experience**. Backend validation exists for **safety**, because
anyone can call the API directly. Database constraints are the **last guarantee**, and they also catch
race conditions the application cannot see. The table shows where the backend is weaker than the frontend
(password length, title length, `salaryMin <= salaryMax`).

### 11.2 Global exception handler

`common/exception/GlobalExceptionHandler` is annotated `@ControllerAdvice`. Spring picks the most specific
matching handler:

| Exception | Status | Body |
| --- | --- | --- |
| `ResourceNotFoundException` | 404 | `{"error": message}` |
| `NoResourceFoundException` (unknown path or static file) | 404 | `{"error":"Not found."}` |
| `MethodArgumentNotValidException` (from `@Valid`) | 400 | `{"field":"message", …}` |
| `ForbiddenOperationException` | 403 | `{"error": message}` |
| `DisabledException` (meant for a banned login; unreachable in practice, see §3 step 4) | 403 | `{"error": message}` |
| `AccessDeniedException` (from `@PreAuthorize`) | 403 | `{"error":"You do not have permission to do that."}` |
| `AuthenticationException` (bad credentials) | 401 | `{"error":"Email or password is incorrect."}` |
| `DataAccessException`, `HttpMessageConversionException` | 500 | `{"error":"The server could not complete that request."}` |
| any other `RuntimeException` | **400** | `{"error": message}` |
| any other `Exception` | 500 | `{"error":"An error occurred: …"}` |

The comments in the handler record two bugs it fixed. `AccessDeniedException` is a `RuntimeException`, so
before it had its own handler "every `@PreAuthorize` rejection was reported as 400 Bad Request". And an
unknown path used to fall into the catch-all and become a 500.

**Weaknesses that remain.**

- **The catch-all for `RuntimeException` returns 400.** It is what turns "You have already applied" and
  "cannot be moved to …" into client errors, which is right. But it also turns a `NullPointerException`
  or any other bug into "400 Bad Request" with the raw exception message, which hides server faults and
  can leak internal text. Named exceptions for each business case would let the catch-all be a 500.
- **Three body shapes** (§4.4).
- **A race on the unique index becomes a 500.** If two apply requests pass the Java check together, the
  second insert fails with `DataIntegrityViolationException`, which is a `DataAccessException` → 500. It
  should be 409.
- **Unparseable input can become a 500.** `HttpMessageConversionException` covers failures to *read* the
  request body as well as failures to write the response, so malformed JSON is reported as a server error.
  `ApplicationStatus.valueOf("XYZ")` in the controller throws `IllegalArgumentException` → 400 with the
  enum's internal message.

### 11.3 Business-rule errors

Services throw; they never build HTTP responses. Examples: `ForbiddenOperationException("Verify your email
address before posting a job")`, `IllegalStateException("An application that is rejected cannot be moved
to interview")`, `ResourceNotFoundException("Job not found with id: 12")`.

### 11.4 Partial success in bulk apply

`POST /api/applications/bulk` calls `applyToJob` once per job, and **each call is its own transaction**,
because the loop is in the controller and the `@Transactional` method is on the service. A refusal for one
job (already applied, no longer published, daily limit) is caught and reported under `skipped` with its
reason; the others still go through. The response is `{"applied":[3,8],"skipped":{"5":"You have already
applied to this job"}}`.

### 11.5 Degrading instead of failing

- **Email**: `EmailService.sendEmail` catches every exception and logs a warning. With no SMTP credentials
  the app runs and sends nothing. The mail health check is switched off so an unreachable mail server does
  not mark the app as down.
- **The LLM**: `SalaryEstimateService.narrate` returns `null` on a timeout (15 seconds), an error, or when
  the per-minute limit is reached. The endpoint still returns the percentiles. A response without a
  narrative is not cached, so a temporary failure does not stick for an hour.
- **No comparable postings**: the model is not called at all.

### 11.6 Frontend error handling

- Every query has an error state with a "Try again" button; every mutation has an `onError` that shows a
  toast with `errorMessage(err)`.
- `errorMessage` turns `ERR_NETWORK` into "Cannot reach the server. Is the backend running?".
- Each route is wrapped in its own `ErrorBoundary`, so a crash in one page does not blank the app.
- Buttons are disabled while a request is running (`isSubmitting`, `isPending`), which prevents double
  submits.
- Asynchronous results are announced to screen readers with `aria-live` regions.

### 11.7 Logging and debugging

**Implemented**: SLF4J loggers in `EmailService`, `SalaryEstimateService`, `AdminSeeder`,
`ApplicationDeadlineTask`, and the two aspects, which log "Method called", "Method executed", "Method
crashed" and the duration for every controller and service method at INFO. Output goes to the console.

**Weak**: the aspects are noisy (four lines per method call, including `JwtService.extractUsername` on
every request) and the messages are concatenated without a space (`Method calledregister`). The exception
handler logs nothing, so a 500 leaves no stack trace unless the aspect happened to catch it in a service.

**Not implemented**: request ids, structured (JSON) logs, metrics, tracing, error reporting.

---

## 12. Deployment and Execution Flow

### 12.1 Requirements

JDK 21, Node.js 20 or newer, PostgreSQL with a database named `JobPortalDB`. Maven is not needed
(`./mvnw`). Docker is needed only for the container route.

### 12.2 Option A: everything in Docker

```bash
cp .env.example .env        # then set SPRING_DATASOURCE_PASSWORD and JWT_SECRET
docker compose up --build -d
# Site and API: http://localhost:8080
```

`docker-compose.yml` starts two services. `db` is `postgres:16-alpine` with a `pg_isready` health check;
its port is not published to the host. `app` waits for `db` to be healthy
(`depends_on: condition: service_healthy`), receives every setting as an environment variable, and stores
uploads in a named volume. `${JWT_SECRET:?set it in .env}` makes compose stop with a clear message if a
required value is missing.

> I did not build the image during this analysis. CI builds it only on `main`.

### 12.3 Option B: local development

```bash
# 1. Local secrets, in config/application.properties (git-ignored, read automatically):
#      spring.datasource.password=...
#      jwt.secret=<output of: openssl rand -base64 64>
#      app.admin.email=you@example.com          (optional)
#      spring.ai.openai.api-key=<Gemini key>    (optional)

./mvnw spring-boot:run                 # API on http://localhost:8080 (Windows: mvnw.cmd)
./mvnw clean verify                    # all 40 tests; needs the database

cd src/main/frontend
npm install
npm run dev                            # http://localhost:5173
npm run lint
npm run build                          # production build into dist/
npm run shots                          # Playwright screenshots, mocked API
```

> **Port note for this machine.** On 2026-11-14 port 8080 was already taken by another web server, so the
> API could not use it. Start the backend on another port
> (`./mvnw spring-boot:run "-Dspring-boot.run.arguments=--server.port=8081"`) and point the frontend at it
> with `VITE_API_URL=http://localhost:8081/api` in `src/main/frontend/.env.local`.

> **Always use `clean`** with Maven here (`./mvnw clean verify`). The project notes say incremental builds
> have hidden errors, which is plausible with three annotation processors.

### 12.4 How the database connects

`application.properties`:

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/JobPortalDB
spring.datasource.username=postgres
spring.datasource.password=${SPRING_DATASOURCE_PASSWORD}
spring.jpa.hibernate.ddl-auto=validate
spring.flyway.baseline-on-migrate=true
spring.flyway.baseline-version=1
```

At startup Spring Boot creates a HikariCP connection pool, Flyway applies pending migrations, then
Hibernate validates the entities against the tables. `${NAME}` with no default means the application
fails to start if the variable is missing. In Docker the URL and username are overridden with
`SPRING_DATASOURCE_URL` and `SPRING_DATASOURCE_USERNAME` (Spring Boot maps environment variables to
properties by name).

### 12.5 Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `SPRING_DATASOURCE_PASSWORD` | **none (required)** | Database password |
| `JWT_SECRET` | **none (required)** | Signing key, Base64 |
| `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME` | local database, `postgres` | Database connection |
| `APP_BASE_URL` | `http://localhost:5173` | Used to build links in emails |
| `APP_CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Allowed browser origins; empty when the jar serves the SPA |
| `APP_ADMIN_EMAIL` | empty | Account promoted to admin at startup |
| `APP_UPLOAD_DIR` | `./uploads` | Where uploads are stored |
| `SPRING_MAIL_HOST`, `_PORT`, `_USERNAME`, `_PASSWORD`, `APP_MAIL_FROM` | Gmail host, empty credentials | SMTP |
| `GEMINI_API_KEY` | `not-set` | Enables the salary narrative |
| `SWAGGER_ENABLED` | `true` (compose sets `false`) | Swagger UI and `/v3/api-docs` |
| `SPRING_JPA_SHOW_SQL` | `false` | Print SQL |
| `VITE_API_URL` (frontend, build time) | `http://localhost:8080/api` | Where the SPA sends API calls |

Fixed in `application.properties`: JWT lifetime 24 hours, refresh lifetime 7 days, upload limit 10 MB, the
model name and its options, the salary cache (60 minutes, 1,000 entries), the LLM timeout (15 s) and rate
limit (10 per minute).

### 12.6 Build process

The `Dockerfile` has three stages:

```dockerfile
FROM node:22-alpine AS frontend            # 1. build the SPA
COPY src/main/frontend/package.json src/main/frontend/package-lock.json ./
RUN npm ci                                 #    cached until the lock file changes
COPY src/main/frontend/ ./
ENV VITE_API_URL=/api                      #    same origin as the API
RUN npm run build

FROM eclipse-temurin:21-jdk-alpine AS backend    # 2. build the jar
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline   # cached until pom.xml changes
COPY src/main/java src/main/java
COPY src/main/resources src/main/resources
COPY --from=frontend /frontend/dist src/main/resources/static   # the SPA goes inside the jar
RUN ./mvnw -B -q package -DskipTests && cp target/*.jar app.jar

FROM eclipse-temurin:21-jre-alpine         # 3. run it: JRE only, no Maven, no source
RUN addgroup -S app && adduser -S -G app app && mkdir -p /app/uploads && chown app:app /app/uploads
COPY --from=backend /app/app.jar app.jar
USER app
VOLUME /app/uploads
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:8080/actuator/health | grep -q '"UP"' || exit 1
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
```

**How the jar serves the SPA.** `spring.web.resources.add-mappings=false` turns off Spring Boot's default
static handler. `SpaWebConfig` registers its own for `/**`: an existing file is returned as is; a path
that looks like a file (`/assets/old-hash.js`) or belongs to the backend (`api/`, `actuator`, `v3/`,
`swagger-ui`) returns nothing, which becomes a 404; anything else is a client route and gets `index.html`.
Controllers are matched before resource handlers, so the API is never shadowed.

### 12.7 Cloud deployment

**Not implemented in the repository.** There is no hosting configuration for any provider. The README
says to put a TLS-terminating proxy in front of port 8080. The image can run anywhere that runs a
container and offers PostgreSQL. One thing to plan for: uploads are stored on the local disk, so the
container needs a persistent volume, and a second instance would not see the first one's files.

### 12.8 CI/CD

`.github/workflows/ci.yml` runs on pushes to `main` and `develop` and on pull requests to `main`:

- **frontend**: Node 22 with npm cache → `npm ci` → `npm run lint` → `npm run build`.
- **backend**: a `postgres:16-alpine` service container → JDK 21 (Temurin) with Maven cache →
  `./mvnw -B clean verify` with CI-only database credentials and a throwaway JWT secret. Flyway builds the
  schema from V1.
- **docker** (only on `main`, after both jobs pass): `docker build`. The image is not pushed anywhere.

**Implemented**: continuous integration. **Not implemented**: continuous deployment, and running the
Playwright scripts in CI.

---

## 13. Limitations and Improvements

### 13.1 Functional limitations

| Limitation | Evidence | Improvement |
| --- | --- | --- |
| **Email verification cannot be completed in the UI** | `App.jsx` has no `/verify-email` route; `authService.verifyEmail` is never called. An employer who registers through the site stays unverified and `JobService.requirePostingRights` refuses their first posting | Add the route: read the token, call the endpoint, show the result. Add "resend verification email" |
| **No screen to create or edit a company** | `PostJob` only lists `GET /api/companies/my`; nothing calls `POST /api/companies` | A company form; logo upload already exists in the API |
| **Deleting a posting can fail** | `JobService.delete` hard-deletes when there are no applications, but `saved_jobs` and `match_scores` reference `job_post` with no `ON DELETE` rule. Opening the recommendations page creates a `match_scores` row for every published job, so most postings are referenced. (From reading the schema; not run) | Soft-close always, or add `ON DELETE CASCADE` for those two tables in a V5 migration |
| A rejected posting cannot be resubmitted | `update` returns only `PUBLISHED` postings to review; a `REJECTED` or `SUSPENDED` one stays as it is after an edit | Send an edited rejected posting back to `PENDING_REVIEW` |
| The session silently dies after 24 hours | §10.8 (403 instead of 401; refresh never called) | Fix the entry point; call refresh on 401 |
| Salary range is optional | `JobRequest` has no `@NotNull` on the salary fields, although "shows its pay" is a product claim | Make the range mandatory and check `min <= max` |
| Match scores never refresh | `AIService.calculateMatchScore` returns the stored row if one exists, so updating skills changes nothing | Recompute when the profile or the posting changes, or drop the cache |
| Skill matching is by substring | `js.contains(skill) \|\| skill.contains(js)`: the skill "c" matches "react" and "javascript"; the score can exceed its own 70-point share and is capped at 100 | Compare normalised whole skills |
| Only pending applications have a deadline | `lapseOverdue` scans `PENDING` only; an application moved to `REVIEWED` can wait for ever | A deadline per stage |
| Notifications cannot say anything else | Two types only; moderation results reuse `APPLICATION_STATUS_CHANGED` | Add types |
| No change of email or password while signed in; no account deletion | No such endpoints | Add them |
| No job expiry, no reports from users, no company verification | In the product backlog, not in the code | Planned features |
| The product has three names | "JobPortal" in the UI, "NextGen Jobs" in emails and Swagger, "Spring Job Portal" in the README | Pick one |

### 13.2 Performance

| Issue | Evidence | Improvement |
| --- | --- | --- |
| **N+1 queries on every job list** | `JobPost.postedBy`, `company` and `postTechStack` are `EAGER`; `User.skills` and `Company.owner` are `EAGER` too. A page of 10 jobs runs the page query plus several queries per job | Make associations `LAZY` and load what a list needs with `@EntityGraph` or a DTO query |
| **The recommendations endpoint does work proportional to all jobs** | `AIController.getRecommendedJobs` loads every published job and calls `calculateMatchScore` for each: one lookup each, and one insert each the first time | Compute in one query, or in the background, and page the result |
| The dashboard runs a query per posting | `DashboardController` calls `getEntitiesByEmployer` twice and `countByJob` once per job | One grouped query (the status breakdown already is one) |
| One extra user lookup per authenticated request | `JwtAuthFilter` | Cache the principal briefly, or put the role in the token and keep a small deny-list for bans |
| Search cannot use an index | `LOWER(...) LIKE '%keyword%'` on title and description | A `pg_trgm` GIN index or full-text search |
| Missing foreign-key indexes | §7.6 | Add them in a migration |
| Unpaged endpoints | `GET /api/jobs`, `GET /api/companies`, `GET /api/notifications`, `GET /api/applications/my` | `Pageable` |
| Files are read fully into memory | `Files.readAllBytes` for each image and resume | Stream the file; let a proxy or object storage serve images |
| Notification polling | Every open tab calls `unread-count` every 60 seconds, with no index on `notifications.user_id` | Add the index; Server-Sent Events later |
| The whole frontend is one bundle | Every page is imported eagerly in `App.jsx` | `React.lazy` per route |
| The LLM call uses the common thread pool | The timeout abandons the call but does not cancel it (noted in a code comment) | A dedicated bounded executor |

### 13.3 Scalability and reliability

- **It is built for one instance, and says so.** Three places carry a comment naming the limit and the
  upgrade: the in-process scheduler ("needs a lock, e.g. ShedLock, before a second instance runs"), the
  in-memory salary rate limiter ("needs a shared counter … the day this runs on more than one node"), and
  the title-similarity query. To these add the Caffeine cache (per instance) and the local upload
  directory (per instance).
- **Emails are sent before the transaction commits.** `emailService.send…` is called inside the
  `@Transactional` method and runs on another thread at once. If the transaction then rolls back, an
  email about something that did not happen has already gone. Sending after commit
  (`@TransactionalEventListener(phase = AFTER_COMMIT)`) fixes it.
- **The job-closed listener runs in the same transaction** as the closing. That is deliberate (nobody is
  left waiting if the close succeeds), but a failure while rejecting an application rolls back the close.
- **The database is the single point of failure.** If it is down: requests fail with 500, the health
  endpoint reports DOWN, and the app recovers by itself when the database returns.
- **When Gemini or SMTP is down**, the app keeps working (§11.5).
- **Missing**: backups, retries, graceful shutdown settings, any alerting.

### 13.4 Code quality and maintainability

**Strengths**: consistent feature packages; thin controllers in the reworked modules; constructor
injection everywhere through `@RequiredArgsConstructor` (no field `@Autowired`); DTOs and MapStruct with a
build-breaking policy for unmapped fields; one method owns each important rule (`transition`,
`nextForEmployer`, `isVisibleTo`, `requireOwner`); comments that explain *why*, often naming the bug that
led to the code; deliberate shortcuts marked with a `ponytail:` comment that names the limit and the
upgrade path; tests named as behaviours.

**Issues found**

| Issue | Where |
| --- | --- |
| One module still returns its entity from a controller | `notification` |
| Business logic in a controller | `DashboardController` builds the statistics; `JobApplicationController.applyToSelected` holds the bulk loop |
| Untyped request bodies | `Map<String, String>` for apply and status change, `Map<String, List<Integer>>` for bulk; no `@Valid`, and a missing `status` key is a `NullPointerException` |
| Generic `RuntimeException` for business errors | `applyToJob`, `RefreshTokenService`, `FileStorageService.validateFile` |
| Unused or misleading leftovers | `RefreshToken.revoked` is never set; `JobApplication` still has `@JsonIgnoreProperties` from when it was serialised; the comment on `AIService.getRecommendedJobs` says "Auto-apply"; a comment in `JobApplicationService` mentions an auto-apply path that no longer exists; `e2e/fixtures.mjs` still mocks `/ai/auto-apply`; the banned-account branch in `AuthService.login` is unreachable |
| Unused frontend functions | `refreshToken`, `verifyEmail`, `getMatchScore`, `searchJobs`, `getAllJobs`, `getUserById`, `getUnreadNotifications` |
| `@Data` on JPA entities | `JobApplication`, `Notification`, `MatchScore`, `RefreshToken`, `ApplicationStatusEvent` |
| `LocalDateTime` everywhere | Timestamps are in the server's time zone with no zone stored. Deadlines move if the server's zone changes, and the browser reads the strings as its own local time |
| The salary cache key ignores the posting | The key is (title, location, experience), but the narrative discusses *this* posting's advertised range. Two postings with the same three values share the first one's narrative |
| Large files | `employer.jsx` (944 lines), `misc.jsx` (619), `JobApplicationService` (391) |
| Inconsistent naming in the oldest entity | `postProfile` means the title, `postDesc` the description, `postId` the id |
| JavaScript without types | A wrong field name is found only at runtime |
| Documentation drift | `docs/ARCHITECTURE.md` §3–§9 describe an earlier state; `docs/MIGRATION-PLAN.md` is abandoned |
| Open-in-view is on | Lazy loading can happen during JSON writing, which hides N+1 queries and is what lets the notification endpoints return an entity |

### 13.5 Testing

**Implemented**: 40 backend tests, concentrated where the rules are (application lifecycle, moderation,
salary estimate, file safety), run in CI against a real PostgreSQL.

**Missing**: tests for `AuthService`, `JobService` (visibility, gates, re-review), `UserService`,
`CompanyService` and `AIService`; **any test that sends a real HTTP request through security to a business
endpoint** (the leak in §10.8 would have been caught by one MockMvc test that calls
`/api/ai/recommended-jobs` and asserts the JSON has no `password` field, and the 403 by one that calls a
protected endpoint without a token and asserts 401); repository tests for the native queries (the service tests mock
the repositories, so the SQL itself is never executed by a test); frontend unit tests; end-to-end tests in
CI; a coverage report.

### 13.6 API documentation

**Implemented**: Swagger UI at `/swagger-ui.html` generated by springdoc, with a Bearer scheme so
protected endpoints can be tried. **Weak**: endpoints that take a `Map` body show no schema, and the
notification endpoints document an entity.

### 13.7 Logging and monitoring

**Implemented**: `/actuator/health`, console logs, the Docker health check. **Missing**: metrics, request
logs with correlation ids, alerts, error tracking.

### 13.8 Accessibility and usability

**Implemented**: a "Skip to content" link; landmarks (`<header>`, `<nav aria-label="Main">`, `<main>`,
`<footer>`); `aria-label` on icon buttons and on the notification bell including the unread count;
`aria-hidden` on decorative icons; `aria-live` regions for results, toasts and form failures; visible
focus styles; labels on every control through the shared `Field` component; a Radix dialog for focus
trapping; durations that collapse to zero under `prefers-reduced-motion`; a phone tab bar instead of a
hidden menu; touch targets of at least 40 px; skeletons, empty states that say what to do next, and
confirmation before destructive actions. Every page was captured at desktop, tablet and phone widths
(`design-audit/after/`).

**Not verified / missing**: no automated accessibility test (axe, Lighthouse); colour contrast not
measured; no dark mode; no internationalisation.

### 13.9 Version control

**Current state**: a GitHub repository with 7 commits. Local branches: `main`,
`refactor/layered-architecture`, `security/trust-phase-0-1` (current, also pushed). Commit messages use
prefixes (`feat:`, `fix:`, `refactor:`, `docs:`) and are descriptive, but the commits are very large: the
latest one alone carries moderation, the application lifecycle, the frontend redesign and the deployment
setup. `.gitignore` correctly excludes `config/`, `.env`, `uploads/`, `target/` and `node_modules/`. The
working tree is clean.

**Improvements**: smaller commits, one concern each; open a pull request from the current branch so CI
runs before it reaches `main`; tag releases.

### 13.10 Suggested priority order

1. **Commit the data-leak fix** (done in the working tree: `MatchScoreResponse`, `AIControllerTest`) and
   push it, because the pushed commit still leaks. If the app was ever reachable by others, treat stored
   reset tokens as exposed.
2. **Fix session expiry**: 401 entry point; call the refresh endpoint from the Axios interceptor.
3. **Finish the employer path**: the `/verify-email` page and a company form. Without them a new employer
   cannot publish a job through the site.
4. Hash the reset and verification tokens; end sessions on password reset; add a logout endpoint; rate
   limit the auth endpoints; enforce password length on the backend.
5. One error shape, named business exceptions, 409 for conflicts, a 500 catch-all.
6. Lazy associations with entity graphs; index the foreign keys; page the list endpoints.
7. HTTP-level tests for security rules and repository tests for the native queries.
8. Make the salary range mandatory; fix skill matching; let rejected postings be resubmitted.
