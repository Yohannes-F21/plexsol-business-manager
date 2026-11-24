# Security Audit — Final System Audit

| Field | Value |
| --- | --- |
| Audit date | 2026-11-24 |
| Scope | Authentication, authorization, sessions, API validation, secrets, financial guards, CORS/Helmet |

## Verified controls

| Control | Status | Evidence |
| --- | --- | --- |
| Unauthenticated API denial | **PASS** | `GET /api/clients` → 401; reports/email-jobs unauth 401 in tests |
| Session login / logout | **PASS** | Auth tests + live login cookie |
| Argon2id passwords | **PASS** | `@node-rs/argon2`; seed hashes |
| Session token hashed at rest | **PASS** | Session service (prior phase + code) |
| httpOnly + SameSite=Lax cookie | **PASS** | `apps/api/src/lib/cookies.ts`; Secure in production |
| Signed cookies (`SESSION_SECRET`) | **PASS** | `cookieParser(env.SESSION_SECRET)` + `signed: true` |
| Login rate limiting | **PASS** | Auth test: 5 failures then 429 |
| Business route role gate | **PASS** | `requireBusinessAccess` = ADMIN \| STAFF on domain routers |
| Email approve/reject ADMIN-only | **PASS** | `requireRole("ADMIN")` on email-jobs mutations |
| Over-allocation prevention | **PASS** | App checks + PG trigger; concurrency test PASS |
| Cross-client allocation blocked | **PASS** | Financial invariant tests |
| Zod request validation | **PASS** | Shared schemas on routes |
| Helmet enabled | **PASS** | `app.ts` |
| CORS credentialed origin allowlist | **PASS** | `CORS_ORIGIN` exact match |
| Health ready fails closed if DB down | **PASS** | Code + prior phase live check |
| `.env` not committed | **PASS** | Untracked; `.env.example` placeholders |
| Seed refuses production without flag | **PASS** | Seed gate `ALLOW_DB_SEED` |
| Manual subscription_renewal expenses blocked | **PASS** | Expenses API + tests |

## Outstanding / weak areas

| Item | Severity | Notes |
| --- | --- | --- |
| Default seed admin password when `SEED_ADMIN_PASSWORD` unset | **HIGH** (ops) | `.env` lacks `SEED_ADMIN_PASSWORD`; default `ChangeMe-Plexsol-Admin-1!` still works in this environment |
| No CSRF token beyond SameSite=Lax | **MEDIUM** | Acceptable for many SPA+cookie apps; document residual risk for cross-site POSTs from Lax-compatible navigations |
| In-memory login rate limit | **MEDIUM** | Single-process only; multi-instance deployments need shared limiter |
| `assertSelfOrAdmin` mostly demo-only | **LOW** | Multi-user ownership not a current product requirement |
| Client bundle secret scan | **BLOCKED** | Automated context extraction blocked by environment policy; web source does not import API env secrets; still confirm production bundle before release |
| Dependency vulnerability scan | **NOT EXECUTED** | `pnpm audit` not run this audit |
| Financial ETB snapshot integrity on renewals | **HIGH** | API accepts mismatched ETB `amountEtb` on renewals (**DEF-FS-01**) — reporting corruption vector |
| Exchange-rate mutation surface | **HIGH** (integrity) | No authenticated create API; rates only via seed/DB (**DEF-FS-02**) |

## Authorization model note

User management is out of scope. Current model is shared ADMIN/STAFF access to business data (not per-client multi-tenant isolation beyond payment ownership checks). This matches documented phase scope.

## Production secret checklist (must verify before deploy)

- [ ] Rotate any historically exposed Neon credentials (prior DEF-P2-01).
- [ ] Set unique strong `SESSION_SECRET` and `SEED_ADMIN_PASSWORD` (no defaults).
- [ ] Confirm `NODE_ENV=production` enables Secure cookies.
- [ ] Confirm SMTP credentials never reach frontend.
- [ ] Confirm `.dockerignore` excludes `.env` (present).
