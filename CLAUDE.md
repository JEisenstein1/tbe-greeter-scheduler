# CLAUDE.md — TBE Greeter Scheduler

## Project overview

Mobile-first volunteer scheduling app for Temple Beth El. Admins manage a service calendar and assign greeters/ushers. Volunteers sign up for slots. An AI assistant handles natural-language scheduling for both roles.

**Live:** https://tbe-greeter-scheduler.vercel.app  
**Repo:** https://github.com/JEisenstein1/tbe-greeter-scheduler  
**Stack:** Vite + React 19 + TypeScript + Vercel Functions + Neon Postgres + OpenRouter API

---

## Architecture

```
Browser (React SPA)
  ├── /api/services/*   → Vercel Node functions → Neon Postgres (services, slots, users, audit/email logs)
  ├── /api/auth/*       → Google OAuth → HMAC-signed session cookie (tbe_session)
  ├── /api/chat         → Vercel Edge Function → deterministic intent builders + OpenRouter (default: openai/gpt-5.5)
  └── /api/telemetry/*  → app + chat telemetry tables
```

The client keeps a local `services` state seeded from `src/data.ts` and replaces it with `/api/services` (database) on load. Mutations are optimistic: the client POSTs to the API and applies the same change locally; API failures fall back to demo mode, except **409 conflicts**, which surface a toast and re-sync from the server. When no `DATABASE_URL` is configured, everything runs against the in-memory fixture ("demo mode").

The seed fixture (`src/data.ts` + `api/_data.js`, kept in sync by hand) generates weekly Friday/Saturday Shabbat services **relative to today**, plus fixed 2026 High Holiday services, so a fresh deploy always has upcoming sign-up opportunities.

---

## Key files

| File | Purpose |
|---|---|
| `src/App.tsx` | Root component. State: `services`, `user`, `view`, modals, toasts. All mutation handlers defined here, call `/api/services/*`, and apply pure transforms from `appLogic.ts`. |
| `src/appLogic.ts` | Pure logic shared by app + tests: auth lookup, assignment finding, `applyAssignVolunteer`/`applyRemoveSignup`/`applyRequestCoverage`, AI action planning (`planAiAction`). Service ids compare loosely (`sameId`) because fixture ids were historically numeric while DB/AI ids are strings. |
| `src/data.ts` | Seed data: volunteer roster, admin list, synagogue config, `buildShabbatServices()` evergreen fixture. |
| `src/types.ts` | All TypeScript interfaces. |
| `src/views.tsx` | Page views. `AIView` owns the chat UI, sends history + telemetry sessionId. |
| `src/components.tsx` | Shared components: `Topbar`, `BotNav`, `AuthSheet`, `ServiceCard`, modals. |
| `src/styles.css` | All CSS, themed via CSS custom properties. |
| `api/chat.js` | Edge Function. Sanitizes + domain-gates input, derives role from the session cookie (never from the request body), redacts the services payload per role, tries deterministic intent builders first, then calls OpenRouter with tool definitions. Logs every turn to `ai_interaction_log`. |
| `api/_auth.js`, `api/_http.js` | Session cookie sign/verify (HMAC-SHA256 with `SESSION_SECRET`), `requireUser`/`requireAdmin` guards. |
| `api/_db.js` | Neon client, schema (`services`, `slots`, `users`, `email_delivery_log`, `audit_log`), migrate/seed helpers. |
| `api/_data.js` | JS mirror of the seed fixture for DB seeding and the no-DB fallback. |
| `api/services/*.js` | CRUD: `index` (GET list, seeds empty DB), `create`/`delete` (admin), `signup`, `remove`, `request-coverage` (owner or admin). Signup sends a real confirmation email with an ICS calendar invite via Resend or Gmail. |
| `api/auth/google/*` | Real Google OAuth (state cookie, code exchange, verified email required). Role comes from the `ADMIN_EMAILS` allowlist. |
| `api/telemetry/*`, `api/_telemetry.js` | App-event + chat-turn logging. |
| `server/index.ts` | Local Express dev server. Vite proxies `/api/*` here; `/api/chat` delegates to the canonical `api/chat.js` handler so local tests use production chat logic. Other `/api/*` routes are not served locally — the client falls back to demo mode. |

---

## Data model

```typescript
interface Service {
  id: number | string;    // DB/AI ids are strings; compare with sameId(), not ===
  dateISO: string;        // "2026-06-07"
  date: string;           // "Saturday, June 7"
  time: string;           // "9:30 AM"
  type: string;           // "Shabbat Morning"
  isHH: boolean;          // High Holiday flag
  slots: Slot[];
}

interface Slot {
  id: string;
  role: string;            // "Greeter", "Usher", …
  timeSlot: string | null; // HH window label or null
  volunteer: string | null;
  volunteerEmail: string | null;
  coverageRequested?: boolean;
}
```

Postgres mirrors this in `services` + `slots` tables (see `api/_db.js` for schema).

---

## Auth

- **Google sign-in (real)**: `/api/auth/google/start` → OAuth → `/api/auth/google/callback` sets an HttpOnly HMAC-signed `tbe_session` cookie (8h). Admin role = email in `ADMIN_EMAILS` env (default `jon.eisenstein@gmail.com`).
- **Password tab (mock)**: client-side lookup against `ADMINS`/`VOLUNTEERS` arrays; any password. Produces a client-only session (no cookie), so server APIs treat it as unauthenticated.
- **Guest**: name + email held in client state only.
- The server **never trusts client-claimed roles**: `/api/chat` and `/api/services/*` derive role from the session cookie.
- User state is not persisted across refreshes (`shouldRestorePersistedUser` returns false); the cookie session is restored via `/api/auth/me`.

---

## AI chat — how it works

`AIView` POSTs to `/api/chat` with `{ message, sessionId, history, role, user, services, volunteers }` (volunteers only when the client believes the user is admin; the server re-derives the real role anyway).

The Edge Function:
1. Sanitizes the message and rejects off-topic/unsafe input (allow/deny regex gates, confirmation/follow-up context awareness).
2. Blocks roster/contact-info requests for non-admins; redacts the services payload per role (guests see `FILLED` instead of names).
3. Tries **deterministic intent builders** first (admin assignment, removal, coverage, "my dates", guest guidance, Friday/Saturday bulk-pattern creation) — these return actions without calling the model.
4. Otherwise calls OpenRouter with role-filtered tool definitions and post-filters returned actions by explicit user intent and role.

Response: `{ text, actions }`. The client maps actions through `planAiAction` and applies them via App handlers.

**Tools:** `sign_me_up`, `request_coverage`, `remove_signup` (volunteer+admin), `assign_volunteer`, `create_service` (admin only). Guests get no tools.

---

## Theme system

Six CSS variables define the palette (`--c-navy`, `--c-navy-soft`, `--c-gold`, `--c-gold-soft`, `--c-cream`, `--c-paper`), applied in `App.tsx`. The Tweaks panel (activated by `window.postMessage({ type: '__activate_edit_mode' })`) switches palette, density, heading font, and default views.

---

## Development commands

```bash
npm run dev      # Vite (port 5173) + Express (port 3001) concurrently
npm run build    # TypeScript + Vite production build
npx tsc --noEmit # Type-check only
npm test         # Vitest suite (src/__tests__/)
npm run e2e:prod # Production functional E2E (hits the live deployment — needs env/secrets)
```

## Environment variables

| Variable | Description |
|---|---|
| `OPENROUTER_API_KEY` | OpenRouter API key (required for chat) |
| `OPENROUTER_MODEL` | Model override; defaults to `openai/gpt-5.5` |
| `OPENROUTER_SITE_URL` / `OPENROUTER_APP_NAME` | OpenRouter attribution |
| `DATABASE_URL` (or `POSTGRES_URL`) | Neon Postgres; absent → demo/fixture mode |
| `SESSION_SECRET` | HMAC key for session cookies (required for real auth) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Google OAuth |
| `ADMIN_EMAILS` | Comma-separated admin allowlist (default `jon.eisenstein@gmail.com`) |
| `RESEND_API_KEY` + `EMAIL_FROM` | Confirmation email via Resend |
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` + `EMAIL_FROM` | Confirmation email via Gmail (fallback provider) |
| `PUBLIC_BASE_URL` | Overrides the derived base URL for OAuth redirects |

---

## Deployment

Push to `main` → Vercel auto-deploys. `api/` functions deploy alongside the static frontend.

---

## Known limitations / future work

- **Local dev serves only `/api/chat`** — other API routes 404 locally, so the frontend runs in demo mode against the fixture. Next step: mount the `api/*` handlers in `server/index.ts`.
- **Password/guest auth is still mock and client-side** — only Google sign-in creates a server session; password/guest users can't write through the authed APIs.
- **Volunteer/admin roster is hardcoded** in `src/data.ts`; the admin Volunteers/Admins views edit local state only and reset on refresh.
- **Bulk reminder email is preview-only** (`EmailView` simulates delivery); assignment confirmations do send for real.
- **High Holiday fixture dates are fixed for 2026**; weekly Shabbat fixture is evergreen.
- **Settings view is display-only** (edit buttons are decorative).

See `docs/fable5-audit-20260707.md` for the latest audit, prioritized issues, and deferred recommendations.

---

## Original design prototype

`project/` contains the original Claude Design HTML prototype that this app was built from. It's reference-only — don't edit it. The production code lives entirely in `src/` and `api/`.
