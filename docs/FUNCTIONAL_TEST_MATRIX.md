# Temple Beth El Greeter Scheduler — Functional Test Matrix

This matrix defines the product-level acceptance tests for each major function.
Each row answers: **what is the function, who is using it, what action do they take, and what should they expect to see?**

## Test profiles

- **Admin:** Jon Eisenstein — `jon.eisenstein@gmail.com`, role `admin`.
- **Roster volunteer:** Emma Adler — `emma.p.adler@gmail.com`, role `volunteer`.
- **Guest volunteer:** Non-roster visitor with name/email entered manually.
- **Signed-out kiosk user:** No persisted identity in browser storage.

## Auth and session behavior

- Function: public app load
  - Profile: signed-out kiosk user
  - Action: open/reload app after a previous admin used the browser
  - Expected result: app shows `Sign in`; no admin access is restored; `localStorage.tbe.user` is empty.
  - Current status: implemented/tested.

- Function: password sign-in
  - Profile: admin / roster volunteer
  - Action: enter roster email and any password
  - Expected result: recognized as matching roster/admin record, but treated as prototype auth until real password/OAuth backend exists.
  - Current status: demo-only; tested as not provider-verified.

- Function: Google sign-in
  - Profile: admin / roster volunteer / unknown volunteer
  - Action: click `Continue with Google (demo)`
  - Expected result: UI explicitly says this is demo-only and does not validate Google OAuth.
  - Current status: demo-only; real OAuth outstanding.

## Calendar behavior

- Function: open Calendar
  - Profile: signed-out user / volunteer / admin
  - Action: tap Calendar nav
  - Expected result: Calendar is visible to all profiles.
  - Admin expectation: can manage events/assignments.
  - Volunteer expectation: can find open slots and sign up; cannot edit/delete events.
  - Guest expectation: prompted to sign in before signup.
  - Current status: implemented/tested.

- Function: calendar day action
  - Profile: volunteer
  - Action: click/tap date with open slots
  - Expected result: sees signup action for open slot.
  - Current status: implemented/tested.

- Function: calendar day action
  - Profile: admin
  - Action: click/tap date with service
  - Expected result: sees manage/edit action.
  - Current status: implemented/tested.

- Function: admin event creation/edit/delete
  - Profile: admin
  - Action: create, modify, or delete a service
  - Expected result: service list/calendar updates; non-admins never see destructive controls.
  - Current status: client-only; needs persistence backend for real production durability.

## Signup and volunteer assignment behavior

- Function: volunteer signup
  - Profile: roster volunteer / guest volunteer
  - Action: choose an open slot
  - Expected result: slot shows volunteer name/email and is no longer open.
  - Current status: client-only/in-memory; tests cover mutation logic indirectly via app logic and browser smoke.
  - Outstanding: persistence backend required.

- Function: self-remove/request coverage
  - Profile: assigned volunteer
  - Action: request coverage or remove themselves
  - Expected result: coverage flag is set or slot is reopened.
  - Current status: client-only/in-memory; needs expanded executable tests and backend persistence.

- Function: admin assignment/removal
  - Profile: admin
  - Action: assign/remove volunteer from slot
  - Expected result: slot owner changes immediately and dashboard counts update.
  - Current status: client-only/in-memory; needs backend persistence.

## My Dates behavior

- Function: My Dates for signed-in user
  - Profile: roster volunteer/admin with existing assignments
  - Action: open My Dates
  - Expected result: future assigned services are listed, matched by email first and exact name second.
  - Current status: implemented/tested.

- Function: My Dates guest lookup
  - Profile: signed-out/guest
  - Action: search by name or email
  - Expected result: matching future assignments display case-insensitively.
  - Current status: implemented/tested.

## Email behavior

- Function: signup confirmation email
  - Profile: volunteer signing up
  - Action: confirm signup
  - Expected result: a real email should be sent to the volunteer with service/date/time/role.
  - Current status: only confirmation payload is prepared; no email provider connected.
  - Outstanding: choose/configure email provider and sender domain.

- Function: admin coverage/reminder email
  - Profile: admin
  - Action: send reminder/coverage email
  - Expected result: real email sent; status/result shown; failures visible.
  - Current status: not real; outstanding.

## AI assistant behavior

- Function: domain guardrails
  - Profile: any
  - Action: ask off-topic/general knowledge question
  - Expected result: assistant refuses and stays within TBE greeter scheduling.
  - Current status: tested.

- Function: volunteer self-schedule lookup
  - Profile: assigned volunteer
  - Action: ask `what dates am I signed up for?`
  - Expected result: assistant lists user’s own scheduled services and does not refuse.
  - Current status: implemented/tested locally and in production.

- Function: volunteer signup by AI action
  - Profile: volunteer
  - Action: ask AI to sign them up for a specific open service
  - Expected result: tool action signs them up; UI reflects updated slot.
  - Current status: client-only; needs expanded e2e test and persistence backend.

- Function: admin service creation by AI action
  - Profile: admin
  - Action: ask AI to create a service
  - Expected result: service is created only for admin; volunteer cannot create services.
  - Current status: client-only; needs expanded e2e test and persistence backend.

## Real-production requirements not yet met

The app currently has a working front-end and AI proxy, but the following are required to make it real rather than prototype/demo:

1. Real authentication: Google OAuth/OIDC or Clerk/Auth0/NextAuth.
2. Persistent database: services, slots, volunteers, assignments, audit log.
3. Email provider: Resend, SendGrid, Postmark, Gmail API, or Microsoft Graph.
4. Calendar integration: Google Calendar service account/OAuth, event creation, invite delivery.
5. Admin authorization rules enforced server-side, not only in React.
6. Production test accounts for admin and volunteer flows.
7. E2E test runner, preferably Playwright, running against preview/prod with seeded test data.
8. Observability: email/API failure logs visible to admin.
