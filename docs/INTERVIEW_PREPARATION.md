# Interview Preparation: Spring Job Portal

How to use this file:

- Facts, diagrams and code references live in [`PROJECT_ANALYSIS.md`](PROJECT_ANALYSIS.md). This file does
  not repeat them; it turns them into answers you can say out loud. "PA §7" means section 7 of that file.
- Answers are written in the first person, in plain English. Read them aloud, then say them in your own
  words. Do not memorise them word for word.
- **F/U** marks a follow-up question the interviewer is likely to ask next.
- Be honest about the gaps. Section 6 and the "what would you change" answers are where you show judgment.

> **Before you demo this project**, read PA §10.8 and §13.10. Two problems are open in the current code:
> an expired token gets 403 instead of 401 so the session-expiry handling never runs, and a new employer
> cannot verify their email through the site. A third, the recommendations endpoint exposing password
> hashes and reset tokens, is fixed in the working tree but **not committed or pushed yet**. Either fix
> the open ones first or be ready to explain them. Finding and explaining them yourself is a
> good answer; being shown them by the interviewer is not.

---

## 1. Project Explanation

### 30 seconds

> I built a full-stack job portal with three roles: job seekers, employers and admins. What makes it
> different from a normal job board is that every posting is reviewed by an admin before it goes public,
> and every application gives the employer a 14-day deadline to answer, with their response rate shown
> publicly. The backend is a Spring Boot REST API in Java 21 with JWT authentication, PostgreSQL and
> Flyway. The frontend is React with TanStack Query. It is packaged as one Docker image and has CI on
> GitHub Actions.

### 1 minute

> It is a job board built around one sentence: every listing is real, shows its pay, and answers you.
>
> "Real" means moderation. A new posting starts in a pending state, an admin publishes, rejects or
> suspends it with a reason, and if the employer edits a published posting it goes back to review.
>
> "Answers you" means an application lifecycle. An application moves through fixed stages: pending,
> reviewed, interview, offered, accepted, or rejected. The employer can only move one stage at a time.
> Every change is written to a timeline the applicant can read. If the employer does nothing for 14 days,
> a scheduled job marks the application as "no response", and that counts against a response rate that
> anyone can see on the employer's postings.
>
> "Shows its pay" means a salary estimate: I compute percentiles in SQL from comparable postings and use
> an LLM only to explain those numbers.
>
> Technically it is a React single-page app talking to a Spring Boot REST API over JSON, with role-based
> security, PostgreSQL, and Flyway migrations.

### 2 minutes

Say the 1-minute version, then add:

> The backend is a modular monolith, organised by feature: user, company, job, application, admin,
> notification, matching, dashboard and file. Inside each feature I follow the usual layers. The
> controller handles HTTP and the role check, the service holds the business rules, the ownership check
> and the transaction, and the repository runs the queries through Spring Data JPA. Entities are converted
> to DTOs with MapStruct.
>
> A few decisions I am happy with. The allowed status moves live in one method on the enum, and one
> service method performs every status change and writes the timeline row in the same transaction, so the
> history cannot disagree with the status. Double applications are prevented by a unique index, not just
> a check in Java. The job module tells the application module that a posting closed through an event, so
> the two modules do not depend on each other in a circle. And authorization has three layers: URL rules,
> role annotations, and ownership checks in the service.
>
> For deployment, the React build is copied into the Spring Boot jar, so there is one container, one port
> and no CORS in production. GitHub Actions lints and builds the frontend and runs the backend tests
> against a real PostgreSQL.
>
> What I would do next: proper session expiry, because an expired token currently gets a 403 and the
> refresh token is never used. Then the missing email-verification page, and fixing the N+1 queries
> caused by eager associations.

### Complete technical explanation (5 minutes, for "walk me through the whole thing")

Use this order. Each step is one or two sentences.

1. **Purpose**: a job board that reviews postings, publishes pay, and holds employers to an answer.
2. **Shape**: React SPA → REST/JSON → Spring Boot → PostgreSQL. A monolith, split by feature. One jar
   serves both.
3. **Frontend**: Vite + React 19. React Router with a `ProtectedRoute` per role. `AuthContext` keeps the
   user. One Axios instance adds the token. TanStack Query fetches and caches; mutations invalidate query
   keys. Forms use react-hook-form. Search filters live in the URL.
4. **Request path**: Axios → Tomcat → Spring Security filters → `JwtAuthFilter` → URL rule →
   `@PreAuthorize` → controller → service (rules, ownership, transaction) → repository → Hibernate → JDBC
   → PostgreSQL, then back as a DTO serialised to JSON.
5. **Authentication**: BCrypt for passwords; a JWT signed with HS256 with the email as subject, 24 hours;
   a refresh token in the database; the filter reloads the user on each request, so a ban is immediate;
   CSRF off because there are no cookies.
6. **Data model**: ten entity tables. Users own companies and postings; a posting has applications; an
   application has events. Users and jobs are linked three ways: applications, saved jobs, match scores.
7. **Interesting logic**: the application state machine and timeline, the deadline task, the response-rate
   query with `FILTER` and `PERCENTILE_CONT`, moderation with re-review on edit, the grounded salary
   estimate with caching, a rate limit and a fallback.
8. **Quality**: Flyway with `ddl-auto=validate`, Bean Validation, one global exception handler, MapStruct
   that fails the build on an unmapped field, 40 backend tests, CI.
9. **Deployment**: a three-stage Dockerfile, docker compose with a health check, non-root user.
10. **Limits and next steps**: 403 instead of 401 and an unused refresh token, no email
    verification page, eager fetching, single-instance assumptions.

---

## 2. Complete Technical Working

Short spoken answers. The detailed version of each is in the analysis file.

**How does the application work internally?** (PA §6)
> The browser loads a React app. React shows pages and sends HTTP requests to a Spring Boot API. The API
> works out who the user is from a token, checks their role and whether they own the thing they are
> touching, runs the business rules, reads or writes PostgreSQL through Hibernate, and returns JSON.
> TanStack Query caches the result and React re-renders the page.

**How does data travel?** (PA §4.1)
> Take applying to a job. The form calls a mutation, and Axios posts the cover letter as JSON with the
> token in the Authorization header. On the server a filter verifies the token and loads my user. Spring
> Security checks that I have the job-seeker role. The controller calls `JobApplicationService.applyToJob`,
> which checks that I have not applied already, that the job is published and active, and that I am under
> 20 applications today. It saves the application with a deadline 14 days out, writes the first timeline
> row and a notification for the employer, all in one transaction, and sends an email on another thread.
> MapStruct turns the entity into a response DTO, Spring writes it as JSON, and the page invalidates the
> "my applications" query.

**How do requests and responses work?** (PA §4.2–4.4)
> A request has a method, a URL, headers and sometimes a body. I use GET to read, POST to create or run an
> action, PUT to update, PATCH to change one thing like a status, and DELETE to remove. Filters go in
> query parameters, ids go in the path, data goes in a JSON body, and files go as multipart. The response
> has a status code and a JSON body. Honestly, my success responses are all 200; I should return 201 for
> creates.

**How does the frontend communicate with the backend?** (PA §5)
> Through one Axios instance in `services/api.js`. A request interceptor adds the Bearer token. Each
> endpoint has one small function in a service file, and pages pass those functions to `useQuery` or
> `useMutation`. In production the base URL is `/api` on the same origin; in development it is the
> backend's port, which is why CORS is configured.

**How is the database connected?** (PA §12.4)
> Spring Boot reads the JDBC URL, username and password and creates a HikariCP connection pool. The
> password has no default, so the app will not start without it. At startup Flyway runs any new migration
> files, then Hibernate validates that my entities match the tables.

**How does authentication work?** (PA §10)
> On login Spring Security's authentication manager finds the user by email and checks the password with
> BCrypt. I return a JWT signed with a secret key, containing the email and an expiry, plus a refresh
> token. The browser sends the JWT on every request. A filter verifies the signature and expiry, loads the
> user from the database, checks they are not banned, and puts them in the security context.

**How do the components interact?**
> On the backend, Spring creates every controller, service and repository as a bean and injects them
> through constructors, which Lombok generates. Modules call each other's services in one direction; where
> that would create a circle I use an application event. On the frontend, providers sit at the top (query
> client, auth, router, toasts), pages use them through hooks, and shared UI lives in a small component
> kit.

**What is the complete flow?** (PA §3)
> A visitor browses published jobs. A seeker registers, searches, applies, and follows the application's
> clock and timeline. An employer registers, posts a job, waits for an admin to publish it, then moves
> applicants through stages. An admin reviews the queue. Every hour a task marks unanswered applications
> and warns employers whose deadline is close.

---

## 3. Topic-Wise Interview Questions

### 3.1 Beginner

**What is this project?** Use the 30-second pitch.

**Why did you build it?**
> *(Give your own reason; see §6.3.)* The technical reason: I wanted one project with real role-based
> security, a non-trivial data model, a workflow with rules, background work, and a deployment path.

**What technologies did you use?**
> Java 21 and Spring Boot for the API, Spring Security with JWT, Spring Data JPA with Hibernate,
> PostgreSQL and Flyway. MapStruct and Lombok for mapping and boilerplate. Spring AI for the salary
> explanation. On the frontend React, Vite, React Router, TanStack Query, react-hook-form and Axios.
> Docker and GitHub Actions for packaging and CI.

**What are the roles?**
> Job seeker, employer and admin. A seeker applies and tracks. An employer posts and hires. An admin
> reviews postings and can ban accounts. Nobody can register as admin; one account is promoted at startup
> from a configuration property.

**What is the purpose of each layer?**
> The controller translates HTTP into a method call and checks the role. The service contains the rules,
> the ownership check and the transaction. The repository contains the queries. The entity represents a
> table row. DTOs are the shapes that go over the network.

### 3.2 Intermediate

**Explain the complete request-response lifecycle.** Use §2 "How does data travel", and name the classes.
F/U: *Where is the transaction opened and committed?* At the `@Transactional` service method: opened on
entry, committed on normal return, rolled back on a runtime exception.

**How do you make sure an employer can only see their own applicants?**
> The role annotation only proves they are *an* employer. The service loads the job and compares its
> owner's id with the caller's id, in `requireJobOwner`, and throws a 403 otherwise. It is in the service
> so that every caller gets the check, and I have unit tests for it.

F/U: *Why not put that in `@PreAuthorize`?* I could, with an expression that calls a bean. I kept it in
the service because the service already loads the entity, and the rule then travels with the method.

**How does the application status workflow work?**
> `ApplicationStatus` is an enum with a method `nextForEmployer()` that returns the allowed next stages:
> from pending you can go to reviewed or rejected, from reviewed to interview or rejected, and so on. The
> service rejects any move that is not in that list. One private method, `transition`, changes the status
> and writes a row to `application_events` in the same transaction. The response DTO includes
> `nextStatuses`, so the frontend draws only the buttons the server will accept.

**How does the 14-day deadline work?**
> When someone applies I store `respondBy` as now plus 14 days. A `@Scheduled` task runs every hour. First
> it finds pending applications past the deadline, marks them "no response" and notifies the applicant.
> Then it finds pending applications within four days of the deadline that have not had a reminder, groups
> them by employer, and sends each employer one notification and one email.

F/U: *Why hourly and not nightly?* So a server that was down at midnight still catches up within the hour.
F/U: *What if you run two instances?* Both would run the task. I noted that in a comment; it needs a lock
such as ShedLock.

**How is the public response rate calculated?**
> One native query over the last 90 days. An application counts once its outcome is known: it was answered,
> or its deadline passed. `COUNT(*) FILTER` counts the ones answered before the deadline, and
> `PERCENTILE_CONT(0.5)` gives the median days to a first answer. If fewer than five outcomes are known I
> return no rate at all, because one application would otherwise mean 0% or 100%.

**How does moderation work?**
> A posting has a status: pending review, published, rejected or suspended. It is public only when it is
> published *and* the employer has it switched on. Admin decisions need a reason unless they publish, and
> each one writes an audit row in the same transaction. If the employer changes the content of a published
> posting, it goes back to pending.

F/U: *Why re-review on edit?* Otherwise you post something clean, wait for approval, then edit it into
whatever you wanted.

**How do you handle exceptions?**
> Services throw. One class, `GlobalExceptionHandler`, annotated with `@ControllerAdvice`, converts each
> exception type into a status code and a JSON body. A weakness: my catch-all turns any other
> `RuntimeException` into a 400, and validation errors have a different body shape from the others.

**How does React get its data?**
> With TanStack Query. `useQuery` takes a key and a function, and gives me the data, a pending flag and an
> error flag. After a write, I invalidate the keys that changed and the queries refetch. I do not keep
> server data in my own state.

### 3.3 Advanced

**Why this architecture?**
> A monolith because there is one developer, one database, and the features share tables. I split it by
> feature so each module owns its entity, repository, service and controller, and dependencies point one
> way. I did write a plan for microservices and dropped it; it would have added network calls and
> distributed transactions for no gain at this size.

**What happens when two requests arrive at the same moment?**
> Each request has its own thread, its own security context and its own transaction, and my beans hold no
> per-request state. For conflicts I rely on the database. Two "apply" clicks both pass the Java check,
> then the unique index on job and applicant rejects the second insert. The view counter is a single
> `UPDATE … SET view_count = view_count + 1`, so two views cannot overwrite each other.

F/U: *And what does the second apply request return?* Today a 500, because the constraint violation is a
`DataAccessException` and my handler maps that to 500. It should be a 409.

F/U: *Two admins decide the same posting at once?* Last write wins. A `@Version` column for optimistic
locking would turn the second into a conflict.

**How did you avoid a circular dependency between modules?**
> The application module depends on the job module. When a job closes, applications must be resolved, but
> the job module must not call the application service. So `JobService` publishes a `JobClosedEvent` and
> the application service listens with `@EventListener`. It runs synchronously in the same transaction,
> so either the job closes and its applications are rejected, or neither happens.

**How does the salary estimate keep the LLM honest?**
> The model never produces a number. A native query computes the 25th, 50th and 75th percentile of the
> salary midpoints of comparable postings: similar title, same location or remote, experience within two
> years. I send those numbers and the posting text to the model with a system prompt that says every
> figure it writes must be one of the supplied percentiles. If there are no comparables I do not call the
> model at all.

F/U: *What if the model is slow or down?* The call runs in a `CompletableFuture` with a 15-second timeout.
On timeout, error or when my per-minute limit is hit, the narrative is null and the endpoint still returns
the percentiles. I do not cache a response without a narrative, so a temporary failure does not stick.
F/U: *Can the model still ignore the instruction?* Yes. A prompt is not a guarantee. A stronger design
would check the output for digits that are not in the supplied set.

**How would you improve performance?**
> First measure. From reading the code, the biggest issue is eager associations: loading a job also loads
> its poster, company, the company's owner, and two element collections, so a page of jobs is an N+1
> pattern. I would make them lazy and use entity graphs or DTO queries. Second, the recommendations
> endpoint scores every published job for the user. Third, add indexes on foreign keys I query by, like
> `notifications.user_id`. On the frontend, split the bundle by route.

**How would you scale it?**
> It is built for one instance and I marked the places: the scheduler, the in-memory rate limiter, the
> in-memory cache, and uploads on local disk. To run several instances I would add a scheduler lock, move
> the limiter and cache to Redis, and put uploads in object storage. The API itself keeps no session.

**What happens if the database becomes unavailable?**
> Requests fail with a 500 and the health endpoint reports down, so the container is marked unhealthy. The
> connection pool reconnects when the database returns. Login also fails, and so does every authenticated
> request, because my filter loads the user from the database each time.

**What would you change if you rebuilt it?**
> DTOs in every module from day one. TypeScript on the frontend. Lazy associations by default. Named
> exceptions with one error format. Refresh tokens actually used, with rotation. HTTP-level security tests
> early, because my unit tests mock the repositories and never see the real JSON. That is how an entity
> leak in the matching module went unnoticed.

### 3.4 Scenario questions

**An employer says "I registered but I cannot post a job".**
> The message will be "Verify your email address before posting a job". Posting requires a verified email.
> And here I have a real gap: the verification email links to a page the frontend does not have yet, so
> today verification only works by calling the API directly. I would add that page first.

**A seeker says "I updated my skills but my match score did not change".**
> Match scores are stored the first time they are computed and returned from the table afterwards. Nothing
> invalidates them. I would recompute when the profile changes, or stop storing them.

**An employer deletes a posting that has applicants. What happens?**
> It is not deleted. The service switches it off and publishes the job-closed event, which rejects every
> open application with the note "Position closed" and notifies each applicant. The history stays.

**An admin bans a user who is logged in.**
> The ban deletes their refresh tokens. Their access token is still correctly signed, but my filter loads
> the user on every request and refuses a banned one, so the very next request fails.

**A user reports being logged out, or seeing "Forbidden" everywhere, the day after logging in.**
> The access token lasts 24 hours. I have a refresh endpoint but the frontend does not call it. Worse, the
> backend answers an expired token with 403, and my frontend only treats 401 as "session ended", so the
> user sees errors instead of the login page. The fix is a 401 entry point in the security config and a
> refresh call in the Axios interceptor.

**The product owner wants reminders at every stage, not only "pending".**
> Today only pending applications lapse. I would store a deadline per stage and extend the task. The state
> machine and the timeline would not need to change.

### 3.5 Debugging questions

**The browser console shows a CORS error.**
> The API is being called from an origin that is not in `APP_CORS_ALLOWED_ORIGINS`, or the preflight
> failed. I check the request's `Origin` against the configured list: scheme, host and port must match
> exactly. In the Docker deployment there should be no CORS at all, because the page and the API share an
> origin.

**The app fails at startup with "Schema-validation: missing column".**
> An entity has a field with no matching column. Hibernate is in `validate` mode, so I need a new Flyway
> migration. I must not edit an old one, because Flyway checks the checksums of applied migrations.

**A search with an empty keyword fails with `function lower(bytea) does not exist`.**
> I hit this. When a null is passed for a parameter, PostgreSQL cannot tell its type and assumes `bytea`,
> and then `lower()` fails. I fixed it by casting the parameter explicitly in the query:
> `CAST(:keyword AS string)`.

**A response fails with "Type definition error: ByteBuddyInterceptor".**
> Jackson tried to serialise a Hibernate lazy proxy. I had it on notifications, where the `user` field is
> lazy. The quick fix was `@JsonIgnore` on that field. The right fix is not to return entities: map to a
> DTO inside the transaction.

**A `@PreAuthorize` failure returns 400 instead of 403.**
> I had this too. `AccessDeniedException` is a `RuntimeException`, and my catch-all handler for
> `RuntimeException` returned 400. I added a specific handler for it. The general lesson: a catch-all for
> a broad exception type swallows things you did not think about.

**A page reload on `/job/3` returns 404 in production.**
> That is the SPA fallback. The server has no file at `/job/3`; it must return `index.html` and let React
> Router handle the path. `SpaWebConfig` does that, while still returning a real 404 for a missing asset
> file and for unknown API paths.

**The salary narrative comes back cut off in the middle of a sentence.**
> The model spends output tokens on reasoning before it answers, from the same budget. I lowered the
> reasoning effort and raised the token limit; the comment in `application.properties` records the cause.

---

## 4. Technology-Specific Questions

### 4.1 Java

| Question | Answer tied to this project |
| --- | --- |
| What is a `record`? | An immutable data class; the compiler generates the constructor, accessors, `equals`, `hashCode`, `toString`. I use records for `JobClosedEvent`, `EmployerResponsiveness`, `TimelineEntry`, `SalaryEstimateResponse` |
| What is an enum with behaviour? | `ApplicationStatus` has the methods `nextForEmployer()` and `isOpen()`. The workflow rule lives on the type itself |
| What is a `switch` expression? | A `switch` that returns a value and must cover every case: `case PENDING, NO_RESPONSE -> List.of(REVIEWED, REJECTED);`. If I add a status and forget it, the code does not compile |
| What is `Optional`? | A container that may be empty. `jobRepo.findById(id).filter(...).orElseThrow(...)` |
| Streams? | A pipeline over a collection. `Collectors.groupingBy(a -> a.getJobPost().getPostedBy().getId())` groups waiting applications by employer |
| Why `BigDecimal` for salary? | Exact decimal arithmetic. `double` cannot represent 0.1 exactly |
| `LocalDateTime` vs `Instant`? | `LocalDateTime` has no time zone; `Instant` is an exact moment in UTC. I used `LocalDateTime` everywhere, which is a weakness: deadlines depend on the server's zone |
| Checked vs unchecked exceptions? | Mine extend `RuntimeException`, so they pass through layers without `throws` and roll back transactions |
| What is `CompletableFuture`? | A result that arrives later. `supplyAsync(...).get(timeout, MILLISECONDS)` gives the LLM call a time limit |
| `synchronized`? | Only one thread at a time may run the method. `withinRateLimit()` uses it because many request threads share one counter |
| Why `Boolean.TRUE.equals(x)`? | The fields are `Boolean` objects and may be null. `if (x)` would throw a `NullPointerException` on null |
| What does Lombok do? | Generates code at compile time: `@Getter`, `@Setter`, `@Builder`, `@RequiredArgsConstructor` (a constructor for all `final` fields) |
| Text blocks? | `"""` multi-line strings, used for SQL and for the prompts |

### 4.2 Spring Boot and dependency injection

**What is dependency injection, and where do you use it?**
> A class does not create the objects it needs; it receives them. `JobService` declares `JobRepo`,
> `JobMapper`, `UserService`, `CompanyService` and `ApplicationEventPublisher` as `private final` fields,
> Lombok's `@RequiredArgsConstructor` generates the constructor, and Spring supplies the beans.

**Why constructor injection over `@Autowired` fields?**
> The fields can be `final`, the dependencies are visible, and I can build the class in a unit test with
> plain `new` and mocks, which is exactly what my service tests do.

**What does `@SpringBootApplication` do?**
> It combines `@Configuration`, `@EnableAutoConfiguration` and `@ComponentScan`. Mine also has
> `@EnableCaching`, `@EnableAsync` and `@EnableScheduling`.

**What is `@Async`? Any pitfall?**
> The method runs on another thread from a pool, and the caller does not wait. I use it for emails. Two
> pitfalls: it only works when called through the Spring proxy, so not from inside the same class; and my
> emails are triggered inside a transaction, so an email can go out for a change that then rolls back.

**What is `@Scheduled`?**
> Spring calls the method on a timer. Mine uses `fixedDelayString = "PT1H"` with a one-minute initial
> delay. Fixed delay means the next run starts an hour after the previous one *finished*, so runs never
> overlap.

**What is `@Cacheable`?**
> Spring stores the method's result under a key and returns it next time without running the method. Mine
> is keyed by title, location and experience, lives in Caffeine for 60 minutes, and has
> `unless = "#result.narrative() == null"` so a degraded answer is not cached.

**What is an application event?**
> `ApplicationEventPublisher.publishEvent(obj)` hands an object to every `@EventListener` method that
> accepts its type. By default it is synchronous and in the same thread and transaction.

**What is AOP, and where do you use it?**
> Aspect-oriented programming puts behaviour that cuts across many classes in one place. A pointcut
> expression selects methods; advice runs before, after or around them. My two aspects log and time every
> controller and service method. Spring implements it with proxies.

**What is `ApplicationRunner`?**
> A bean whose `run` method is called once after startup. `AdminSeeder` uses it to promote the configured
> account.

**How is configuration loaded?**
> `application.properties` with `${ENV_VAR:default}` placeholders, plus a git-ignored
> `config/application.properties` that Spring Boot reads automatically for local secrets. `@Value` injects
> single values.

**What is Actuator?** Production endpoints. I expose only `health` and `info`.

### 4.3 Spring MVC and REST

| Question | Answer |
| --- | --- |
| `@RequestBody` vs `@RequestParam` vs `@PathVariable`? | JSON body → object; `?name=value`; a segment of the URL. `JobController` uses all three |
| What does `@Valid` do? | Runs Bean Validation on the argument. Failure throws `MethodArgumentNotValidException` before my method runs |
| What is `@AuthenticationPrincipal`? | Injects the principal from the security context, here a `UserPrincipal`. On a public endpoint it is null for an anonymous visitor, which `GET /api/jobs/{id}` relies on |
| What is `ResponseEntity`? | A response with a status, headers and body. I use `ResponseEntity.ok(...)`; the file endpoints set `Content-Type` and `Content-Disposition` on it |
| How does pagination work? | `PageRequest.of(page, size, sort)` goes to the repository, which returns a `Page` with the content and the totals |
| PUT vs PATCH? | PUT replaces the whole resource; PATCH changes part. Honest answer: my PUT endpoints only change the fields that are sent, so they behave like PATCH |
| Idempotent? | Repeating the call gives the same result. GET, PUT and DELETE should be. My `GET /jobs/{id}` is not strictly safe because it increments a view counter |
| 401 vs 403? | 401: not authenticated. 403: authenticated but not allowed. My API wrongly returns 403 when the token is missing or expired |
| 403 vs 404 for a resource you may not see? | I return 404 for an unpublished job, a private profile and someone else's notification, so their existence is not revealed. For "not your job posting" I return 403 |
| File upload? | `multipart/form-data`; `@RequestParam("file") MultipartFile file`; a 10 MB limit |
| File download through an authenticated endpoint? | A plain link cannot send the token, so the frontend requests the resume with Axios as a Blob and opens an object URL |
| What is `DispatcherServlet`? | Spring MVC's front controller: it receives every request and routes it to a method |

### 4.4 Hibernate and JPA

**JPA vs Hibernate vs Spring Data JPA?**
> JPA is the specification. Hibernate is the implementation. Spring Data JPA generates repositories.

**How does a derived query work?**
> Spring parses the method name. `findByStatusAndIsActiveTrue` becomes `where status = ? and is_active =
> true`. They get long: `findByStatusAndRespondByBeforeAndReminderSentAtIsNull`.

**JPQL vs native SQL? When did you use each?**
> JPQL is written against entities and is database independent; I use it for the search. I use native SQL
> for the response rate and the salary percentiles, because they need `PERCENTILE_CONT` and `FILTER`.

**What is a projection?**
> Returning something smaller than an entity. My native queries return interfaces, `ResponsivenessStats`
> and `SalaryStats`; Spring matches column aliases to getter names.

**`EAGER` vs `LAZY`?**
> Eager loads the association together with the owner; lazy loads it when first accessed. `@ManyToOne`
> is eager by default. Most of mine are eager, including two `@ElementCollection`s, and that is a known
> weakness.

**What is the N+1 problem? Do you have it?**
> One query for a list, then one more per row for a related object. Yes: a page of jobs loads each job's
> tech stack, poster, poster's skills, company and owner. The fix is lazy associations plus
> `@EntityGraph`, a `JOIN FETCH`, or a DTO query.

**What is `@ElementCollection`?**
> A collection of simple values stored in its own table without an entity, like a user's skills.

**What does `@Transactional` do?**
> Spring wraps the bean in a proxy that begins a transaction before the method and commits after it, or
> rolls back on a runtime exception. `readOnly = true` lets Hibernate skip dirty checking.

F/U: *Any pitfall?* Calling a `@Transactional` method from another method in the same class bypasses the
proxy. That is why my bulk-apply loop is in the controller: each call goes through the proxy and gets its
own transaction, so one refusal does not undo the others.

**What is dirty checking?**
> Hibernate keeps a snapshot of each loaded entity and at commit writes an UPDATE for any that changed.

**What is `getReferenceById`?**
> It returns a proxy with just the id, without a SELECT. I use it to set the actor on a timeline row when
> I only need the foreign key.

**What is `@Modifying`?** Marks a `@Query` as an UPDATE or DELETE. Used for the atomic view counter.

**What does `ddl-auto=validate` mean? Other values?**
> Hibernate checks entities against the schema and fails on a mismatch. `update` alters tables
> automatically, `create` and `create-drop` rebuild them, `none` does nothing. I started with `update` and
> moved to Flyway plus `validate` because `update` never drops anything.

**What is open-in-view?**
> It keeps the database session open until the response is written, so lazy fields can still load in the
> controller or during JSON serialisation. It is on by default and I have not turned it off. It is
> convenient and it hides N+1 queries.

**Why should JPA entities not use Lombok `@Data`?**
> It generates `equals` and `hashCode` from every field, including associations, which can trigger
> loading and breaks identity in sets. A few of my entities still use it.

### 4.5 SQL and database design

| Question | Answer |
| --- | --- |
| Primary key vs foreign key? | A primary key identifies a row (`job_post.post_id`). A foreign key points at another table's key (`job_applications.job_post_id`) and the database guarantees the target exists |
| What relationships do you have? | One-to-many (user → postings, posting → applications, application → events) and many-to-many between users and jobs, modelled three times as entities with extra columns: applications, saved jobs, match scores |
| Why a join entity instead of `@ManyToMany`? | The link has its own data: a status, a deadline, a timestamp |
| What is a CHECK constraint? | A rule the database enforces on a column, e.g. `status IN ('PENDING', …)`. When I added statuses I had to widen it in a migration |
| What is a unique index for? | Uniqueness the database guarantees. `(job_post_id, applicant_id)` makes a second application impossible even in a race |
| What is a composite index? | An index on several columns. `(status, respond_by)` serves the deadline scan: equality on status, range on the date |
| Does PostgreSQL index foreign keys? | No, only primary keys and unique constraints. I am missing a few, e.g. `notifications.user_id` |
| What does `FILTER (WHERE …)` do? | Conditional aggregation: total and on-time counts in one pass |
| What is `PERCENTILE_CONT`? | An ordered-set aggregate that returns the value at a percentile, interpolating. 0.5 is the median |
| `ON DELETE CASCADE`? | Deleting the parent deletes the children. Only `application_events` has it; the rest refuse the delete |
| What is a transaction? ACID? | A group of statements that succeed or fail together. Atomic, Consistent, Isolated, Durable |
| How do you prevent SQL injection? | Only bound parameters. The one value that becomes part of the query structure, the sort field, is checked against a whitelist |
| How do you change the schema? | A new Flyway file, `V5__….sql`. Never edit an applied one |
| How did you add a NOT NULL column to a table with data? | In V2: add it nullable, backfill with an UPDATE, then set NOT NULL |
| How did you add a unique index to a table that had duplicates? | In V4: delete the duplicates keeping the lowest id, then create the index |
| What is `baseline-on-migrate`? | For a database that existed before Flyway: mark it as already at V1 instead of running V1 on it |

### 4.6 React

**What is a component? Props vs state?**
> A function that returns UI. Props are inputs from the parent and are read-only. State is data the
> component owns; changing it causes a re-render. `JobRow` receives `job`, `saved` and `onToggleSave` as
> props.

**`useState`?**
> Declares state. I use the function form for the initial value when it is expensive or should run once:
> `useState(() => authService.getCurrentUser())` reads `localStorage` only on the first render.

**`useEffect`?**
> Runs side effects after render. In `AppShell` an effect adds a listener for my `jp:session-expired`
> event and the returned function removes it. I do not fetch in effects; TanStack Query does the fetching.

**What is TanStack Query and why use it?**
> It manages server state: fetching, caching by key, pending and error flags, retries and refetching. A
> mutation's `onSuccess` invalidates keys, for example `['my-applications']`, and every component using
> that key refetches. It replaced a lot of `useEffect` and `useState` code.

F/U: *What is a query key?* The cache identity. `['jobs', filters, sort, page]` means a different filter
or page is a different cache entry.
F/U: *What is `staleTime`?* How long data counts as fresh. Mine is 30 seconds.
F/U: *How do you poll?* `refetchInterval: 60_000` on the unread-count query.
F/U: *How do you make a query wait?* `enabled: isJobSeeker`, so saved jobs are fetched only for seekers.

**What is react-hook-form?**
> A form library. `register('email', { required: '…' })` connects an input, `handleSubmit` validates and
> calls my function, and `formState.errors` holds the messages. Inputs are mostly uncontrolled, so typing
> does not re-render the whole form.

**What is Context? Why not Redux?**
> Context passes a value to any component below a provider. I use it for the signed-in user and for
> toasts. Server data is in the query cache, so there is nothing left that needs a global store.

**How does routing and route protection work?**
> React Router maps URLs to components in `App.jsx`. `ProtectedRoute` checks the user and the required
> role and renders `<Navigate>` otherwise.

F/U: *Is that real security?* No. It only decides what to show. The API enforces the rules.

**Why keep search filters in the URL?**
> So a search can be bookmarked and shared, and the back button works. `useSearchParams` reads and writes
> them. The home page's search box simply links to `/jobs?keyword=…`.

**What is an error boundary and why is it a class?**
> A component that catches render errors below it. React only supports this through class lifecycle
> methods. I wrap every route in its own, so one broken page does not blank the app.

**Why `key` in lists?** So React can match items between renders. I use database ids.

**What does `StrictMode` do?** In development it renders twice and runs effects twice to expose bugs.

**Virtual DOM?** React builds a description of the UI, compares it with the previous one, and changes only
what differs in the real page.

### 4.7 JavaScript and asynchronous programming

| Question | Answer |
| --- | --- |
| What is a Promise? | An object for a result that arrives later: pending, fulfilled or rejected. `api.get(...)` returns one |
| `async/await`? | Syntax over promises. `await` pauses the function, not the browser. Errors are caught with `try/catch` |
| The event loop? | JavaScript is single-threaded; network calls are handed to the browser, and their callbacks run when the call stack is empty |
| What is an interceptor? | A function Axios runs on every request or response. Mine adds the token and watches for a 401 |
| Optional chaining, nullish coalescing? | `error.response?.data`, `data?.count ?? 0` |
| Spread operator? | `{ ...user, ...updates }` copies and overrides; state must not be mutated |
| `localStorage`? | Key-value storage per origin that survives restarts. Strings only, readable by any script on the page |
| What is a `CustomEvent`? | An event I define. `api.js` is outside React, so it dispatches `jp:session-expired` on `window` and `AppShell` listens |
| `FormData`? | Builds a multipart body for file uploads |
| What is a Blob and an object URL? | Binary data in memory, and a temporary URL that points to it. Used to open a resume fetched with the auth header; I revoke the URL afterwards |
| `==` vs `===`? | `===` compares without type conversion |

### 4.8 HTTP, networking and security

| Question | Answer |
| --- | --- |
| HTTP is stateless. How do you keep a user signed in? | The client sends the JWT on every request |
| What is in your JWT? | Header, payload, signature. The payload has `sub` (the email), `iat`, `exp`. No role. Signed with HS256, not encrypted |
| Why is the role not in the token? | The filter loads the user anyway, so the role is always current. The cost is a query per request |
| Can a user edit their token to become an admin? | No. There is no role in it, and changing the email breaks the signature |
| Access token vs refresh token? | The access token is short-lived and sent on every request. The refresh token is long-lived, stored on the server, and used only to get a new access token. Mine is a random UUID in a table |
| Session vs JWT? | Session: the server stores state and the client holds an id in a cookie; easy to revoke. JWT: nothing stored; hard to revoke. My design is in between, because I check the database on each request |
| Hashing vs encryption? | Hashing is one-way; encryption can be reversed with a key. Passwords are hashed |
| Why BCrypt and not SHA-256? | SHA-256 is fast, which helps attackers. BCrypt is slow by design and salts automatically |
| RBAC? | Role-based access control: permissions attach to roles. `hasRole('EMPLOYER')` checks for the authority `ROLE_EMPLOYER` |
| What is IDOR? | Insecure direct object reference: changing an id in the URL to reach someone else's data. Ownership checks prevent it |
| CORS? | A browser rule: a page may call another origin only if that server allows it. Preflight is an OPTIONS request |
| CSRF? | Another site makes the browser send a request with the user's cookies. I have no cookies, so I disabled the protection |
| XSS? | Injected script running in the page. React escapes output. It matters to me because the token is in `localStorage` |
| Path traversal? | Using `../` to read files outside a folder. I normalise the path and check it still starts with the upload directory, with tests |
| Account enumeration? | Learning which emails have accounts. Forgot-password answers the same either way; registration still says "already registered" |
| What is a reverse proxy? | A server in front of the app that forwards requests and usually terminates TLS. My image expects one in front of port 8080 |

### 4.9 Docker, CI and deployment

| Question | Answer |
| --- | --- |
| Image vs container? | An image is a read-only template; a container is a running instance |
| Why three stages? | Node builds the frontend, a JDK builds the jar, and the final image has only a JRE and the jar. Smaller and safer |
| Why copy `package.json` and `pom.xml` before the source? | Docker caches layers. Dependencies are downloaded again only when those files change |
| How does the frontend end up in the jar? | The build copies `dist/` into `src/main/resources/static` before packaging |
| Why a non-root user? | If the app is compromised, the attacker has limited rights in the container |
| What does `HEALTHCHECK` do? | Docker calls `/actuator/health` every 30 seconds and marks the container unhealthy after 3 failures |
| `depends_on` with `service_healthy`? | Waits until the database passes its health check, not merely until it starts |
| What is a volume? | Storage outside the container's lifecycle. I have one for the database and one for uploads |
| `-XX:MaxRAMPercentage=75`? | The JVM sizes its heap from the container's memory limit |
| What does your CI do? | Lints and builds the frontend; runs `./mvnw clean verify` against a PostgreSQL service container; on `main` it also builds the Docker image |
| CI vs CD? | CI builds and tests each change. CD deploys it. I have CI only |
| Why does CI need a real PostgreSQL? | Two tests start the full context, which runs Flyway and schema validation. There is no H2 fallback, and my native queries are PostgreSQL-specific |
| Why are Vite variables set at build time? | Vite replaces `import.meta.env.VITE_*` with literal values in the bundle |

### 4.10 Spring AI and LLM integration

| Question | Answer |
| --- | --- |
| What does Spring AI give you? | A `ChatClient` with a fluent API over chat models, and conversion of the model's JSON into a Java type with `.entity(Narrative.class)` |
| Which model, and how is it connected? | Gemini, through Google's OpenAI-compatible endpoint, using Spring AI's OpenAI starter with a different base URL. Spring AI 1.0.0 had no starter for a plain AI Studio key |
| What is grounding? | Giving the model the facts it must use, instead of letting it answer from memory. My facts are SQL percentiles |
| How do you control cost? | A one-hour cache keyed by title, location and experience; a per-minute limit; no call when there is no data |
| Where is the API key? | Only in an environment variable. A test scans the repository to make sure no key is committed |
| What is temperature? | How random the output is. Mine is 0.2, because I want a consistent explanation |
| A weakness of your cache key? | It ignores the posting itself, but the explanation discusses that posting's advertised range. Two postings with the same title, location and experience share the first one's text |

---

## 5. Code-Level Interview Questions

### 5.1 `SecurityConfig.securityFilterChain`

- *Why `csrf.disable()`?* No cookies; the token is in a header.
- *Why `SessionCreationPolicy.STATELESS`?* So Spring never creates an HTTP session.
- *Why does the order of `requestMatchers` matter?* The first match wins. The public `GET /api/jobs/**`
  rule must come before `"/api/**" → authenticated()`.
- *`GET /api/jobs/**` is public. How is `GET /api/jobs/my` protected?* By `@PreAuthorize` on the method.
  Method security runs after the URL rule.
- *What if you remove `@EnableMethodSecurity`?* Every `@PreAuthorize` is silently ignored. `/api/jobs/my`
  would then be called with a null principal.
- *What is missing here?* An `authenticationEntryPoint`. Without it an unauthenticated request gets 403.
- *Why is `GET /**` permitted?* Those are the SPA's files and client routes.

### 5.2 `JwtAuthFilter`

- *Why extend `OncePerRequestFilter`?* One execution per request, even with internal forwards.
- *Why does it not return an error itself when the token is bad?* It only authenticates when it can; the
  authorization rules decide afterwards. That keeps public endpoints working when a stale token is sent
  (I checked: a public endpoint with a garbage token still returns 200).
- *Why check `isAccountNonLocked()` here?* Spring only checks it during password login. Without it a
  banned user keeps access until the token expires.
- *Cost?* A database query on every authenticated request.
- *What would you clean up?* `System.err.println` in the catch block should be a logger.

### 5.3 `JwtService`

- *What does `Decoders.BASE64.decode(secretKey)` imply?* The secret must be Base64, and long enough for
  HS256 (256 bits) or JJWT refuses it.
- *What happens if the secret changes?* Every existing token becomes invalid.
- *HS256 vs RS256?* HS256 uses one shared secret, fine for a single service. RS256 uses a key pair, better
  when other services must verify tokens.

### 5.4 `UserPrincipal` vs `User`

- *Why a separate principal?* Earlier the `User` entity implemented `UserDetails`. That put security
  behaviour in a persistence class and needed many `@JsonIgnore` annotations to keep the hash out of
  responses. Now the principal carries only id, email, hash, role and the banned flag.
- *Where is it created?* `UserSecurityConfig.userDetailsService`, with `UserPrincipal::from`.

### 5.5 `ApplicationStatus.nextForEmployer`

```java
return switch (this) {
    case PENDING, NO_RESPONSE -> List.of(REVIEWED, REJECTED);
    case REVIEWED -> List.of(INTERVIEW, REJECTED);
    case INTERVIEW -> List.of(OFFERED, REJECTED);
    case OFFERED -> List.of(ACCEPTED, REJECTED);
    case ACCEPTED, REJECTED, WITHDRAWN -> List.of();
};
```

- *Why can an employer act on `NO_RESPONSE`?* They may still answer late. The miss stands, because
  `respondedAt` will be after `respondBy`.
- *How is `isOpen()` defined?* "Has at least one next stage". One rule, no second list to keep in sync.
- *Why is `WITHDRAWN` not in any list?* Only the applicant can do that, through a different method.

### 5.6 `JobApplicationService.transition` and `markAnswered`

- *Why one private method for all status changes?* So the status and its timeline row are always written
  together. The employer's move, the withdrawal, the deadline task and the job-closed listener all go
  through it.
- *Why does `markAnswered` only set `respondedAt` when it is null?* The first answer is the one that
  counts. Moving to "interview" a week later must not change the response time.
- *Why is the timeline's actor a role and not a name?* So the applicant never learns which person at the
  employer acted.

### 5.7 `JobApplicationService.applyToJob`

- *Why filter the job by `PUBLISHED` and active?* Looking it up by id alone let anyone apply to a posting
  still in review or switched off.
- *Is the "already applied" check enough?* No. It is a read followed by a write. The unique index is the
  real guard.
- *Edge case?* The daily limit counts the last 24 hours, not the calendar day.
- *What would you change?* Throw a named exception for "already applied" and map it to 409; send the
  email after the transaction commits.

### 5.8 `JobService.update` and `changesContent`

- *What is "patch semantics"?* A null field in the request means "leave it alone". An earlier version
  saved the request body as the entity and wrote null over everything that was missing.
- *Why compute `contentChanged` before applying the changes?* Afterwards the old values are gone.
- *Why does flipping `isActive` not trigger review?* It changes visibility, not what the posting says.
- *Edge case?* A rejected posting that is edited stays rejected; only `PUBLISHED` goes back to review.
- *Limitation of "null means unchanged"?* A field cannot be cleared.

### 5.9 `JobService.viewById` and `isVisibleTo`

- *Why 404 and not 403 for an unpublished posting?* So the review queue cannot be discovered by walking
  ids.
- *Why `@Transactional` without `readOnly`?* It runs the view-count UPDATE.
- *Why set `viewCount + 1` on the response by hand?* The UPDATE went straight to the database; the loaded
  entity still has the old value.

### 5.10 `AdminService.setBanned`

- *Why delete refresh tokens?* So the user cannot obtain a new access token.
- *Why can an admin not ban an admin?* A compromised or mistaken admin could otherwise lock out the
  others. They must be demoted first, and there is deliberately no endpoint for that yet.
- *Why write the audit row in the same transaction?* "An action that was not recorded did not happen."

### 5.11 `SalaryEstimateService`

- *Why is `withinRateLimit()` synchronized?* Two request threads could both read the counter as 9 and
  both proceed.
- *Fixed window: what is its weakness?* A burst at the edge of two windows can reach twice the limit.
- *Why `unless = "#result.narrative() == null"`?* So a failed model call is not cached for an hour.
- *Does the timeout cancel the HTTP call?* No, it abandons it; the thread stays busy until the client
  gives up. A comment in the code says so and names the fix.
- *Why does `@Cacheable` work here?* The controller calls it through the Spring proxy. A call from inside
  the same class would skip the cache.

### 5.12 `FileStorageService.loadFile`

```java
Path path = uploadDir.resolve(filePath).normalize();
if (!path.startsWith(uploadDir)) throw new ResourceNotFoundException(...);
```

- *What does it prevent?* `../../etc/passwd`, and absolute paths, which `resolve` treats as a replacement.
- *Why `Path.startsWith` and not `String.startsWith`?* It compares whole path elements, so `/uploads-evil`
  does not pass as being inside `/uploads`.
- *What is still weak?* Uploads are validated by file extension only.

### 5.13 `GlobalExceptionHandler`

- *What does `@ControllerAdvice` do?* Applies these handlers to every controller.
- *How does Spring choose a handler?* The most specific exception type that matches.
- *What is risky?* The `RuntimeException` → 400 handler. A bug such as a `NullPointerException` is
  reported as the client's fault.
- *What is inconsistent?* Validation errors are `{field: message}`; the rest are `{error: message}`.

### 5.14 `SpaWebConfig`

- *Why turn off `spring.web.resources.add-mappings`?* So Boot's default static handler does not compete.
- *Why does a path containing a dot return null?* A missing asset such as an old hashed JavaScript file
  should be a 404, not HTML that the browser then fails to parse as a script.
- *Why is the API not affected?* Controllers are matched before resource handlers, and `isBackendPath`
  excludes `api/`, `actuator`, `v3/` and `swagger-ui`.

### 5.15 `services/api.js` and `AuthContext.jsx`

- *Why read the token inside the interceptor, not once?* So a login or logout is picked up immediately.
- *Why `status === 401 && hadToken`?* A 401 from a login attempt is a wrong password and belongs to the
  form. Only a 401 on a request that carried a token means the session died.
- *Why dispatch an event instead of redirecting?* This file is outside React. The event lets `AppShell`
  log out, show a message and navigate with the router, remembering where the user was.
- *What is wrong today?* The backend sends 403 for a dead token, so this branch never runs.
- *What is stored in `localStorage`?* `token`, `refreshToken`, and `user`, which is the whole login
  response and therefore contains both tokens again.

### 5.16 `JobList.jsx`

- *Why derive `applied` from `useSearchParams` instead of keeping it in state?* One source of truth.
- *Why is there a separate `draft`?* The user edits filters in a form; they are applied (written to the
  URL) on submit.
- *How does the draft follow the back button?* The component compares the current query string with the
  one it last saw and resets the draft during render, without an effect.
- *Why two endpoints?* No filters and the default sort use `/jobs/paginated`; anything else uses
  `/jobs/search`.

---

## 6. Challenges and Problem-Solving

### 6.1 Challenges that are visible in the code and commit history

These are real: each one is backed by a code comment, a migration, a test or a commit. Check that the
story matches your memory before telling it.

| Challenge | Evidence | How to tell it |
| --- | --- | --- |
| **Unreviewed postings were being served** | Comment in `V2__job_moderation_status.sql` and `JobStatus` | "Approval was a boolean, and five of my seven job queries forgot to filter on it. I replaced it with a status enum and routed every public read through three 'visible' finders." |
| **PostgreSQL inferred `bytea` for a null parameter** | Comment in `JobRepo.advancedSearch` | "Search with an empty keyword failed with `lower(bytea)`. I cast the string parameters explicitly." |
| **Role failures came back as 400** | Comment in `GlobalExceptionHandler` | "`AccessDeniedException` is a RuntimeException and my catch-all turned it into 400. I added a dedicated handler." |
| **Two fast clicks created two applications** | `V4__application_lifecycle.sql` | "The check was a read then a write. I removed existing duplicates in the migration and added a unique index." |
| **The API returned password-reset tokens inside applicant data** | Comment on `ApplicationResponse` | "The module returned the entity, whose applicant was a full user. I replaced it with a DTO that embeds a summary." |
| **The recommendations endpoint exposed password hashes and reset tokens** | Comment on `MatchScoreResponse`; `AIControllerTest` | "The matching endpoints returned the entity, which drags in full user rows for me and for every employer listed. I only saw it when I looked at the real response. I replaced it with a DTO and added a test that fails if a hash, token or email appears." |
| **The file endpoint could read any file on the server** | Comment and tests for `FileStorageService.loadFile` | "`resolve` follows `../`. I normalise and check the result is still inside the upload directory, and wrote tests for traversal and absolute paths." |
| **Anyone could download any resume** | Comment on `FileController` | "The public file endpoint now serves only photos and logos. A resume is reachable only through an application you own or receive." |
| **The log file contained personal data** | Comment on `LoggingAspect` | "The aspect logged return values, which included contact details and tokens. It now logs method names only." |
| **A ban took up to a day to take effect** | Comments in `JwtAuthFilter` and `AdminService.setBanned` | "The locked flag is only checked at password login. I check it in the filter and delete the refresh tokens." |
| **Registration could hand out the admin role** | Comment in `AuthService.register` | "The role comes from the request body. I reject any role that is not self-assignable." |
| **Review could be bypassed by editing** | Comment on `JobService.update` | "Publish something clean, then edit it. Content changes now send a published posting back to review." |
| **An employer could post under another company's name** | Comment on `CompanyService.getOwnedEntityById` | "The job module now asks the company module for a company the caller owns." |
| **Profiles could be harvested by walking ids** | Comment on `UserService.getVisibleProfile` | "Ids are sequential and profiles default to public, so I strip contact details for anyone but the owner." |
| **A circular dependency between two modules** | `JobClosedEvent` | "Job must not call application. I publish an event instead." |
| **Lost updates on the view counter** | `JobRepo.incrementViewCount` | "Load, add, save loses counts under concurrency. One UPDATE statement does not." |
| **A lazy proxy broke a JSON response** | Comment on `Notification.user` | "Jackson could not serialise the Hibernate proxy. I ignored the field; DTOs are the proper fix." |
| **`ddl-auto=update` left old columns behind** | Comments in `pom.xml` and `application.properties`; `V1__baseline.sql` | "Update never drops. I moved to Flyway, wrote a baseline, and stamped existing databases at V1." |
| **Secrets were committed** | `NoCommittedApiKeyTest`, placeholders with no default | "I moved them to environment variables, rotated the JWT key, and added a test that scans for keys." |
| **The LLM returned cut-off JSON** | Comment in `application.properties` | "Reasoning tokens used the output budget. Lower reasoning effort, higher token limit." |
| **No Spring AI starter for a free Gemini key** | Comment in `pom.xml` | "I used the OpenAI starter pointed at Gemini's OpenAI-compatible endpoint." |
| **Free-tier quota** | `withinRateLimit`, the cache | "A per-minute guard, a one-hour cache, and no caching of failed answers." |
| **Any failed call logged the user out** | Comment in `services/api.js` | "The interceptor redirected on every 401, including a wrong password. Now only a 401 on an authenticated request counts, and it fires an event." |
| **A missing asset came back as HTML** | Comment in `SpaWebConfig`; `SpaAndOpsEndpointsTest` | "The SPA fallback returned index.html for an old JavaScript file. Paths that look like files now 404." |
| **An unconfigured mail server marked the app unhealthy** | `management.health.mail.enabled=false` | "Mail is best-effort, so I excluded it from health." |
| **Auto-apply flooded employers** | Comment on `applyToSelected` | "It applied to every match without the seeker seeing the list, and each application starts a deadline. I replaced it with 'apply to up to five you ticked' and a daily cap." |
| **Sorting by an arbitrary field from the query string** | `SORTABLE` in `JobService` | "I whitelist the sort fields and sort nulls last." |

### 6.2 Likely questions

- *What was the hardest bug?* The `bytea` one (it only failed when a filter was empty), or the moderation
  boolean (nothing failed; it just quietly served the wrong rows).
- *Tell me about a security issue you found.* Pick one: path traversal in the file endpoint, reset tokens
  in applicant JSON, or the ban that did not bite.
- *A bug caused by your own design?* Returning entities from controllers. It caused the reset-token leak
  in applicant data, the lazy-proxy error, and the same leak again in the matching module, which my unit
  tests could not see because they never looked at the real JSON.
- *How do you debug a failing request?* Browser network tab (status, payload, response body) → server log
  → reproduce with curl or a test → fix with a test.
- *Did you face performance problems?* Say honestly that none have been measured at current data sizes,
  then name what you can see in the code (eager fetching, recommendations over all jobs).
- *What are you not proud of?* That the matching endpoints leaked account fields until I checked the real
  responses, and 403 for an expired token.

### 6.3 Questions only you can answer

I could not find these in the code. Fill them in before an interview:

1. Why did you choose a job portal, and where did the "employer must answer" idea come from?
2. How long did it take, and did you work alone?
3. Which part was hardest **for you** to understand or implement?
4. Did you use AI tools or tutorials, and how would you describe that honestly in an interview?
5. Which of the bugs in §6.1 do you personally remember debugging, and how did you find the cause?
6. Is it deployed anywhere? Has anyone else used it?
7. What did you learn that you did not know before?
8. Which role are you interviewing for (backend, frontend, full-stack; fresher or experienced)? That
   changes which sections to emphasise.

---

## 7. Comparison and "Why Not" Questions

**Why Spring Boot instead of Node.js?**
> Role-based security, transactions, scheduling and data access are all first-class in Spring and work
> together. Node would give me one language across the stack and a lighter runtime, and it would have
> been a valid choice. The costs of mine are slower startup and more memory.

**Why PostgreSQL instead of MongoDB?**
> The data is relational: applications join jobs and users in almost every query, and I rely on foreign
> keys, unique indexes and CHECK constraints. MongoDB fits document-shaped data; here I would have had to
> rebuild integrity in application code.

**Why PostgreSQL instead of MySQL?**
> Either would handle the CRUD. I use `PERCENTILE_CONT` and `FILTER`, which PostgreSQL supports directly.

**Why JPA instead of JDBC?**
> Most operations are CRUD, where JPA removes boilerplate and gives pagination and dirty checking. Where I
> need control I write native SQL. The price I am paying is the N+1 problem from eager associations.

**Why a monolith instead of microservices?**
> One developer, one database, shared tables. I planned a split and abandoned it. If one part had to be
> separated, it would be the salary estimate, which has an external dependency and its own rate limit.

**Why JWT instead of sessions?**
> No session store, and it works the same for a future mobile client. Honest point: because my filter
> loads the user on each request, I have the cost of a session lookup anyway. A plain server session
> would have been simpler; a JWT with the role inside and a deny-list would be more truly stateless.

**Why `localStorage` instead of a cookie?**
> Simplicity, and no CSRF concerns. The downside is XSS exposure. An HttpOnly cookie for the refresh token
> is the stronger design.

**Why polling instead of WebSockets for notifications?**
> A status change is not urgent, and polling a count every 60 seconds needs no extra infrastructure.
> WebSockets or Server-Sent Events would be the next step if it needed to feel instant.

**Why an event instead of a direct service call?**
> To keep module dependencies one-way.

**Why an enum status instead of a boolean for moderation?**
> A boolean cannot say "rejected, because…", and it was easy to forget in queries.

**Why store the timeline as rows instead of reading it from logs?**
> It is product data the user sees, it must be transactional with the status, and it must survive log
> rotation.

**Why SQL percentiles plus an LLM, instead of just asking the LLM?**
> The model would invent numbers. This way the numbers are from my data and the model only explains them.

**Why serve the frontend from the Spring Boot jar?**
> One container, same origin, no CORS, and the two cannot be deployed out of step. The cost: a frontend
> change needs a new jar, and static files are served by the JVM instead of a CDN.

**Why MapStruct instead of writing mappers by hand?**
> Generated at compile time, no reflection, and with my settings a DTO field with no source fails the
> build.

**Why Flyway instead of `ddl-auto=update`?**
> Migrations are reviewable and repeatable and can transform data, like the backfill in V2 and the
> duplicate cleanup in V4.

**Why TanStack Query instead of `useEffect` or Redux?**
> It handles caching, loading and error states, retries and invalidation. Redux solves client state, and I
> have almost none.

**Why react-hook-form?** Less re-rendering and less code than controlled inputs for every field.

**Why no component library such as Material UI?**
> I wanted the product's idea, the response clock, to be the visual identity, and a library brings its own
> look. The cost is that I maintain my own buttons, inputs and modal styling.

**Why JavaScript instead of TypeScript?** It was the faster start. I would use TypeScript next time.

**Why Maven instead of Gradle?** The Spring default, declarative, and I had no custom build logic.

**Why Mockito unit tests instead of integration tests?**
> They are fast and they pin the business rules. But they mock the repositories, so they never run my SQL
> and never see the real JSON. I need a layer of HTTP-level tests on top.

**Why offset pagination instead of keyset?** Simple, and it supports jumping to a page. Keyset is faster
on deep pages; my data sizes do not need it.

---

## 8. Mock Interview

### 8.1 Beginner (30)

1. **Introduce your project.** → 30-second pitch.
2. **What problem does it solve?** → Fake listings, hidden pay, employers who never answer.
3. **Who uses it?** → Job seekers, employers, admins.
4. **What are the main features?** → Search and apply, application tracking, posting and hiring, moderation, salary estimate, notifications.
5. **What is the tech stack?** → Java 21, Spring Boot, PostgreSQL, React, Docker.
6. **What is a REST API?** → An HTTP interface where URLs are resources and methods are actions, exchanging JSON.
7. **What is the frontend's job? The backend's?** → The frontend shows data and collects input. The backend enforces rules and stores data.
8. **What is JSON?** → A text format of key-value pairs and arrays.
9. **Name the HTTP methods you used.** → GET, POST, PUT, PATCH, DELETE.
10. **What does status 401 mean? 403? 404?** → Not authenticated; not allowed; not found.
11. **What is a controller?** → The class that receives HTTP requests, e.g. `JobController`.
12. **What is a service?** → Where business rules and transactions live, e.g. `JobService`.
13. **What is a repository?** → The data access interface, e.g. `JobRepo`.
14. **What is an entity?** → A class mapped to a table, e.g. `JobPost` ↔ `job_post`.
15. **What is a DTO and why use one?** → A network-facing shape. It hides fields like the password hash and decouples the API from the tables.
16. **Which database and why?** → PostgreSQL: relational data, constraints, percentile functions.
17. **How many tables?** → Fourteen: ten entity tables and four collection tables.
18. **What is a primary key?** → A unique identifier for a row.
19. **What is a foreign key?** → A reference to another table's key, e.g. `job_applications.applicant_id`.
20. **How are passwords stored?** → As BCrypt hashes.
21. **What is a JWT?** → A signed token containing the user's email and an expiry.
22. **Where is the token stored in the browser?** → `localStorage`.
23. **What is a role?** → A named set of permissions: seeker, employer, admin.
24. **What is React?** → A library for building UIs from components driven by state.
25. **What is a component?** → A reusable function that returns UI.
26. **What is state?** → Data owned by a component; changing it re-renders.
27. **What is Axios?** → The HTTP client the frontend uses.
28. **What is Maven?** → The build and dependency tool; `pom.xml`.
29. **What is Docker used for here?** → Packaging the app and running it with PostgreSQL.
30. **How do you run the project?** → `docker compose up --build`, or `./mvnw spring-boot:run` plus `npm run dev`.

F/U to expect at this level: "show me that in the code", "what happens if that field is missing", "what
status code would that return".

### 8.2 Intermediate (30)

1. **Trace `POST /api/applications/job/12` end to end.** → §2.
   F/U: where is the role checked? → `@PreAuthorize("hasRole('JOB_SEEKER')")`.
2. **How does the server know which user is calling?** → `JwtAuthFilter` builds a `UserPrincipal`; `@AuthenticationPrincipal` reads it.
   F/U: can the client send a different user id? → No user id is taken from the body or URL for "my" data.
3. **How do you stop employer A reading employer B's applicants?** → `requireJobOwner` in the service; tested.
4. **What are your three layers of authorization?** → URL rules, `@PreAuthorize`, ownership checks.
5. **Explain BCrypt.** → Salted, slow, one-way.
6. **Why is CSRF disabled?** → No cookies.
7. **What is CORS and how did you configure it?** → Allowed origins from a property; not needed when the jar serves the SPA.
8. **How does `@Transactional` work?** → A proxy begins, commits or rolls back.
9. **Derived query vs `@Query`?** → Name-based vs written JPQL or SQL.
10. **Why native queries?** → `PERCENTILE_CONT`, `FILTER`.
11. **How does pagination and sorting work?** → `PageRequest`, a whitelist of sort fields, nulls last.
12. **What is a job's visibility rule?** → Published and active; otherwise only the owner and admins.
13. **What happens when an employer edits a published job?** → It returns to review if the content changed.
14. **Explain the application statuses.** → Eight values; the employer moves one stage at a time or rejects; the applicant can withdraw; the system sets "no response".
15. **How is the timeline stored?** → One `application_events` row per change, in the same transaction.
16. **How does the deadline task work?** → Hourly: lapse overdue, then remind once.
17. **How is the response rate computed?** → One native query, 90 days, hidden under 5 outcomes.
18. **How does bulk apply handle a failure?** → Each job is its own transaction; failures are reported under `skipped`.
19. **How does the match score work?** → 70 points for skill overlap, 20 for experience, 10 for profile completeness; stored once.
    F/U: weakness? → Substring matching, never refreshed.
20. **How does the salary estimate work?** → SQL percentiles; the model explains them; fallback to numbers only.
21. **How does password reset work?** → A UUID token valid for one hour, emailed as a link, single use, same response for unknown emails.
22. **How are files uploaded and served?** → Multipart; stored under photos, resumes or logos; photos and logos are public, resumes go through the application.
23. **How do notifications reach the user?** → A row in the database and an email; the frontend polls the unread count every 60 seconds.
24. **Explain your global exception handling.** → `@ControllerAdvice`, one handler per exception type.
25. **What does Flyway do?** → Runs versioned SQL files once, in order.
    F/U: what if you edit an old migration? → Checksum mismatch; startup fails.
26. **What does `ddl-auto=validate` protect against?** → Entities and schema drifting apart.
27. **How does the frontend fetch and cache data?** → TanStack Query, keys, invalidation.
28. **How do you protect routes in React?** → `ProtectedRoute` by role; convenience only.
29. **What tests did you write?** → 40 backend tests: Mockito service tests, file safety, a response-shape test, two context tests.
30. **Explain your Dockerfile.** → Three stages; the SPA inside the jar; JRE-only runtime; non-root; health check.

### 8.3 Advanced (20)

1. **What are the weaknesses of your token design?** → `localStorage`; no logout on the server; refresh never used and never rotated; a password reset does not end sessions; a query per request.
   F/U: design revocation. → A token version on the user, compared in the filter (which already loads the user), bumped on reset, ban and logout.
2. **An endpoint returns an entity. What can go wrong?** → It can expose every column (it happened in my recommendations endpoint: hashes and reset tokens, until I moved it to a DTO), fail on lazy proxies, and tie the API to the schema.
   F/U: how would you prevent it for good? → DTOs everywhere, turn off open-in-view so entity serialisation fails fast, and a test that asserts no response contains `password`.
3. **Why does an expired token get 403 in your API?** → No authentication entry point is configured, so Spring's default is used. Fix: `HttpStatusEntryPoint(UNAUTHORIZED)`.
4. **Two requests apply to the same job at the same moment.** → Unique index; the second fails; today it surfaces as 500, should be 409.
5. **What isolation level do you run at, and does it matter?** → PostgreSQL's default, READ COMMITTED. It is enough because correctness relies on constraints and single-statement updates, not on read-then-write.
6. **Your scheduler runs on two instances. What breaks?** → Duplicate reminder emails and duplicate "no response" events. Fix: ShedLock, or `SELECT … FOR UPDATE SKIP LOCKED`.
7. **An email is sent, then the transaction rolls back.** → Possible today. Fix: send after commit with `@TransactionalEventListener`.
8. **Is your event listener synchronous? Is that good?** → Yes, same transaction. Good for consistency; bad if the listener is slow or fails, because it rolls back the close.
9. **Explain the N+1 in your job list and fix it.** → Eager `@ManyToOne` and `@ElementCollection`. Lazy + `@EntityGraph`, or `@BatchSize`, or a DTO projection.
10. **How would you make search fast at a million postings?** → `pg_trgm` GIN indexes or full-text search with a `tsvector` column.
11. **How would you cache?** → Public job lists for a short time; the response rate per employer; never anything user-specific without the user in the key.
12. **How do you deploy a breaking schema change with zero downtime?** → Expand, migrate, contract. V2 did add-nullable, backfill, set-not-null in one migration, which is fine for a small table but would need splitting across releases for a live system.
13. **What would you monitor?** → Error rate, latency percentiles, pool usage, the deadline task's counts, LLM timeouts and rate-limit skips, login failures.
14. **What is risky about `LocalDateTime` for deadlines?** → No zone. A server zone change moves every deadline, and the browser reads the value as local time.
15. **Can a seeker game the system?** → 20 applications a day and 5 per bulk call limit spam. Withdrawing and re-applying to restart the employer's clock does not work either: the withdrawn row still exists, so both the "already applied" check and the unique index refuse a second application.
16. **Can an employer game the response rate?** → They could move everything to "reviewed" on day one without really reading. The metric measures a first response, not a real answer. A deadline per stage would close that.
17. **Your `RuntimeException` handler returns 400. Why is that a problem?** → It reports server bugs as client errors and can leak messages.
18. **How would you add a second admin safely?** → An admin-only promote endpoint that writes to the audit log, and a rule that the last admin cannot be demoted.
19. **How would you test the native queries?** → `@DataJpaTest` against a real PostgreSQL (Testcontainers), inserting rows and asserting the percentile and the rate.
20. **What is the worst thing an attacker could do today?** → With an XSS bug, steal a token from `localStorage` that works for 24 hours, plus a refresh token that works for 7 days and cannot be revoked by logging out. Before the DTO fix it was worse: any job seeker could read an employer's reset token from the recommendations response.

### 8.4 Project-specific scenarios (20)

1. **A seeker applies to a job that the employer switched off a second ago.** → 404 "Job not found": only a published, active posting accepts applications.
2. **A seeker applies twice.** → 400 "You have already applied to this job".
3. **A seeker sends 6 ids to bulk apply.** → 400 "Choose between 1 and 5 jobs to apply to at once".
4. **A seeker has applied 20 times in the last 24 hours.** → 403 with the limit message; in bulk, the remaining ids appear under `skipped`.
5. **An employer tries to move an application from pending straight to offered.** → 400 "An application that is pending cannot be moved to offered".
6. **An employer does nothing for 14 days.** → Within the hour after the deadline the application becomes "no response", the applicant is notified, and it counts against the rate.
7. **The employer then reviews it on day 16.** → Allowed. The status moves on, `respondedAt` is set, but it is after the deadline, so it is still a miss.
8. **A seeker withdraws on day 3, before any answer.** → Status "withdrawn"; the employer is notified; it is left out of the response rate, because the employer was never given the full window.
9. **An employer has answered 3 applications in total.** → The public rate is hidden (`responseRatePercent: null`), sample size 3.
10. **An employer edits only the salary of a published posting.** → Content changed → back to pending review, hidden from the public until an admin publishes again.
11. **An employer switches a posting off.** → Not a content change. A job-closed event rejects every open application with "Position closed".
12. **An employer deletes a posting with no applicants.** → A hard delete is attempted. If a seeker saved it or has a match score for it, the foreign key refuses and the request fails. This is a known gap.
13. **An admin rejects a posting without a reason.** → 403 "A reason is required to reject or suspend".
14. **An admin tries to feature a pending posting.** → 403 "Only a published posting can be featured".
15. **Someone registers with `"role":"ADMIN"`.** → 403 "That role cannot be chosen at registration".
16. **A seeker opens `/api/jobs/45`, which is still in review.** → 404, as if it did not exist. Its owner and admins get it.
17. **Anyone requests `/api/files?path=resumes/resume_4_ab12.pdf`.** → 404: the public endpoint serves only `photos/` and `logos/`.
18. **The Gemini key is not set.** → The salary panel shows the percentiles and no narrative.
19. **Five postings match "Java Developer, Pune, 3 years".** → Confidence is MEDIUM (5 to 19); 20 or more is HIGH; fewer than 5 is LOW.
20. **A user opens `/job/3` directly in a new tab on the deployed site.** → The server returns `index.html` (SPA fallback) and React Router renders the job.

---

## 9. Rapid Revision Sheet

Numbers worth remembering:

| Item | Value |
| --- | --- |
| Access token (JWT) lifetime | 24 hours, HS256, subject = email |
| Refresh token lifetime | 7 days, a UUID in the database |
| Password reset link | 1 hour, single use |
| Response deadline | 14 days from applying |
| Reminder to the employer | 4 days before the deadline, once |
| Deadline task | Every hour, first run 1 minute after startup |
| Response-rate window / minimum sample | 90 days / 5 known outcomes |
| Application limits | 20 per 24 hours; 5 per bulk request |
| Application statuses | 8: PENDING, REVIEWED, INTERVIEW, OFFERED, ACCEPTED, REJECTED, WITHDRAWN, NO_RESPONSE |
| Job statuses | 4: PENDING_REVIEW, PUBLISHED, REJECTED, SUSPENDED |
| Roles | 3: JOB_SEEKER, EMPLOYER, ADMIN |
| Match score weights | 70 skills + 20 experience + 10 profile completeness; recommendations at 50 or more |
| Salary estimate | 25th, 50th, 75th percentile; cache 60 minutes, 1,000 entries; 10 model calls per minute; 15 s timeout |
| Salary confidence | HIGH at 20 or more comparables, MEDIUM at 5 or more, else LOW |
| Upload limit | 10 MB; images jpg, jpeg, png, gif, webp; resumes pdf, doc, docx |
| Default page sizes | Jobs 10, admin queue 20, audit log 50 |
| Notification polling | Every 60 seconds |
| Frontend cache | Fresh for 30 seconds; one retry |
| Tables / migrations | 14 tables (10 entities), V1 to V4 |
| Endpoints | 59 across 10 controllers |
| Tests | 40 backend; no frontend unit tests |
| Ports | API and bundled site 8080; Vite dev server 5173; PostgreSQL 5432 |
| Versions | Java 21, Spring Boot 3.4.3, React 19, Vite 8, PostgreSQL 16 |

Five things to mention without being asked:

1. The application state machine, with every change written to a timeline in the same transaction.
2. The public response rate, computed in SQL and hidden until the sample is large enough.
3. Moderation as a status with a reason and an audit log, and re-review when a published posting is edited.
4. Three layers of authorization, with ownership checked in the service and covered by tests.
5. The grounded salary estimate: numbers from SQL, the model only explains, and it degrades instead of failing.

Three weaknesses to name before the interviewer finds them:

1. The recommendations endpoint used to expose account fields because it returned an entity; fixed with a DTO and a test, and the lesson is to test the real JSON.
2. An expired token gets 403 instead of 401, and the refresh token is never used.
3. Eager associations cause N+1 queries on every job list.
