# Security baseline

This chapter sets the minimum security bar for every change. It covers the sprint-close security review, auth and sessions, guards and ownership, rate limits, idempotency on money, audit and log hygiene, secrets and config, uploads, error hygiene, browser hardening, encryption at rest, the dependency/CVE policy, and legal/privacy truthfulness.
The rules assume a NestJS + Prisma + PostgreSQL + Redis backend and a Next.js frontend. On another stack, keep each rule's intent and map the mechanism (guard → middleware, class-validator → your schema validator). Fill in the `<PLACEHOLDERS>` once and record them in the project's `CLAUDE.md` and `<INVARIANTS_DOC>`.
Container hardening: OPS-013, OPS-015. Honest public claims and labelled mocks: PO-038, ENG-115, SEC-049, SEC-119.

## Security review gate

- **SEC-001** `MUST` At the end of every sprint and before every commit, run a security review of the diff, untracked files included (`<SECURITY_CHECKLIST>`), with these checks:
  1. every new endpoint has auth and role guards, DTO validation with whitelist, and throttling where sensitive;
  2. critical mutations (money, capacity consumption, irreversible accepts) accept an idempotency key and have a test proving it;
  3. every new critical mutation is audited, with no passwords, tokens, message content or other PII in audit rows or logs;
  4. ownership and active identity;
  5. files: presigned URLs only, served only after a SAFE scan status, size and count limits enforced;
  6. secret configuration;
  7. the error contract;
  8. cookies and origins;
  9. new reads apply the soft-delete policy (ENG-076);
  10. the i18n parity gate is green (QA-067);
  11. the dependency audit is clean, or each advisory has a recorded disposition (SEC-100, SEC-102).

  Output: a short PASS/FAIL/N/A list per check, with patches for the FAILs only. Do not rewrite code that passes, and re-run the gates (QA-002) after patching.
- **SEC-002** `MUST` Mark a check PASS only with concrete evidence and a stated scope, and give every N/A a one-line reason. PASS is not a penetration test or a release authorization, and it says nothing about routes the diff did not touch. List the residual limitations explicitly.
- **SEC-003** `MUST` Test isolation explicitly for every new access-controlled resource. A user with a different role and a user from a different tenant must both be refused: 403 for the role check, 404 for a resource they do not own (see SEC-031).
- **SEC-118** `MUST` Before every production deploy, run the security-review skill (or an equivalent independent review) on the full release diff and require 0 HIGH and 0 MEDIUM findings. Record the result in the promotion record (OPS-102). — _why:_ the per-sprint close reviews each diff on its own; the release diff is where changes from several sprints meet.

## Authentication and sessions

- **SEC-004** `MUST NOT` Never store JWTs, session tokens or any other auth material in localStorage or sessionStorage. Tokens live only in httpOnly cookies that are Secure in production and SameSite=Lax. The access token is short-lived (about 15 min) on path `/`. The refresh token lasts about 7 days, is path-restricted to the auth routes, and is stored server-side only as a SHA-256 hash.
- **SEC-005** `MUST` Rotate the refresh token on every refresh, inside a token family (family id + replaced-at). Allow a grace window of about 30 s for multi-tab races. Reuse of a replaced token after the grace window revokes the whole family. — _why:_ reuse after rotation is the signature of a stolen token.
- **SEC-006** `MUST` Bind every access token to its session: the access JWT carries the refresh-token family id (`sid`), and every authenticated REST request, WebSocket handshake and emit checks in the DB that this family still has a non-revoked, unexpired refresh token and that the user is neither deleted nor blocked, with no cache that could delay revocation. Reject an access token that has no `sid`. Treat a revoked session, a blocked user or a deleted user as an immediate 401. On a socket, emit an auth-expired event and disconnect.
- **SEC-007** `MUST` Membership and session checks exclude deleted or blocked users and deleted organizations. Any soft-delete bypass has a narrow name and runs only on the server.
- **SEC-008** `MUST` Authenticate the WebSocket connection with the same session cookie (`withCredentials`). When the client receives an auth-expired signal, it refreshes the session and then reconnects.
- **SEC-009** `MUST` On a 401, the client makes exactly one refresh attempt and one retry of the original request. REST calls and the realtime socket deduplicate concurrent refreshes through one shared, module-level in-flight promise. The client never retries the auth endpoints themselves (login, refresh, register, logout). — _why:_ prevents refresh storms, and infinite loops when the resource still rejects after a refresh.
- **SEC-010** `MUST` Revoke old private access (refresh family, sockets) on logout, on an account block, and on a password reset or password change; also on a new login from another device when the product uses the single-session policy of SEC-011.
- **SEC-011** `SHOULD` If the product allows one active session per user, a new login revokes every active refresh token, issues a new family and sends auth-expired to the old socket. — _why:_ the simplest and safest option, and it composes with rotation.
- **SEC-012** `MUST` Hash passwords with bcrypt at cost 12, and run a dummy compare for unknown accounts. Passwords never appear in logs, audit entries or responses.
- **SEC-013** `MUST` Password-reset tokens are 32 random bytes, stored hashed, valid for 30-60 minutes and single-use. Forgot-password and resend-verification always answer a uniform 200, whether or not the account exists. An authenticated change-password revokes all refresh tokens.
- **SEC-014** `MUST` Send the verification email at registration best-effort (try/catch + log), and provide a rate-limited resend endpoint. — _why:_ a mail failure must never strand a created account; a missing resend/reset flow was a launch blocker.
- **SEC-015** `MUST` Public registration DTOs accept only non-privileged roles (`@IsIn([...])`). Admin accounts come only from a dedicated seed script that requires its credentials from env, refuses to promote an existing non-admin user and never logs the password.
- **SEC-016** `SHOULD` Implement account blocking as a reversible blocked-at timestamp. On block: revoke sessions immediately, send a transactional explanation email that ignores the notification opt-out, and refuse login, refresh and `me` with a dedicated error code. Reveal "blocked" only after a correct password. Admins cannot be blocked, and every block and unblock is audited.
- **SEC-017** `MUST NOT` Never use a UI-hint cookie for authorization. A server-readable role hint (httpOnly, role only, parsed against an exact allowlist) may only pick which header or navigation to server-render while the user query is pending; the backend stays the only authority. — _why:_ avoids header flicker without trusting client data.
- **SEC-018** `MUST` On logout (in `onSettled`, so it also runs when logout fails) and on login as a different user, synchronously clear the query cache, remove user-scoped storage keys, reset persisted stores and disconnect the realtime socket, all before the new user goes into the cache. — _why:_ on a shared computer nothing from the previous session may stay in the browser.
- **SEC-019** `MUST` Follow a post-login redirect parameter only when it is a relative path. Carry it through the login ↔ register links with `encodeURIComponent`.

## Rate limiting, lockout and client IP

- **SEC-020** `MUST` Rate-limit in tiers, with these defaults:
  - credential routes (login, register, reset-password, change-password): about 5/min; resend-verification and forgot-password: about 3/min;
  - session refresh: its own looser limit (about 30/min), because every open tab refreshes on a 401 (SEC-009) and a tight limit logs users out;
  - operations that consume scarce shared capacity or move money: about 10/min;
  - admin mutations: their own per-route limit (about 30/min for routine writes, about 3/min for admin test triggers such as a test email or a test error);
  - uploads: about 30/min;
  - expensive renders such as PDF generation: their own limit (about 20/min);
  - everything else: a global cap of 100/min per client IP.

  Apply per-user throttling only as a route guard placed after the JWT guard.
- **SEC-021** `MUST` Keep rate-limit counters in Redis, updated by an atomic script with a short timeout and an in-memory fallback on error, so every process and deployment slot shares them. Bucket IPv6 addresses by their /64 prefix. — _why:_ a client can rotate addresses inside its /64.
- **SEC-022** `MUST` Resolve the client IP once, in middleware, through one shared resolver that throttling, audit and health all use:
  - set `trust proxy` to `loopback`, or to the exact hop count of the real proxy chain, and never to `true`;
  - believe an edge-written header only when `<TRUSTED_CLIENT_IP_HEADER>` is explicitly configured and the socket peer is loopback;
  - refuse `X-Forwarded-For` as the trusted header at boot.

  — _why:_ otherwise `req.ip` is the proxy's address, so per-IP limits act as one global limit and hashed IPs in the audit trail collapse into one; `trust proxy: true` also lets a forged XFF bypass throttling.
- **SEC-023** `GOTCHA` A reverse proxy without trusted-proxies configuration rewrites `X-Forwarded-For` and puts every user in the same rate-limit bucket. After adding or changing a gateway, prove the resolved client IP with a spoofing probe on a standby or staging deployment before trusting it in production. Run the probe with the slot verification of OPS-052: consecutive requests must strictly decrement the rate-limit remaining count, and a request with a forged `X-Real-IP`/`X-Forwarded-For` must land in the same bucket. If the header can be spoofed, remove the trusted-header variable immediately and do not promote with it. After rollout, confirm that a day of audit rows shows many distinct IP hashes.
- **SEC-024** `MUST` Lock sign-in per account after N failed passwords in a window (default 10 in 15 min; 5 for admin accounts), and check the lock before the DB lookup and bcrypt. Implementation:
  - Redis keys hold only the SHA-256 of the normalized identifier;
  - while locked, the response is the same 429 with `details.retryAfterSec` and a `Retry-After` header for existing and unknown accounts, even for a correct password;
  - Redis errors fail open, because the IP limit still applies;
  - the owner gets one alert email, and the event is audited;
  - a password reset lifts the lock.

  — _why:_ prevents account enumeration and password guessing.

## Authorization: guards, roles and ownership

- **SEC-026** `MUST` Register global guards in a fixed order: deployment-standby (in blue/green, the inactive slot answers every non-safe HTTP method with 503 and a dedicated error code, so only the active slot writes), then throttler, then JWT auth, then roles. Add the tenant-approval, tenant-manager, active-subscription/entitlement and 2FA guards per controller, wherever the flow requires them. Check every new endpoint against this stack in security close (SEC-001, check 1).
- **SEC-028** `MUST` Mark a route `@Public()` only with a written justification, and give it a dedicated `@Throttle`.
- **SEC-029** `MUST` Admin routes need `@Roles(ADMIN)`, the audit decorator and the audit interceptor, which is not global. The admin area also needs:
  - a role guard at the frontend layout level;
  - typed settings with min/max validation;
  - confirmation dialogs for irreversible admin actions.
- **SEC-030** `MUST` Check ownership or tenancy in the service layer for every `:id` in a route, nested sub-resources included, and do it before any other read. Validate ids with `ParseUUIDPipe`. — _why:_ an existence check alone allows cross-tenant access (IDOR), and a past IDOR came from exactly this gap.
- **SEC-031** `MUST` Answer 404 NOT_FOUND, never 403, when the caller does not own the resource. Keep 403 for role failures.
- **SEC-032** `MUST` Mask internal fields that an audience must not see (internal scores, exact coordinates) on the server, in role-specific DTOs. Never rely on hiding them in the UI.
- **SEC-033** `MUST` Expose another user's personal contact data only while the relationship that grants it has a status in a named allowlist of active statuses. Return null once that relationship is cancelled or withdrawn. Enforce this in the API, not in the UI.
- **SEC-034** `SHOULD` Mask contact details found in free text at read time, in the DTO mappers, for viewers without access. The stored original stays unchanged.
- **SEC-035** `MUST NOT` Never rely on a read-only UI field to protect an invariant. Enforce the same invariant on the server on every create and edit (for example, a value the form shows read-only, such as the owner id or the account's verified email, is re-derived on the server on every create and edit and never read from the payload).
- **SEC-036** `MUST` Server logic that reads client-controlled JSON, such as persisted draft state, clamps every derived count or limit to a hard server-side maximum. — _why:_ the client could inflate that JSON to raise its own limits.
- **SEC-037** `MUST` Cap user-created named resources (saved drafts, presets, saved layouts) at the service/DB layer: a unique (user, name) constraint, a maximum count per user (`<MAX_ITEMS_PER_USER>`) and a maximum JSON payload size (`<MAX_JSON_BYTES>`). An ownership violation returns 404 (SEC-031).

## Input validation and output encoding

- **SEC-038** `MUST` Validate every request with a class-validator DTO, mirrored by the shared Zod schema, under a global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted` and `transform`. Put `@MaxLength` on every string, and `ParseUUIDPipe` or `@IsEnum` on every param and query value. — _why:_ unknown fields are rejected instead of slipping through, and an unvalidated enum query param once caused a 500.
- **SEC-039** `MUST` Bound numeric inputs to the DB column type (for example the INT4 max, `@Max(2_147_483_647)` plus the Zod `.max`), so that oversized values return 400 instead of a database 500.
- **SEC-040** `MUST` Validate deep JSON in the service with the shared Zod schema and a byte limit.
- **SEC-041** `MUST` Raw SQL is only ever parameterized.
- **SEC-042** `MUST` Validate free-form user values, such as custom hex colours, with the same strict regex on frontend and backend, and fall back to a safe default when validation fails.
- **SEC-043** `MUST` HTML-escape every interpolated value in email templates and in generated PDFs. — _why:_ unescaped titles and names once opened an HTML-injection path in emails.

## Idempotency, money and irreversible actions

- **SEC-044** `MUST` Mutations that move money, consume limited shared capacity or perform an irreversible acceptance support an `Idempotency-Key` header and a throttle, and a test covers both.
- **SEC-045** `MUST` Make balance and refund operations idempotent with stored receipts, and guard them against concurrent double execution: reserve the receipt and lock the affected row (SELECT … FOR UPDATE) or use a conditional status transition, inside the same transaction as the balance change (see ENG-014 to ENG-017). — _why:_ a double-refund race was flagged as a fraud vector and a launch blocker.
- **SEC-046** `MUST` Accept a payment webhook only after all of the following:
  - verify the signature over the raw body, with either the provider's signature or HMAC-SHA256 using a secret from env;
  - compare signatures with `timingSafeEqual`, and include a timestamp in the signed payload;
  - apply idempotency and replay protection;
  - reject events whose live/test mode does not match the deployment.

  (raw body availability: SEC-091)
- **SEC-047** `MUST` Validate payment provider keys at boot: check the key format in every environment and require live keys in production. Allow test mode only through an explicit flag (`<PAYMENT_TEST_MODE_FLAG>`) for isolated staging. Records created under test keys are flagged as test mode and shown with a visible banner.
- **SEC-048** `MUST NOT` Never make an irreversible user action a single click. Require an explicit confirmation step. — _why:_ an irreversible one-click accept remained a launch blocker.
- **SEC-049** `MUST NOT` Mock payments, mock-document labels and fictitious seller or legal identity values must never reach production. Decide explicitly between a real payment provider and a manual bank transfer confirmed by an admin. A manual transfer needs payment instructions, tax-inclusive totals, a reference and a cancel path. — _why:_ a mock purchase that looks real leaves paying customers stuck and produces invalid invoices.

## Audit and logging hygiene

- **SEC-051** `MUST` Audit is written only after success, and every critical audited route is listed in a spec that tests both the decorator metadata and the actual interceptor wiring (mechanism: ENG-088). Interceptor audit is not transactional with the domain commit: a crash in between leaves a gap. List this as a residual limitation (SEC-002), and write the audit row inside the domain transaction wherever a gap is unacceptable.
- **SEC-052** `GOTCHA` An audit decorator without its interceptor applied records nothing. After wiring audit on a controller, check that audit rows actually appear.
- **SEC-053** `MUST` Build audit snapshots from an explicit allowlist of keys by kind (ids, codes, numbers, flags, dates, containers), never from a blacklist. New fields stay out of the audit trail until someone reviews their sensitivity, and contact data, private text, tokens and URLs are always dropped. Store the client IP as HMAC-SHA256 with a salt from env (`<AUDIT_IP_SALT>`), and reduce the user agent to browser family and version.
- **SEC-055** `MUST NOT` Never rewrite append-only audit history or historical logs, and never switch providers silently. New redaction is not retroactive. Retention, access and remediation of old logs, and the rotation of external secrets, are explicit product-owner decisions.
- **SEC-056** `MUST` Log structured JSON with a traceId on every line, and configure HTTP access logging (pino-http or equivalent) as follows:
  - redact the `authorization`, `cookie`, `referer` and `set-cookie` headers;
  - serialize the request as only id, method and route template, and the response as only its status code;
  - accept an incoming `x-trace-id` as the traceId only when it is a valid UUID;
  - log successful health probes at level `silent`.

  — _why:_ the referer can contain reset or verify tokens.
- **SEC-057** `MUST` Never write passwords, tokens, private message content or contact data into audit entries (see SEC-053) or logs, and never log raw errors, `.message`, `.stack`, `String(e)`, emails, IPs, full URLs, request bodies, headers or provider error text. Log ids plus a safe error summary (allowlisted kind, code pattern and HTTP status), and log an unexpected 500 only as kind, route pattern, top app frame and traceId. Hash identifiers before using them in Redis keys. — _why:_ provider errors contain emails, addresses and tokenized URLs.
- **SEC-058** `MUST` Enforce SEC-057 with an ESLint `no-restricted-syntax` rule on logger calls. Prove the rule works with a probe snippet that must fail the lint.
- **SEC-060** `MUST` Keep the backend error tracker (Sentry protocol) disabled when no DSN is set. When it is enabled:
  - turn off default integrations, breadcrumbs, tracing and all data collection;
  - in `beforeSend`, scrub every event down to an allowlist: exception type, safe summary, error code/status, stack frames without source or variables, and allowlisted tags (traceId, route pattern, deployment slot, release);
  - never send request data, cookies or user data;
  - report operational signals such as "DB busy" at warning level.
- **SEC-061** `MUST` Initialize client-side error tracking only when a DSN was baked in at build. Turn off automatic PII collection, tracing, sessions and breadcrumbs. In `beforeSend`, scrub every event: strip query strings, mask ids and tokens in paths, and remove emails and long digit runs.
- **SEC-062** `MUST` Tunnel browser error-tracker traffic through a same-origin route. The route accepts only envelopes for the configured DSN, caps the body with a streamed read (it does not trust `Content-Length`), rate-limits, and does not forward the client IP. — _why:_ avoids CORS and adblock problems without turning the route into an open proxy.
- **SEC-063** `MUST` Keep product analytics cookie-less, and disabled unless provider, https host and site id are all configured. Respect Do-Not-Track. Send only fixed URLs, never `location.href` (which can contain tokens), with no extra props and `credentials: 'omit'`.

## Secrets and configuration

- **SEC-064** `MUST` Keep secrets only in env, never in code, seed scripts, docs or logs. Validate them at boot with a Zod config schema (`config.schema.ts`) that:
  - coerces numbers, transforms `'true'`/`'false'` and maps an empty string to undefined;
  - enforces minimum lengths, and gives JWT secrets no default;
  - aborts boot with a list of `path: message` issues.

  Read secrets with `getOrThrow`, never with hardcoded fallbacks. Tests and security-review evidence use only explicit fake data (e.g. `@example.invalid` accounts) or the isolated local infra, never real credentials or customer data, and review documents never quote credential values.
- **SEC-065** `MUST` For every new env var, decide deliberately whether it is required. Put cross-variable rules in `superRefine`, with a spec case for each rule. — _why:_ an optional variable with a silent fallback once hid a missing encryption key, and data was stored unencrypted.
- **SEC-066** `MUST` In production, the config schema aborts boot on any of these:
  - a mail-capture SMTP host or port (Mailpit, localhost);
  - SMTP without auth or TLS;
  - a missing sender name or monitored support address;
  - payment keys that fail the checks in SEC-047;
  - secrets that must be set as a pair but are not;
  - a missing encryption key.

  Provide an explicit escape-hatch variable for isolated previews. — _why:_ a production stack running on capture-SMTP settings once swallowed every email silently.
- **SEC-067** `GOTCHA` Don't detect a dev mail host by an exact-hostname match: a variant slipped past such a guard. Match patterns (host and port), and test the variants.
- **SEC-068** `GOTCHA` Config read at module import time runs before dotenv initialization, so it can silently fall back to a wildcard such as CORS `*`. Resolve such values lazily (for example at the socket handshake) and fail closed.
- **SEC-069** `SHOULD` Keep `.env.example` aligned with the config schema. List optional keys as commented lines, with placeholders only and no real values, so a new environment such as staging doesn't miss any.
- **SEC-070** `MUST NOT` Never print, echo or paste a secret's value into source, console, logs or chat. Check that a secret exists with a count (`<platform> variables --kv | grep -c NAME`). Set values directly on services with the platform CLI, and run production data operations through the platform's run/connect command, so credentials are injected into the child process and never enter the conversation. — _why:_ keeps secrets out of the agent context and the transcript.
- **SEC-072** `MUST NOT` Never copy production secrets into a separate staging project.
- **SEC-073** `SHOULD` Keep browser-exposed API keys in a gitignored `.env.local` locally, and set them as build-time public env vars in the deploy environment. Restrict each key by domain in the provider's console.
- **SEC-074** `MUST` Seed and demo scripts contain no password literals, and docs never document seed or demo passwords; demo passwords come from env. All seeded demo accounts share one password read from `<SEED_PASSWORD_ENV>`, and `<SEED_SCENARIOS_DOC>` names that variable, never its value. Demo and test accounts are used only against localhost, never against any other host. The demo seed refuses to run in production unless an explicit `<ALLOW_DEMO_SEED>=1` flag is set. Other demo-data rules: SEC-075, OPS-077, OPS-078.
- **SEC-075** `MUST NOT` Never leave demo data, demo accounts or fictitious business-identity settings in production. Before public launch, disable demo accounts or set their passwords from env, create the real admin with the dedicated seed from SEC-015, and back up the DB before any FK-ordered cleanup. — _why:_ demo admin accounts with known passwords are a takeover risk, and fictitious identity values get snapshotted onto real documents.
- **SEC-076** `MUST` Public health responses contain only the status. Deployment slot, mode, release SHA, dependency checks and diagnostics are returned only when a token header matches a secret of at least 32 characters, compared in constant time, with the header redacted in logs. Read that token only from the environment, never as a CLI argument. Inject it via the platform's run command. — _why:_ keeps release identity private and the token out of shell history.
- **SEC-077** `MUST` Give each backup role its own least-privilege credentials:
  - a write key scoped to the backup prefix;
  - a read-only key for the restore test;
  - a read-only key on the source bucket;
  - a dedicated DB login with `pg_read_all_data` instead of the app user.
- **SEC-078** `MUST` Keep two independent escrow copies (a password manager plus an offline copy) of every key whose loss makes data unreadable: the backup private key, the at-rest encryption key, hashing salts and off-site storage credentials. Record only the holders' names. Don't escrow regenerable secrets (JWT) or provider-held keys. — _why:_ without these keys, every restored backup or encrypted column is unreadable.
- **SEC-079** `MUST` Keep release checkpoints (variable snapshots, DB dumps, source archives) in a directory that git and docker both ignore and only the current OS user can read. Encrypt the secrets in them at rest (for example with DPAPI on Windows), and keep SHA-256 checksums for the dumps.

## File uploads and object storage

Base flow: ENG-059 to ENG-061. The rules below are the security deltas on top of it.

- **SEC-080** `MUST` Before presigning, validate the declared MIME type against an allowlist and the size against the maximum, then bind that exact Content-Type and Content-Length into the presigned PUT signature, so the client cannot upload a different type or size. Serve a download only once its scan status is SAFE, and reject files marked BLOCKED at publish time.
- **SEC-081** `MUST` Enforce upload limits: one max-size constant (`<MAX_UPLOAD_BYTES>`), per-parent count caps (including dynamic caps computed from the parent entity) and a per-message cap, counted under the advisory lock of ENG-061. Persist a pending-scan row together with the reservation, so that a lost queue job can be recovered.
- **SEC-082** `MUST` At upload completion, HEAD the object and compare its size and MIME with what was declared, and block it on a mismatch. Then copy it, with `CopySourceIfMatch` on the exact ETag, to a fresh server-only sealed key before the async scan job runs. — _why:_ the presigned PUT stays reusable for its whole lifetime, so only a sealed copy can be scanned safely.
- **SEC-083** `MUST` State plainly when the scanner is a mock and not real antivirus. In that case SAFE only means "passed the mock scanner".
- **SEC-084** `SHOULD` Re-encode uploaded images in a worker, with a decoder pixel cap (about 40 MP), auto-orientation and all metadata stripped, into a fresh key of uuid + verified-MIME extension; set download names through a sanitized ASCII `Content-Disposition` (sharp settings: STK-122). — _why:_ strips EXIF/GPS data, and user filenames can contain personal data.
- **SEC-085** `MUST` A pending scan response is not success: poll confirm a bounded number of times, throw on blocked, then tell the user the file is saved but still processing (flow: ENG-060).
- **SEC-087** `MUST` Harden object storage:
  - the bucket is private;
  - the app key is limited to exactly the operations the storage service uses, and a separate read-only key serves backups;
  - versioning is on, with noncurrent versions expiring after 30 days;
  - the admin console is not public;
  - CORS explicitly allows PUT/GET from the frontend origin;
  - root credentials are used only for setup.

  At boot, warn without printing values when default credentials are configured, and later make that an abort.

## Error hygiene

- **SEC-088** `MUST` Every error response uses the single error envelope, with a code from the shared error-code registry (`<ERROR_CODES>`). The global exception filter maps serialization conflicts to a retryable 409 and unknown failures to a generic internal error. In production, never return stack traces, internal details or provider text, and never log them either.
- **SEC-089** `MUST NOT` Never present an operation whose outcome is unknown as a success.

## Transport, CORS and browser hardening

- **SEC-090** `MUST` Enforce an explicit CORS origin allowlist, with credentials enabled, on both REST and the WebSocket gateway. It holds the configured frontend origin plus the exact preview or slot origins from a dedicated comma-separated variable. Never use a wildcard or reflect any origin, and fail closed when the origin is missing.
- **SEC-091** `MUST` Bootstrap the backend with helmet, cookie-parser, a JSON body limit of about 1 MB, and `rawBody: true` for webhook signature checks.
- **SEC-092** `MUST` Send baseline security headers on every response: `nosniff`, `strict-origin-when-cross-origin` referrer, `X-Frame-Options: DENY` and a restrictive `Permissions-Policy`. Add HSTS and COOP `same-origin` only in production, and add `X-Robots-Tag: noindex` on any host other than the public site URL (post-deploy check: OPS-059). — _why:_ direct deployment-slot URLs must not be indexed, and a wrong site URL at build time would de-index production.
- **SEC-093** `MUST` In production, build the Content-Security-Policy per request in middleware:
  - use a fresh nonce and `'strict-dynamic'`, with no `'unsafe-inline'` for scripts;
  - set the policy on the response, and pass the nonce to the rendering layer;
  - skip CSP in development, where HMR needs inline scripts;
  - make sure the framework stamps the nonce on its own scripts (Next.js specifics: STK-123).

  — _why:_ a page rendered without the per-request nonce gets its own scripts blocked.
- **SEC-094** `GOTCHA` CSP is enforced only in production, so a forgotten host breaks only there. In the same change that adds an external script, CDN, image host, connection, embed or analytics host, add it to the central CSP builder. Before narrowing the image or connect origins, query stored data read-only for every host still in use.
- **SEC-095** `SHOULD` Receive CSP violation reports at a same-origin collector that:
  - limits the body size with a streamed read, and rate-limits;
  - logs one line with only the directive, the blocked origin and the masked page path;
  - never logs full URLs, query strings, script samples or IPs;
  - always answers 204.
- **SEC-096** `MUST` Dev-only tooling pages call `notFound()` when `NODE_ENV === 'production'`, and `robots.txt` disallows their prefix.
- **SEC-097** `SHOULD` Generate `/.well-known/security.txt` (RFC 9116) at build time from the public support-email variable, with `Expires` less than one year out. Return 404 when the variable is unset.

## Encryption at rest

- **SEC-098** `MUST` Encrypt sensitive free text, such as messages, at rest:
  - use AES-256-GCM with a 12-byte random IV;
  - store a versioned envelope: `enc.v1.<iv base64url>.<ciphertext+tag base64url>`;
  - take the 64-hex key (`<ENCRYPTION_KEY_VAR>`) from validated env config; it is mandatory in production;
  - in dev only, with no key set, fall back to plaintext and log a boot warning;
  - dual-read legacy unprefixed plaintext rows as they are, with no backfill;
  - document explicitly that this is not end-to-end encryption.

  — _why:_ protects against DB dumps and stolen backups without a risky migration of historical data.
- **SEC-099** `SHOULD` Prefer at-rest encryption plus TLS over end-to-end encryption when the platform must read content for moderation or dispute handling, and when users have no key backup or multi-device recovery. Document the trade-off. — _why:_ end-to-end encryption would block arbitration, lose history on a device change, and protect only against the platform itself.

## Dependencies, supply chain and repository hygiene

- **SEC-100** `MUST` CI blocks on both `pnpm audit --prod --audit-level high` and a full `pnpm audit --audit-level high`, which also covers the dev and build toolchain.
- **SEC-101** `MUST` Treat known HIGH/CRITICAL CVEs in the web framework or the mail library as launch blockers, and upgrade to the next major if that is the only fix. Do framework major upgrades in a dedicated sprint. Until then, mitigate transitive issues with `pnpm.overrides`, then rebuild to catch breakage.
- **SEC-102** `MUST` Before choosing versions, refresh the advisories and the lockfile evidence. Judge reachability, and record each advisory ID with its disposition and the fixed version in the verification ledger. An unassessed critical or high finding is never release-ready. — _why:_ advisory counts change over time, and some fixes exist only in a new major.
- **SEC-103** `SHOULD` Pin `packageManager` and `engines.node` in the root `package.json`.
- **SEC-104** `MUST` Scan the production image in CI with Trivy, itself run as a digest-pinned image, using `--severity HIGH,CRITICAL --ignore-unfixed --exit-code 1`. Exceptions go only in `.trivyignore.yaml`, each with a `statement` and an `expired_at` no more than 90 days out.
- **SEC-105** `MUST` Set workflow `permissions: contents: read`. Pin every third-party GitHub Action by commit SHA, with the version in a comment, and pin base images by digest. — _why:_ tags are mutable.
- **SEC-106** `SHOULD` Configure Dependabot to run weekly:
  - npm, grouped by framework family and by testing tools, with an open-PR limit of 5;
  - every directory that holds a Dockerfile;
  - `github-actions`, so SHA and digest pins get bumped.
- **SEC-107** `SHOULD` Run CodeQL for JavaScript/TypeScript with `build-mode: none` on push, on PR and on a weekly cron. Secret scanning and push protection are repository settings that the owner must switch on; they are not files.
- **SEC-108** `MUST` Run a secret scanner as an early CI step, before install, over exactly the files that would be committed. Start its allowlist empty and use synthetic keys in test fixtures. Build fixtures that contain credentialed DB URLs to non-local hosts from pieces, or allowlist them with a stated reason. — _why:_ a real local access key once leaked into a spec file.
- **SEC-109** `MUST` Before publishing local work to a remote:
  1. run a secret scanner, which must finish with 0 findings; any finding means do not publish: rotate the key and remove it from the tree;
  2. review `git status` for `.env` files, dumps and test artifacts;
  3. push tags by explicit name, never with `--tags`.
- **SEC-110** `MUST NOT` Never commit per-machine Claude Code files (`.claude/settings.local.json`, `.claude/worktrees/`). If one is already tracked, untrack it with `git rm --cached`, and add both to `.gitignore`. — _why:_ local permission allowlists contain personal permissions, absolute machine paths and even test passwords.
- **SEC-111** `MUST` Exclude every `.env.*` variant except `.env.example` in `.dockerignore`, so future test or staging secret files never reach the image.

## Legal, privacy and production truthfulness

- **SEC-114** `MUST NOT` Never ship legal pages with placeholders such as `[COMPANY NAME]`, `[ID]`, `[ADDRESS]` or `[EMAIL]`:
  - terms and privacy must identify the operator in every locale;
  - the operator's identity comes from admin settings as ICU arguments, and stays hidden behind a publish flag until real values exist;
  - the privacy policy must not promise features the product lacks;
  - a CI grep over the published locale/message files, plus a test, fails on any bracketed placeholder.

  Never put bracketed legal placeholders into locale/message files, even during development: leave the identity settings empty, so the publish flag keeps it hidden, and track the missing values as launch blockers. — _why:_ privacy law requires an identified operator, and placeholder legal text was a launch blocker in every audit.
- **SEC-115** `MUST` Registration requires an explicit terms/privacy acceptance checkbox, stored with a timestamp. Acceptance is versioned through a shared version constant and audited. A material change bumps the version and forces re-acceptance; minor wording fixes do not.
- **SEC-117** `MUST` Email notifications have a per-user opt-out column, a toggle in the UI, and an unsubscribe link that works without login, signed with HMAC-SHA256 and verified with `timingSafeEqual`. Transactional and security emails, such as an account-block notice, ignore the opt-out.
- **SEC-119** `MUST NOT` Never show fabricated ratings, review counts, statistics, prices or capabilities as if they were real, on public pages or inside the product. Seed and demo values are never presented as real data: hide the element until real data exists, and record demos and screenshots from fixtures in an isolated context (ENV-060). — _why:_ invented social proof misleads users and creates legal exposure, and demo values left on screen get mistaken for production data.

## Adapting to a new project

- Ship `<SECURITY_CHECKLIST>` as a project skill at `.claude/skills/security-close/SKILL.md`. Its frontmatter `description` reads: "Use at the end of every sprint, before commit, or when asked for a security review/hardening pass. Runs a closing checklist over the sprint's diff." Its body covers every SEC-001 check with the project's limits filled in, and ends with the SEC-001 output contract. Add the pre-deploy review of SEC-118 to the release procedure. Copy the non-negotiable items into `<INVARIANTS_DOC>`.
- List the project's critical operations: anything that moves money, consumes scarce shared capacity or is irreversible. Each one gets idempotency, audit, a dedicated throttle and a confirmation step (SEC-044 to SEC-051).
- Choose the guard stack your roles need (tenant approval, tenant manager, entitlement/subscription, 2FA), and its order (SEC-026).
- Set the numbers: rate-limit tiers, lockout thresholds, `<MAX_UPLOAD_BYTES>`, per-parent and per-user caps, `<MAX_JSON_BYTES>`, token lifetimes and the refresh grace window.
- Name the env vars: `<TRUSTED_CLIENT_IP_HEADER>`, `<ALLOW_DEMO_SEED>`, `<SEED_PASSWORD_ENV>`, `<PAYMENT_TEST_MODE_FLAG>`, `<ENCRYPTION_KEY_VAR>`, `<AUDIT_IP_SALT>`. Encode their production rules in the config schema's `superRefine` (SEC-064 to SEC-066).
- Decide what is encrypted at rest, and record the at-rest vs end-to-end trade-off (SEC-098, SEC-099). Name the escrow holders for each unrecoverable key (SEC-078).
- Wire CI before the first feature: dependency audits, the image scan, CodeQL, the secret scan, the legal-placeholder grep and Dependabot. Ask the repo owner to enable secret scanning and push protection.
- Before launch, fill in the operator's legal identity, set the terms version constant, remove all demo data and accounts, and confirm production mail and payment keys pass the boot guards.
