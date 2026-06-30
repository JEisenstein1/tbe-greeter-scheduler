# TBE Greeter Scheduler — Functional E2E Test Plan

Created: 2026-06-30
Snapshot before this work: `pre-functional-e2e-20260630T043343Z` at `2040ddf021b021dfc4a222071a7878c15c86fb5c`.

## Claude Code consultation status

Attempted read-only Claude Code consultation using `claude -p` in this repo. `claude auth status --text` reports a Claude Max login, but print mode returned `401 Invalid authentication credentials`. Proceeding with Hermes-led plan and tests; preserve this note so we can retry Claude Code after auth repair.

## Rollback / snapshot strategy

Before functional-test-driven code changes:

- Git tag: `pre-functional-e2e-20260630T043343Z`
- Git branch: `pre-functional-e2e-20260630T043343Z-branch`
- Bundle backup: `/root/staging/tbe-greeter-snapshots/pre-functional-e2e-20260630T043343Z.bundle`
- Head file: `/root/staging/tbe-greeter-snapshots/pre-functional-e2e-20260630T043343Z.head`

Before any later production-affecting fix, create another tag/branch named `pre-fix-<slug>-<UTC>` and document it in `docs/functional-e2e-change-log.md`.

Rollback code:

```bash
git checkout main
git reset --hard pre-functional-e2e-20260630T043343Z
git push origin main --force-with-lease # only with explicit approval
```

Rollback Vercel deployment: use the Vercel dashboard or `vercel rollback <deployment-url>` to the deployment recorded at the snapshot if needed.

## Coverage Matrix

| Area | Guest / signed out | Volunteer | Admin | API/script coverage | Browser/manual coverage |
|---|---|---|---|---|---|
| Home/app load | app loads, no user | app loads after OAuth session | app loads after OAuth session | `production-functional-e2e.mjs` health checks | UI smoke/manual SP6 normal Chrome |
| Auth | `/api/auth/me` null, Google start redirects | session cookie maps volunteer | session cookie maps admin | auth session checks | real Google flow blocked in HRBA; test in normal Chrome |
| Calendar | open slots visible, names hidden | open + assigned names visible | full manage view | services API + AI privacy probes | list/grid nav, cards, buttons |
| Signup | can sign up with name/email form, email sent to test alias | can sign self up, email sent | can assign volunteer | signup/remove API with cleanup | signup modal + toast |
| My Dates | prompt to sign in / lookup limited | own commitments visible; self remove | admin can inspect all through admin | signup then remove path | My Dates page |
| Coverage | cannot request | request coverage on own slot | admin coverage board/clear | request-coverage API | coverage card/admin subview |
| Admin create/edit/delete | blocked | blocked | create/update/delete service | protected endpoint checks + cleanup | admin New Event/Edit/Delete dialogs |
| AI general chat | scheduling only; no tools | scheduling + signup/coverage tools | scheduling + create tools | `/api/chat` role scenarios | chat chips + action cards |
| AI bulk pattern | blocked | blocked | preview first, confirm creates actions | preview/confirm without executing mass creates | UI prompt then confirm |
| AI privacy/security | no roster/contact, injection blocked | assignment names ok, contact blocked | full context, still secrets blocked | security probes + watchdog | spot prompts |
| Email | signup sends via Gmail fallback | same | same | response `delivery.status=sent`, cleanup | toast copy |
| Telemetry/logs | no access | no access | `/api/admin/ai-logs` accessible | admin logs API, unauthorized blocked | future admin UI |

## Test Scripts to Implement

### 1. `scripts/e2e/production-functional-e2e.mjs`

Production API-level E2E. It may rotate `SESSION_SECRET` with Vercel when run with `--rotate-session-secret`, then signs deterministic admin/volunteer cookies for protected endpoint checks.

Flows:

1. App/API health:
   - `GET /api/auth/me` unauthenticated returns `{ user: null }`.
   - `GET /api/services` returns array.
   - `GET /api/auth/google/start` redirects to Google.
2. Auth/role enforcement:
   - forged client `role=admin` without cookie is treated as guest.
   - signed volunteer cannot create/delete services.
   - signed admin can access `/api/admin/ai-logs`.
3. Admin service lifecycle:
   - create smoke service with unique ID/date.
   - verify appears.
   - update same service.
   - delete service.
   - verify gone.
4. Signup/email lifecycle:
   - find/create smoke service with open slot.
   - signup test volunteer alias.
   - verify slot is filled.
   - verify `delivery.provider` is not disabled and status is sent/prepared depending env.
   - remove signup and verify slot clear.
5. Coverage lifecycle:
   - signup volunteer.
   - request coverage for that slot.
   - verify `coverageRequested=true`.
   - cleanup.
6. AI chat:
   - off-topic prompt refused before model.
   - guest roster prompt refused.
   - volunteer can ask who is assigned but response/model context does not reveal emails.
   - volunteer contact prompt refused.
   - admin bulk pattern prompt previews with zero actions.
   - admin confirmation returns create actions but script does **not** execute mass actions.
7. Telemetry:
   - after AI probes, admin `/api/admin/ai-logs` shows recent entries.

Cleanup: delete smoke services and remove smoke signups in `finally`.

### 2. `scripts/e2e/ai-security-watchdog.mjs` or existing `~/.hermes/scripts/tbe_ai_security_watchdog.py`

Production no-agent probe, silent on clean, alerts on failures. Already active hourly via Hermes cron. Add repo-local copy or npm wrapper if desired.

### 3. `scripts/e2e/browser-functional-smoke.md`

Manual/HRBA-assisted browser checklist because Google blocks automated HRBA login. Covers normal Chrome flows:

- normal Chrome logged in as `travis.thybot@gmail.com`: Sign in → Continue with Google → admin visible.
- normal Chrome logged in as volunteer/test alias: volunteer role, no admin tab.
- signed out: no assignment names/contact info.
- calendar list/grid, sign up, My Dates, AI prompt, admin create/edit/delete.

### 4. Future Playwright suite: `tests/e2e/*.spec.ts`

Add once we install Playwright and can use test-session injection or a test-only auth route in non-production. Do not add a production backdoor auth route.

## Execution Order

1. Snapshot/tag current working version.
2. Run unit/contract suite: `npm test -- --run`.
3. Run production API E2E with cleanup.
4. Run security watchdog.
5. Run browser/manual normal Chrome checklist for Google OAuth UI.
6. If failures arise:
   - create `pre-fix-...` snapshot.
   - add failing regression test first.
   - fix minimal code.
   - run targeted test, full suite, build, production E2E.
   - document in `docs/functional-e2e-change-log.md`.

## Known Risks / Boundaries

- Google blocks HRBA automation for OAuth; real login must be checked in normal Chrome/SP6.
- Production E2E that rotates `SESSION_SECRET` signs out active sessions. Use during low-risk windows or switch to a dedicated preview deployment later.
- Email tests must only send to aliases like `jon.eisenstein+tbe-email-test@gmail.com` / `jon.eisenstein+tbe-volunteer-test@gmail.com`.
- Bulk AI pattern tests should verify returned actions but not execute mass creation unless explicitly requested.
- Vercel env values are encrypted; scripts verify behavior, not plaintext env.
