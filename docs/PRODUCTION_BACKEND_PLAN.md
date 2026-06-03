# Production Backend Plan

Goal: move TBE Greeter Scheduler from client-side prototype to real production app.

## Decisions

- **Auth:** direct Google OAuth/OIDC, not mock roster matching.
- **Database:** Vercel-standard Postgres. In Vercel this is typically Vercel Postgres / Neon using `POSTGRES_URL` / `DATABASE_URL` environment variables.
- **Email:** transactional email provider recommended. Resend or Postmark is better than a personal Gmail account for app delivery.
- **Calendar:** Google Calendar API after auth + DB are stable.
- **AI:** keep `/api/chat` domain-gated, but feed it server-side data and enforce server-side auth for actions.

## Email sender recommendation

Using Jon's personal Gmail account as the app sender is technically possible through Gmail API OAuth, but it is not ideal for production because:

- OAuth refresh/token consent is fragile for unattended serverless email delivery.
- Gmail sending limits and anti-abuse rules are designed for personal mail, not transactional app mail.
- Deliverability, bounce tracking, suppression lists, and audit logs are weak.
- It exposes a personal mailbox credential path to app operations.

Recommended sender:

- `greeters@<synagogue-domain>` or `no-reply@<synagogue-domain>` through Resend/Postmark/SendGrid.
- If no domain is available yet, use a verified Resend sandbox/domain while testing.

The code should use an `EmailSender` adapter so Gmail API can be added later if Jon explicitly wants it.

## Required environment variables

### Google OAuth

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` — production: `https://tbe-greeter-scheduler.vercel.app/api/auth/google/callback`
- `SESSION_SECRET` — random 32+ byte secret for signed/encrypted session cookies
- `ADMIN_EMAILS` — comma-separated allowlist, initially `jon.eisenstein@gmail.com`

Google Cloud setup:

1. Create/select Google Cloud project.
2. Configure OAuth consent screen.
3. Create Web Application OAuth client.
4. Authorized JavaScript origin: `https://tbe-greeter-scheduler.vercel.app`.
5. Authorized redirect URI: `https://tbe-greeter-scheduler.vercel.app/api/auth/google/callback`.
6. For local dev: add `http://localhost:5173` and `http://localhost:3001/api/auth/google/callback`.

### Vercel Postgres / Neon

- `POSTGRES_URL` or `DATABASE_URL`
- Optional pooled/non-pooled variants created by Vercel/Neon.

### Email

Recommended Resend:

- `RESEND_API_KEY`
- `EMAIL_FROM` — e.g. `Temple Beth El Greeters <greeters@example.org>`

Alternative Gmail API sender:

- Google OAuth credentials with Gmail send scope
- refresh token stored securely
- sender mailbox authorized for app use

## Phase plan

### Phase 1 — Backend foundation

- Add schema contract and idempotent SQL migration.
- Add repository/service-layer functions for services, slots, assignments, users, and email logs.
- Add tests for schema SQL, auth mapping, role checks, and email adapter behavior.

### Phase 2 — Direct Google OAuth

- Add `/api/auth/google/start`, `/api/auth/google/callback`, `/api/auth/me`, `/api/auth/logout`.
- Verify Google ID token/userinfo server-side.
- Create/update user record in DB.
- Determine role from `ADMIN_EMAILS` and/or DB role.
- Store secure HTTP-only session cookie.
- Remove mock Google/password UI from production path.

### Phase 3 — Persistent scheduling APIs

- Add `/api/services`, `/api/slots/:id/signup`, `/api/slots/:id/coverage`, admin create/edit/delete endpoints.
- Enforce authorization server-side.
- Seed current `INITIAL_SERVICES` into DB via migration/seed script.
- Wire React state to API load/mutations.

### Phase 4 — Real email

- Add provider-backed `sendEmail()` adapter.
- Send confirmation on signup.
- Log every delivery attempt in DB.
- Surface failures in admin UI.

### Phase 5 — Calendar integration

- Add Google Calendar API adapter.
- Create/update calendar events and attendee invitations.
- Log calendar event IDs against services/assignments.

### Phase 6 — E2E and production hardening

- Add Playwright tests for signed-out, volunteer, admin, AI, and email-log flows.
- Add preview/prod smoke scripts.
- Add observability and audit log views.

## Blocking credentials for full end-to-end completion

I can scaffold and test the code now, but live end-to-end deployment requires:

1. Google OAuth web client ID/secret created for this production domain.
2. Vercel Postgres/Neon database provisioned and env vars attached to the Vercel project.
3. Email provider account/API key and verified sender/domain.
4. A fresh valid Vercel token or Vercel dashboard access if CLI deployment/env var setup is needed.
