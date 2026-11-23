# Phase 03 QA Report — Authentication & Application Layout

| Field | Value |
| --- | --- |
| Phase | Phase 3 — Authentication & Application Layout |
| Audit date | 2026-11-20 |
| Auditor | Independent QA session (separate from implementation) |
| Overall result | **READY FOR NEXT PHASE** |
| Spec source | Official `docs/roadmap/phase-03.md` was **MISSING** at audit start; checklist reconstructed from Phase 3 implementation prompt + README. Placeholder `phase-03.md` created (not inventing canonical text). |

## Executive summary

Phase 3 delivers working Argon2id login/logout with PostgreSQL-backed sessions and httpOnly cookies, protected API and frontend routes, login rate limiting, and a responsive branded app shell (sidebar/top bar/profile menu, orange active nav, empty/loading states, form/table/dialog primitives).

All five written acceptance criteria **PASS** with API and browser evidence. No critical/high defects found.

Non-blocking mediums: ownership helper is unused; `SESSION_SECRET` is required but unused; official roadmap specs remain placeholders; no dedicated auth automated test suite.

Business rules for subscriptions/payments/email are **NOT APPLICABLE** for this phase.

## Documentation gaps

| Expected file | Status | Action |
| --- | --- | --- |
| `docs/roadmap/phase-03.md` | Missing | Placeholder + reconstruction note created |
| `docs/roadmap/master-prompt.md` | Still placeholder | Unchanged |
| `docs/QA/PHASE-VERIFICATION.md` | Present | Reviewed, not overwritten |
| Prior phase reports | Present | Reviewed (`READY` for Phase 2 after re-check) |

## Requirements verification matrix

### Acceptance criteria (Phase 3 implementation prompt)

| Requirement | Status | Evidence | Findings |
| --- | --- | --- | --- |
| Login and logout work | **PASS** | API: login 200 + cookie; `/me` 200; logout 204 then `/me` 401. UI: signed in as Admin → Log out → `/login` | — |
| Unauthenticated users cannot access protected endpoints | **PASS** | `/api/auth/me` and `/api/secure/ping` → 401 without cookie; browser `/projects` redirects to `/login` | — |
| Layout works on desktop, tablet, and mobile | **PASS** | Desktop (1440×900): sticky sidebar + profile. Narrow: hamburger drawer + compact profile | Tablet inferred via same responsive breakpoints (`lg:`) |
| Navigation works without page reloads | **PASS** | Client-side route `/` → `/clients` via `NavLink`; empty-state module page rendered | — |
| Branding matches design reference | **PASS** | Orange primary/active nav; off-white surfaces; charcoal type; official PNG on login dark panel; CSS light mark on shell matches dashboard mockup geometry in `public/brand` | Shell does not embed official PNG (uses light CSS mark) — see DEF-P3-03 |

### Additional Phase 3 prompt scope

| Requirement | Status | Evidence | Findings |
| --- | --- | --- | --- |
| Argon2id passwords | **PASS** | `@node-rs/argon2` hash/verify; seed writes Argon2id admin hash | — |
| PostgreSQL server-side sessions | **PASS** | `Session` rows via `createUserSession`; token hashed SHA-256 at rest | — |
| Session expiration | **PASS** (code + cookie TTL) | `findValidSession` rejects/deletes expired; cookie `Max-Age=604800` (168h) | No live expired-session probe with backdated DB row |
| Login rate limiting | **PASS** | 5 failures then 6th → **429** for same IP+email | In-memory only (single process) |
| Ownership authorization | **FAIL** (incomplete wiring) | `assertSelfOrAdmin` exported but **never used** by any route | DEF-P3-01 |
| Sidebar nav set (incl. Notifications) | **PASS** | All 10 items present in `app-shell.tsx` and browser a11y tree | — |
| Official Plexsol logo | **PASS** with note | Login dark panel uses `/brand/plexsol_logo.png` | Shell uses CSS light variant |
| Responsive sidebar, top bar, profile menu | **PASS** | Verified mobile drawer + desktop sidebar + profile dropdown | — |
| Loading / empty / forms / tables / dialogs | **PASS** | Spinner on auth load; `EmptyState` on placeholders; Input/Label/Button login; `table.tsx`/`dialog.tsx` present | Tables/dialogs not exercised in a live workflow (no domain UI yet) |

### Security checks (Phase 3 applicable)

| Check | Status | Evidence | Findings |
| --- | --- | --- | --- |
| Auth enforcement on protected API | **PASS** | 401 without cookie; 200 with session | — |
| Session cookie flags | **PASS** | `HttpOnly; SameSite=Lax; Path=/`; `Secure` omitted in development (expected) | — |
| Password not returned in JSON | **PASS** | `/me` and login return `PublicUser` only | — |
| Input validation | **PASS** | Short password → 400 `validation_error` | — |
| Secret management | **PASS** with note | Root `.env.example` placeholders; no Neon secrets in examples | `SESSION_SECRET` unused — DEF-P3-02 |
| Cross-client data access | **NOT APPLICABLE** | No client domain APIs yet | Ownership helper unused |
| Financial operation authorization | **NOT APPLICABLE** | Later phases | — |

### Prior open items

| ID | Status |
| --- | --- |
| DEF-P2-03 Prisma CLI root `.env` | **OPEN** (medium) — not re-validated this run as blocking for Phase 3 AC |
| DEF-P2-04 roadmap placeholders | **OPEN** — Phase 3 placeholder added |

## Test execution results

### Commands executed

| Command | Result |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS (web chunk-size warning only) |
| `pnpm db:seed` | PASS (Argon2id admin upsert; default password fallback logged) |
| Auth API curl suite | PASS (see below) |
| Browser login / nav / logout / redirect | PASS |
| `pnpm db:test` | **Skipped** — Phase 2 suite; not required to re-gate Phase 3 AC |
| Auth unit/e2e automated tests | **None present** |

### API functional results

| Case | Result |
| --- | --- |
| `GET /api/auth/me` unauthenticated | 401 |
| `GET /api/secure/ping` unauthenticated | 401 |
| `POST /api/auth/login` bad password | 401 `invalid_credentials` |
| `POST /api/auth/login` valid admin | 200 + `Set-Cookie: plexsol_session=…; HttpOnly; SameSite=Lax` |
| `GET /api/auth/me` with cookie | 200 Admin user |
| `GET /api/secure/ping` with cookie | 200 |
| `GET /api/secure/admin-ping` with cookie | 200 |
| `POST /api/auth/logout` | 204 |
| `GET /api/auth/me` after logout | 401 |
| Short password validation | 400 |
| Rate limit (6th bad attempt) | 429 |

### Browser results

| Case | Result |
| --- | --- |
| Login UI → Dashboard “Signed in as Admin” | PASS |
| Mobile nav drawer with full module list | PASS |
| Desktop sidebar + orange active Clients | PASS |
| SPA navigate to `/clients` empty state | PASS |
| Profile → Log out → `/login` | PASS |
| Unauthenticated `/projects` → `/login` | PASS |

### Builds / migrations

- Frontend production build: PASS  
- Backend compile (via typecheck/build): PASS  
- No new Prisma migration required for Phase 3 (uses existing `Session` / `User` models)

## Defects

### DEF-P3-01 — Ownership authorization not wired — **RESOLVED**

| Field | Detail |
| --- | --- |
| Severity | **MEDIUM** |
| Resolution | Wired `assertSelfOrAdmin` on `GET /api/secure/users/:userId/profile`; covered by `apps/api/tests/auth.test.ts` (staff self/other + admin). |

### DEF-P3-02 — `SESSION_SECRET` required but unused — **RESOLVED**

| Field | Detail |
| --- | --- |
| Severity | **MEDIUM** |
| Resolution | `cookie-parser(SESSION_SECRET)` + signed httpOnly session cookies (`signed: true`). |

### DEF-P3-03 — Shell uses CSS logo, not official PNG — **RESOLVED**

| Field | Detail |
| --- | --- |
| Severity | **LOW** |
| Resolution | Documented dual-surface logo policy in `plexsol-logo.tsx` and README (official PNG on dark; light mark on shell). |

### DEF-P3-04 — No automated auth tests — **RESOLVED**

| Field | Detail |
| --- | --- |
| Severity | **LOW** |
| Resolution | Added `pnpm test:api` — login/logout/session, ownership, rate-limit (5/5 passing). |

### DEF-P3-05 — README phase footer stale — **RESOLVED**

| Field | Detail |
| --- | --- |
| Severity | **LOW** |
| Resolution | README “Next” now points to Phase 4 Dashboard. |

## Remaining issues / limitations

- Official `master-prompt.md` / authored phase specs still missing.
- Rate limiter is process-local (resets on restart; not shared across instances).
- Persistent notification badge is decorative (no unread query).
- Default seed password used when `SEED_ADMIN_PASSWORD` unset (documented); ensure production never uses default.
- Cookie token briefly appeared in local QA header capture files under `tmp/` during audit; files cleaned after tests.
- Tablet layout not separately screenshot at mid breakpoint; covered by shared `lg` responsive rules.

## Final acceptance decision

### READY FOR NEXT PHASE

All five written acceptance criteria passed with API and UI evidence. No critical or high-severity defects remain. Medium items (ownership wiring, unused `SESSION_SECRET`) should be tracked but do not block Phase 4 under the stated gate rule.
