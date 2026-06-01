# CLAUDE.md — TBE Greeter Scheduler

## Project overview

Mobile-first volunteer scheduling app for Temple Beth El. Admins manage a service calendar and assign greeters/ushers. Volunteers sign up for slots. An AI assistant (Claude) handles natural-language scheduling for both roles.

**Live:** https://tbe-greeter-scheduler.vercel.app  
**Repo:** https://github.com/JEisenstein1/tbe-greeter-scheduler  
**Stack:** Vite + React 19 + TypeScript + Vercel Edge Functions + Anthropic API

---

## Architecture

```
Browser (React SPA)
  └── /api/chat  →  Vercel Edge Function  →  Anthropic API (default: claude-sonnet-4-6; override with ANTHROPIC_MODEL)
```

All state is **in-memory** (resets on refresh). There is no database. The Vercel function is a stateless proxy — it receives the full services array on every request and sends it as context to Claude.

---

## Key files

| File | Purpose |
|---|---|
| `src/App.tsx` | Root component. All state lives here: `services`, `user`, `view`, modals, toasts. All mutation handlers defined here and passed down as props. |
| `src/data.ts` | **Edit this to change seed data.** Volunteer list, admin list, synagogue config, initial services. Jon Eisenstein is the only admin. |
| `src/types.ts` | All TypeScript interfaces. `Service`, `Slot`, `User`, `TweakValues`, etc. |
| `src/views.tsx` | All page views. `AIView` owns the chat UI and API fetch logic. |
| `src/components.tsx` | Shared components: `Topbar`, `BotNav`, `AuthSheet`, `ServiceCard`, modals. |
| `src/styles.css` | All CSS. Uses CSS custom properties (`--c-navy`, `--c-gold`, etc.) set by the theme system. |
| `api/chat.js` | Vercel Edge Function. Builds system prompt from request context, calls Anthropic API, returns `{ text, actions }` JSON. |
| `server/index.ts` | Local Express dev server. Mirrors `api/chat.js` protocol/schema/model configuration for local `npm run dev`. |

---

## Data model

```typescript
interface Service {
  id: number | string;
  dateISO: string;        // "2026-06-07"
  date: string;           // "Saturday, June 7"
  time: string;           // "9:30 AM"
  type: string;           // "Shabbat Morning"
  isHH: boolean;          // High Holiday flag
  slots: Slot[];
}

interface Slot {
  id: string;             // "s1", "s2", ...
  role: string;           // "Greeter", "Usher", "Parking Attendant"
  timeSlot: string | null; // "9:30 AM" or null
  volunteer: string | null;
  volunteerEmail: string | null;
  coverageRequested?: boolean;
}

interface User {
  name: string;
  email: string;
  role: 'admin' | 'volunteer';
  source: 'google' | 'password' | 'manual';
}
```

---

## Auth system (mock)

Auth is entirely client-side. No real OAuth or passwords.

- **Google button**: checks typed email against `ADMINS` / `VOLUNTEERS` arrays → signs in as that person, or creates a new volunteer from the email if not found
- **Password**: same email lookup, any password accepted
- **Guest**: name + email → new volunteer session
- **Admin detection**: email must be in `ADMINS` array in `src/data.ts`
- **Persistence**: `localStorage` stores the user object across refreshes

To add an admin, add them to `ADMINS` in `src/data.ts`.

---

## AI chat — how it works

`AIView` (`src/views.tsx`) sends a POST to `/api/chat` with:
```json
{
  "message": "user's message",
  "role": "admin | volunteer",
  "user": { "name": "...", "email": "..." },
  "services": [ ...full services array... ]
}
```

The Edge Function builds a system prompt that includes the full calendar, the user's current slots, and available open slots. It calls Anthropic non-streaming and returns:
```json
{
  "text": "Claude's response text",
  "actions": [
    { "action": "sign_me_up", "svcId": "1", "slotId": "s3" },
    { "action": "create_service", ...serviceObject },
    { "action": "request_coverage", "svcId": "1", "slotId": "s3" }
  ]
}
```

The client processes actions — calling `onAIVolunteerSignup`, `onAICreateService`, or `onAIRequestCoverage` on `App.tsx` — which mutate the `services` state.

**Tools available:**
- `sign_me_up(svcId, slotId)` — volunteer only
- `request_coverage(svcId, slotId)` — volunteer only  
- `create_service(id, dateISO, date, time, type, isHH, slots[])` — admin only

---

## Theme system

Four CSS variables define the palette (`--c-navy`, `--c-navy-soft`, `--c-gold`, `--c-gold-soft`, `--c-cream`, `--c-paper`). Applied via `useEffect` in `App.tsx` whenever tweaks change. The Tweaks panel (activated by `window.postMessage({ type: '__activate_edit_mode' })`) lets you switch palette, density, heading font, and default views.

---

## Development commands

```bash
npm run dev      # Vite (port 5173) + Express (port 3001) concurrently
npm run build    # TypeScript + Vite production build
npx tsc --noEmit # Type-check only
```

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | `.env` (local), Vercel settings (prod) | Anthropic API key |
| `ANTHROPIC_MODEL` | optional `.env` / Vercel setting | Claude model override; defaults to `claude-sonnet-4-6` |

---

## Deployment

Push to `main` → Vercel auto-deploys (connected to GitHub). The `api/chat.js` Edge Function deploys automatically alongside the static frontend.

`vercel.json`:
```json
{ "buildCommand": "vite build", "outputDirectory": "dist" }
```

---

## Known limitations / future work

- **No persistence** — all data resets on refresh. Next step: add a database (Vercel Postgres, Supabase, or similar) and persist `services` server-side.
- **No real auth** — mock Google sign-in. Next step: NextAuth.js or Clerk with real Google OAuth.
- **No real email** — confirmation emails are UI-only. Next step: Resend or SendGrid integration.
- **No real Google Calendar** — invite buttons are decorative. Next step: Google Calendar API.
- **Single-turn AI** — chat history is not sent to the API, so Claude has no memory of earlier messages in the conversation.
- **In-memory volunteer list** — the 43 volunteers are hardcoded. Next step: admin UI to add/remove/edit volunteers.
- **Service slots** — currently only one slot per service for Shabbat. The HH template has multiple windows. The EventEditModal supports custom slot creation.

---

## Original design prototype

`project/` contains the original Claude Design HTML prototype that this app was built from. It's reference-only — don't edit it. The production code lives entirely in `src/` and `api/`.
