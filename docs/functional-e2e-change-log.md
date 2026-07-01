# Functional E2E Change Log

This file records snapshots, test-driven changes, and rollback notes made during comprehensive functional testing.

## 2026-06-30 — Baseline snapshot

- Snapshot tag: `pre-functional-e2e-20260630T043343Z`
- Snapshot branch: `pre-functional-e2e-20260630T043343Z-branch`
- HEAD: `2040ddf021b021dfc4a222071a7878c15c86fb5c`
- Bundle: `/root/staging/tbe-greeter-snapshots/pre-functional-e2e-20260630T043343Z.bundle`
- Reason: Baseline before adding comprehensive functional E2E scripts and any test-driven fixes.
- Rollback: `git reset --hard pre-functional-e2e-20260630T043343Z` plus Vercel rollback if production deploy changes need reverting.

## 2026-06-30 — Production E2E script correction

- Pre-fix snapshot: `pre-fix-signup-readback-20260630T043920Z`
- Finding: initial E2E expected the posted email to fill a slot during signed-in volunteer signup.
- Actual/correct behavior: signed-in volunteer signup uses the signed session user email, ignoring posted name/email. This prevents impersonation.
- Change: updated `scripts/e2e/production-functional-e2e.mjs` to assert `TBE_VOLUNTEER_EMAIL` for signed-in volunteer signup and use the posted email only as an ignored spoof value.
- App code changed: none.
- Rollback: revert the script change to restore prior assertion; no production code rollback needed.

## 2026-06-30 — Calendar invite attachment fix

- Pre-fix snapshot: `pre-fix-calendar-invite-20260630T102205Z`
- Finding: UI/email preview promised a calendar invite, but production Gmail sender generated plain-text-only messages.
- Change: `api/services/signup.js` now builds an iCalendar `METHOD:REQUEST` `.ics` invite and attaches it to Gmail raw MIME and Resend payloads. Signup email copy now says a calendar invite is attached.
- Tests: added `src/__tests__/calendar-invite-email.test.ts`; updated preview copy expectation.
- Rollback: reset to `pre-fix-calendar-invite-20260630T102205Z` or revert the calendar-invite commit.

## 2026-06-30 — Production E2E existing bulk-pattern state

- Pre-fix snapshot: `pre-fix-e2e-bulk-existing-pattern-20260630T102840Z`
- Finding: production now already has Friday/Saturday services extended through year-end, so the bulk pattern AI endpoint correctly returns "already appears to extend" instead of a preview.
- Change: updated `scripts/e2e/production-functional-e2e.mjs` to accept both safe outcomes: preview-with-zero-actions, or already-complete-with-zero-actions.
- App code changed: none.
- Rollback: revert the script change only.

## 2026-06-30 — Email subject MIME encoding fix

- Pre-fix snapshot: `pre-fix-email-subject-encoding-20260630T105651Z`
- Finding: Gmail stored the subject as `You're scheduled Ã¢Â€Â” ...`; the em dash was sent as raw UTF-8 in a MIME header instead of RFC 2047 encoded-word format.
- Change: `api/services/signup.js` now RFC 2047/base64-encodes non-ASCII Subject headers in both plain and multipart Gmail MIME messages.
- Tests: extended `src/__tests__/calendar-invite-email.test.ts` to assert encoded non-ASCII subject headers.
- Rollback: reset to `pre-fix-email-subject-encoding-20260630T105651Z` or revert the subject-encoding commit.

## 2026-06-30 — AI scheduling intent refinement

- Pre-fix snapshot: `pre-fix-ai-intent-refinement-20260630T113133Z`
- Finding: prompts like `Can you add Debbie for Friday` and `Can you remove me from Friday` were refused as off-topic because the scope classifier required more explicit scheduling keywords.
- Change: broadened scheduling intent patterns for add/assign/remove language, added admin-only `assign_volunteer`, added `remove_signup`, and added deterministic handling for unique volunteer first-name matches plus ambiguity clarification.
- Tests: extended `src/__tests__/chat-handler-behavior.test.ts` for unique Debbie assignment, multiple-Debbie clarification, and remove-me action.
- Rollback: reset to `pre-fix-ai-intent-refinement-20260630T113133Z` or revert the AI intent refinement commit.

## 2026-06-30 — AI roster/follow-up continuity fix

- Pre-debug snapshot: `pre-debug-ai-followup-20260630T155822Z`
- Finding from `ai_interaction_log`: real prompts `schedule Debbie for next friday` and `Can you look up Debbie and schedule her for next friday?` fell through to the model, which said it had no roster lookup; follow-up `How about next friday` was blocked as off-topic.
- Root cause: deterministic assignment only recognized `add/assign/put/sign up`, not `schedule`; short date-only follow-ups were classified without prior-turn scheduling context; `next Friday` selection did not explicitly choose the second matching Friday service.
- Change: added `schedule` as an admin assignment verb, added scheduling-context follow-up classification, and added service picking that distinguishes `this` vs `next` matching service.
- Tests: extended `src/__tests__/chat-handler-behavior.test.ts` with real-log regressions for `schedule Debbie for next friday` and `How about next Friday`.
- Rollback: reset to `pre-debug-ai-followup-20260630T155822Z` or revert the roster/follow-up continuity commit.

## 2026-07-01 — AI persona assignment scenario testbed

- Pre-fix baseline: existing HEAD `c03b45e` plus working tree changes in this session.
- Finding: admin/volunteer/logged-out phrasing needed an explicit scenario matrix; local `npm run dev` browser testing proxied `/api/chat` to a stale Express implementation instead of the canonical Vercel chat handler.
- Change: added `docs/ai-persona-assignment-scenarios.md`, `src/__tests__/ai-persona-assignment-scenarios.test.ts`, `src/__tests__/ai-persona-remediation.test.ts`, and `src/__tests__/ai-frontend-action-execution.test.ts` covering admin assignment synonyms/negative cases, admin named removal, volunteer coverage/cancellation language, volunteer/guest permission boundaries, LLM role filtering, and frontend action execution.
- Fixes: broadened scheduling scope for “can’t make / need a sub / cancel my signup” language; added deterministic volunteer coverage handling; made admin named removal target the named volunteer, not the admin; added missing-service/full-service/ambiguous-volunteer clarification behavior; tightened “my schedule” matching so roster requests are not swallowed by personal-schedule logic; reordered deterministic action handlers so action intents win over informational responses.
- Frontend path: extracted pure AI action planning/slot mutation helpers in `src/appLogic.ts` and wired `AIView`/`App.tsx` through them, so frontend execution uses the same behavior covered by tests for `assign_volunteer`, `sign_me_up`, `remove_signup`, `request_coverage`, no-op/unknown actions, and spoofed user data.
- Local browser parity: simplified `server/index.ts` so Vite’s local `/api/chat` proxy delegates to `api/chat.js`, eliminating drift between deterministic and LLM paths.
- Verification: `npm test` → 17 files / 130 tests passing; `npm run build` → TypeScript + Vite production build passing; local browser guest chat privacy check returned the expected no-action refusal.
- Rollback: revert `api/chat.js`, `server/index.ts`, `src/App.tsx`, `src/views.tsx`, `src/appLogic.ts`, `src/__tests__/ai-persona-assignment-scenarios.test.ts`, `src/__tests__/ai-persona-remediation.test.ts`, `src/__tests__/ai-frontend-action-execution.test.ts`, `docs/ai-persona-assignment-scenarios.md`, and related test/doc updates.

## Claude Code consultation attempt

- `claude auth status --text` showed Claude Max login for Jon.
- `claude -p` planning call returned API `401 Invalid authentication credentials`.
- No files were changed by Claude Code. Hermes proceeded with documented plan in `docs/functional-e2e-test-plan.md`.
