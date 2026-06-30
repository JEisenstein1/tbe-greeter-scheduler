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

## Claude Code consultation attempt

- `claude auth status --text` showed Claude Max login for Jon.
- `claude -p` planning call returned API `401 Invalid authentication credentials`.
- No files were changed by Claude Code. Hermes proceeded with documented plan in `docs/functional-e2e-test-plan.md`.
