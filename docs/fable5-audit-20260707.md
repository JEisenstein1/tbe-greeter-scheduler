# TBE Greeter Scheduler — Product/Engineering Audit (2026-07-07)

Auditor: Claude (Fable 5), branch `audit-fable5-improvements-20260707`.
Scope: full read of `src/`, `api/`, `server/`, tests, and docs; local build/test/typecheck; live-path smoke test of the chat endpoint via the dev stack. No pushes, no deploys, no external sends.

## 1. Current-state audit

The app has evolved well past its own documentation. `CLAUDE.md` described a stateless, in-memory, mock-auth SPA; the codebase actually has:

- A **Neon Postgres backend** (`api/_db.js`) with services/slots/users/audit/email tables, seeded from a fixture when empty, plus `/api/services/*` CRUD with role guards.
- **Real Google OAuth** (`api/auth/google/*`) issuing HMAC-signed HttpOnly session cookies; `ADMIN_EMAILS` allowlist for the admin role. The password/guest auth paths remain client-side mock.
- A hardened **AI chat Edge Function** (`api/chat.js`): input sanitization, allow/deny scope gates, role derived from the session cookie (not the request body), per-role redaction of the services payload, deterministic intent builders that bypass the model, role/intent filtering of returned tool actions, and full telemetry logging.
- **Real confirmation emails** with ICS calendar invites (Resend or Gmail) on signup/assignment.
- A solid test suite: 20 files / 154 tests at baseline, all passing; `tsc` and `vite build` clean.

Overall assessment: the architecture is sound and the AI-safety posture is genuinely good (server-side role derivation, redaction, guest tool lockout). The highest-leverage problems were **staleness** (data and docs that decayed as time passed) and a handful of **truthfulness gaps** where the UI reports success/state that didn't happen.

## 2. Prioritized issues found

### P0 — defeats the app's core goal
1. **Stale seed data left the calendar empty of weekly services.** `INITIAL_SERVICES` hardcoded Shabbat dates ending 2026-06-27. As of today (2026-07-07), demo/local/no-DB deployments — and any DB seeded from this fixture — show *zero upcoming weekly services until the High Holidays in September*. Volunteers open the app and find nothing to sign up for.
2. **AI actions silently no-op in fixture mode (id type mismatch).** Fixture service ids were numbers (`1..13`); AI tool calls return string ids. `applyAssignVolunteer/applyRemoveSignup/applyRequestCoverage` compared with strict `!==`, so an AI "sign me up" updated nothing while the chat replied "Signed up — confirmation sent". Fake success on the flagship feature.

### P1 — misleads users / breaks a workflow
3. **Grid calendar hardcoded to May 2026** (`useState(2026)`, `useState(4)`), opening two months in the past forever.
4. **Assigning a substitute didn't resolve the coverage request in the UI.** The backend clears `coverage_requested` on signup; the frontend's optimistic update didn't, so a closed request stayed in Coverage Requests showing the *new* volunteer as needing a sub.
5. **Slot-conflict errors were swallowed as success.** All mutation handlers caught every API error "for demo mode", so a real 409 (slot just taken by someone else) still showed "Signed up ✓" locally — a double-booking display.
6. **Fake claims in admin/volunteer UI copy**: "Send to All Volunteers" animates Queued→Sent with no email provider behind it; Coverage cards said "Distribution list notified" (nothing is sent); AI coverage card said "admin notified" (admins only see a badge).

### P2 — quality / privacy / drift
7. **AI system-prompt slot templates contradicted the app.** The prompt told the model Shabbat Morning = "2 Greeters + 1 Usher + 1 Parking Attendant" etc., while the app's EventEditModal and seed data use 1 Greeter, and HH services use 30-minute windows of Greeter 1/2 + Usher 1/2. AI-created services diverged from every UI-created one.
8. **Signed-out My Dates lookup allowed partial-email enumeration.** The lookup substring-matched against volunteer emails, so a guest typing "gmail" could enumerate assignment counts and confirm a specific address's schedule.
9. **`AssignModal` crash risk**: `svc.date.split(',')[1].trim()` throws if a model-generated `create_service` supplies a date label without a comma.
10. **CLAUDE.md materially wrong** ("no database", "mock auth only", "single-turn AI", missing env vars/endpoints) — misleads every future contributor and agent.

## 3. Changes made

| # | Fix | Files |
|---|---|---|
| 1 | Evergreen seed fixture: `buildShabbatServices(todayISO)` generates one past + nine upcoming Friday/Saturday pairs relative to today, with deterministic date-based string ids (`fri-2026-07-10`), plus the fixed 2026 High Holiday services. Mirrored in the DB-seed/no-DB fallback fixture. | `src/data.ts`, `api/_data.js` |
| 2 | Loose service-id comparison (`sameId`) in the pure slot transforms so string AI ids match numeric fixture ids; App handlers now reuse the pure transforms instead of inline strict-compare maps. | `src/appLogic.ts`, `src/App.tsx` |
| 3 | Grid calendar initializes to the current month/year. | `src/views.tsx` |
| 4 | `applyAssignVolunteer` clears `coverageRequested` (mirrors backend), so assigning a substitute closes the coverage request in the UI. | `src/appLogic.ts` |
| 5 | 409 conflict handling: signup/assign handlers (manual + AI paths) surface "That slot was just filled by someone else", re-sync services from the server, and skip the optimistic write. Other errors still fall back to demo mode. `apiJson` now attaches the HTTP status to thrown errors. | `src/App.tsx` |
| 6 | Truthful copy: bulk-reminder send labeled "Preview only — not connected to a live email provider"; coverage card "Awaiting a substitute"; AI coverage card "admins will assign a substitute". AI signup toast now reports actual delivery status ("confirmation sent" only when the API says sent). | `src/views.tsx`, `src/App.tsx` |
| 7 | AI system prompt slot templates aligned with the app's real layouts (1 Greeter Shabbat, 30-min HH windows, date-based ids). | `api/chat.js` |
| 8 | Guest lookup privacy: names still substring-match, but emails only match exactly — no partial-email enumeration. | `src/appLogic.ts` |
| 9 | `AssignModal` date-label crash guard (`split(',')[1] ?? svc.date`). | `src/components.tsx` |
| 10 | Rewrote `CLAUDE.md` to describe the actual architecture (backend, auth, chat pipeline, env vars, honest known-limitations). | `CLAUDE.md` |
| 11 | Regression tests for #1/#2/#4/#8 (`audit-fixes-regression.test.ts`, 8 tests); `data.test.ts` date regex made year-agnostic. | `src/__tests__/` |

## 4. Deferred recommendations (in priority order)

1. **Serve all `api/*` routes in the local dev server.** `server/index.ts` only proxies `/api/chat`; every other endpoint 404s locally, so dev always runs demo mode and the backend paths are untestable without deploying. Mounting the handlers behind Express would close the biggest dev/prod gap.
2. **Persist the volunteer roster.** `VOLUNTEERS`/`ADMINS` are hardcoded; the admin Volunteers/Admins views mutate local state that vanishes on refresh, and the AI's admin roster lookup only sees the hardcoded list. A `volunteers` table + CRUD endpoints is the natural next backend step.
3. **Wire the bulk weekly reminder to the existing email layer.** `sendConfirmation`/provider plumbing already exists; a `/api/admin/send-reminders` endpoint iterating open slots would turn the preview into the real feature — likely the single biggest slot-fill lever (nudge emails).
4. **Notify admins on coverage requests** (email via the existing provider), so "we'll find a substitute" doesn't depend on an admin opening the hub.
5. **Session expiry**: `verifySessionCookie` never checks `iat`; a leaked cookie is valid forever (cookie Max-Age is the only bound). Add an 8h server-side check.
6. **Unify the duplicated fixture** (`src/data.ts` vs `api/_data.js`) into one shared module to prevent drift.
7. **Compute High Holiday dates per year** or hide past HH services from the fixture after they lapse.
8. **EventEditModal HH slot edits regenerate slot ids**, dropping volunteers whose window labels changed; a stable-id carry-over would preserve more assignments.

## 5. Verification results

All run locally on this branch (2026-07-07):

- `npx vitest run` — **21 files / 162 tests passed** (baseline was 20/154; +1 file, +8 tests, no regressions).
- `npx tsc --noEmit` — clean.
- `npm run build` — clean (`vite build` ✓, 35 modules).
- Runtime smoke test: `npm run dev`, then `POST /api/chat` (guest, "Can I help this Friday?") → correct deterministic guidance, no tool actions for guests; Vite serves the SPA.
- `node -e "import('./api/_data.js')"` — evergreen seed produces 23 services starting one weekend back (`fri-2026-06-26`) through nine weekends ahead plus HH.
- No pushes, deploys, or external sends were made.
