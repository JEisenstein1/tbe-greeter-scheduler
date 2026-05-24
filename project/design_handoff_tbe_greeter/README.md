# Handoff: Temple Beth El Greeter Scheduler

## Overview

A mobile-first web app for scheduling, managing, and communicating with volunteer greeters and ushers at a synagogue. The app covers two audiences:

- **Admins** (rabbi, office staff, board members) — manage the calendar, send communications, assign volunteers, manage profiles, handle coverage requests.
- **Volunteers** — sign up for open slots, look up their dates, request a substitute, manage their own commitments. Also have access to an AI assistant that handles their schedule conversationally.

The product spec lives in the project root or has been shared separately. This bundle is the **design layer** — visual + interaction reference for the implementation team.

## About the Design Files

The files in this bundle are **design references created in HTML/React (via inline Babel)**. They are *not* production code to ship directly:

- They use Babel-in-the-browser for fast iteration; production should be a real React build (Vite / Next.js).
- State lives in `useState` only and resets on hard reload (except auth, which uses `localStorage`). Production needs Supabase or equivalent persistence keyed to authenticated users.
- The AI Scheduler uses **scripted responses + a small intent matcher** for the demo. Production should route through `/api/claude.js` (Vercel serverless function) to keep the Anthropic API key server-side.

**The task is to recreate these designs in the production codebase's environment** (React + Tailwind, Next.js, etc.) — using the team's established patterns, design tokens, and component library if one exists.

## Fidelity

**High-fidelity.** Colors, typography, spacing, copy, animations, and interactions are all final. Match this design pixel-faithfully. Where the codebase already has a button or input component that visually matches, prefer it over hand-rolled markup; where it doesn't, build new ones that match these exact specs.

## Navigation Model

Bottom tab bar with five tabs (mobile-first; on tablet+ keep the same five-tab pattern but anchor app shell at `max-width: 760px`):

1. **AI** — assistant (role-aware: admin mode vs volunteer mode)
2. **Calendar** — admin's primary scheduling view (List + Grid)
3. **Admin** — hub linking to Coverage Requests, Volunteers, Admins, Email Templates, Settings
4. **Sign Up** — volunteer-facing self-serve sign-up
5. **My Dates** — volunteer self-service lookup

Topbar surfaces the synagogue brand on the left and a context-sensitive auth control on the right:
- On admin views (AI / Calendar / Admin) → "Admin" pill (in production: only when the signed-in user has `role: "admin"`)
- On volunteer views, when signed in → user avatar + first-name dropdown (account menu)
- On volunteer views, when not signed in → "Sign in" button

## Screens / Views

### 1. AI Scheduler (`AIView`)

**Purpose:** Plain-English assistant. Behavior switches by role.

**Layout:**
- Hero card at top (navy gradient, gold accent stars). Eyebrow + serif h2 + descriptive paragraph.
- Chat history below: alternating user (right, navy) and assistant (left, white-card-bordered) bubbles. Each AI bubble has a small gold "Assistant" label.
- Sometimes an AI bubble includes an **Action Card** — a cream-bg card showing structured result data (e.g. "Added · Kabbalat Shabbat" with date / time / slots rows).
- "Try one" divider + chip row (pill buttons, gold sparkle prefix).
- Sticky chat input bar at bottom (textarea + navy circular send button).

**Admin chip set:**
- "Add a Friday Shabbat April 24"
- "Set up Rosh Hashanah Oct 1 9am–12pm"
- "Add Purim party Mar 13, 3 greeters"
- "Add Yom Kippur Oct 10 9am–1pm"

Each admin chip yields a scripted response that confirms the addition and shows an Action Card with the parsed structure.

**Volunteer chip set (intent-matched at runtime against live state):**
- "Sign me up for this Friday" → finds next Friday Kabbalat Shabbat with an open Greeter slot, signs the user in, sends confirmation
- "Send me my upcoming dates" → lists all assignments for the signed-in user, "sent to your email" line in the action card
- "I can't make my next service" → finds the user's next assignment, marks `coverageRequested: true`, simulates dispatch to distribution list
- "What's my next service?" → look-up only, no mutation

**Streaming animation:** When the AI replies, the bubble streams characters at ~10–18ms per character with a blinking gold cursor (`@keyframes blink`, 1s, 50% opacity transition).

**Implementation note for production:** Replace the scripted matcher with real Anthropic API calls. Suggested system prompt should expose tools for: `searchServices`, `signUpForSlot`, `requestCoverage`, `listMyDates`, `addService`, `removeService`. The agent should always ask the admin to confirm assumed slot structure before adding events.

### 2. Calendar (`CalendarView`)

**Purpose:** Admin's primary scheduling surface.

**Layout:**
- Page head (eyebrow "Coverage" + serif h1 "The Calendar" + paragraph).
- Stats row: two equal-width cards — "Slots Filled" (green numeric) and "Slots Open" (red numeric).
- Toolbar row: services-count pill on left + List/Grid segmented control on right.
- Body — either:
  - **List mode** — grid of `ServiceCard`s, gap 12px.
  - **Grid mode** — month calendar (see below).
- Floating **+ New event** FAB at bottom-right (above the bot nav, navy pill with gold "+" disc).

**Grid mode:**
- Legend row above grid: three swatches (Fully Staffed / Partially Open / Unfilled).
- Month header with prev/next chevron buttons.
- 7-column day grid. Cells are `aspect-ratio: 1 / 1.2`. Each filled cell shows:
  - Day number (top-left)
  - Up to 2 service-type pills (color-coded by status), with `+N` overflow
  - Up to 3 volunteer-initial discs (navy circle, white text, 16×16, 2-letter initials uppercase), with `+N` overflow
- Click any cell to expand a **day detail panel** below the grid:
  - If services exist → render each as a ServiceCard with admin Edit/Delete actions + an "Add another event on this day" button
  - If no services → "No events scheduled for this day yet" empty state with a "Create event on this day" CTA

**ServiceCard component (also used in Sign Up + day-panel + List mode):**
- Header row: date badge (52px wide, navy bg, gold weekday text, serif day number, uppercase month) + title + meta + status pill.
- Title in Playfair Display 18px; meta is muted 12.5px with "·" separators.
- Optional gold-outlined "HH" tag for High Holiday services (toggleable via tweaks).
- Status pill: green "Fully Staffed" / amber "N Open" / red "N Open".
- Slot rows below header:
  - Dot (green for filled, gold/translucent for open) + role label + volunteer name (or italic "Open").
  - Admin mode: filled slots show "Remove"; open slots show "Assign" (primary navy).
  - Volunteer mode: open slots show "Add" (disabled until name+email present); own slots show "Need sub" + "Remove" and display "You" instead of the volunteer's name.
- High Holiday services group slots by 30-min window with a gold uppercase section label and a fading divider line.
- Admin mode footer: dashed-top "Event" row with "Edit" and "Delete" buttons.

### 3. Admin Hub (`AdminHubView`)

**Purpose:** Entry point for all admin sub-screens.

**Layout:**
- Page head: "Admin" eyebrow + "Admin Hub" h1 + count of open slots in description.
- 2-column tile grid (single column on narrow viewports). Each tile:
  - Top-left: 34px gold-on-cream circular icon
  - Title (Playfair 18px navy)
  - Description (muted 12.5px)
  - Optional red badge in top-right corner (used for Coverage Requests count)

**Tiles:**
1. Coverage Requests (with red badge if any pending)
2. Volunteers
3. Admins
4. Email Templates
5. Settings

Tapping a tile sets `adminSub` state and replaces the hub with the corresponding sub-view. Sub-views have a small circular back chevron button (`back-btn`) that returns to the hub.

### 4. Volunteers (`VolunteersView`)

**Purpose:** CRUD on the volunteer roster.

**Layout:**
- Back-button row + page-head ("Admin" eyebrow + h1).
- Description paragraph.
- Single card "people list" containing one row per volunteer:
  - Avatar (navy disc, white initials, 34×34). Inactive volunteers have a cream/muted variant.
  - Name (medium 14px) + optional "Inactive" chip
  - Email (muted 12px)
  - Meta line: "Joined Mar 2023 · 27 services served"
  - Actions: "Deactivate" / "Reactivate" pill + "Remove" danger pill
- "Add volunteer" button below the list expands an inline form (name + email), with primary action and cancel.

### 5. Admins (`AdminsView`)

**Purpose:** Manage who has admin privileges.

**Layout:** Identical structure to Volunteers, with these differences:
- Each row shows a "Role" chip — "Owner" (navy filled) or "Admin" (cream outlined).
- Owners cannot be removed (no remove button rendered).
- Meta line indicates auth method: "Signs in with Google" / "Signs in with password" / "Pending — invite emailed".
- Add form CTA is "Send invite" (not "Add"), reflecting that new admins receive an email invitation.
- The "email becomes username" label is shown on the add form.

### 6. Coverage Requests (`CoverageView`)

**Purpose:** Inbox of volunteers who've requested a substitute.

**Layout:**
- Standard back + page-head.
- Description: notes that the volunteer list has been auto-notified.
- Empty state if no requests.
- List of "coverage cards" (white card with amber border + thick 3px amber left edge):
  - Date badge + name (Playfair 16px) + "needs a sub for {Role} at {Event}" body
  - Meta line: date · time · timeslot
  - Gold uppercase status note: "Distribution list notified"
  - Body row: "Assign substitute" (primary, opens Assign modal) + "Mark resolved" (clears flag without reassigning)

### 7. Email Templates (`EmailView`)

**Purpose:** Edit outbound message bodies; send weekly reminder.

**Layout:**
- Back + page-head ("Admin · Communication" + h1).
- Tabs: "Weekly Reminder" / "Confirmation" (cream-bg tab strip with active-tab gold underline).
- Info banner explaining who gets which template.
- Variable chip bar (monospace pills like `{volunteer_name}`) — clicking inserts at cursor position.
- Full-height monospace textarea.
- Preview / Save buttons.
- Preview renders the template with sample data, formatted as an inline email card.
- Weekly Reminder tab adds: "Send to All Volunteers" gold button + live send-status card that animates each volunteer through Queued → Sending → Sent.

### 8. Settings (`SettingsView`)

**Purpose:** Configure synagogue info, default times, reminders, integrations, calendar horizon.

**Layout:** Stacked card sections, each with a small gold uppercase section header. Inside each card, rows with a label/value pair on the left and an "Edit"/"Manage" pill on the right.

**Sections:**
- Synagogue: Name, Address
- Default service times: Friday Kabbalat Shabbat, Saturday Shabbat Morning
- Reminders: Weekly cadence ("Mondays at 8:00 AM"), Confirmation reminder ("48 hours before each service")
- Integrations: Gmail (green "Connected"), Google Calendar (green "Connected")
- Calendar horizon: scrollable pill bar with years (2026, 2027, 2028) and a dashed "+ Add 2029" pill at the end

### 9. Sign Up (`SignUpView`)

**Purpose:** Volunteer-facing service sign-up. No login required for guest mode.

**Layout:**
- Page head + "Volunteer" eyebrow.
- If signed in → "Welcome back" hero card (navy gradient, gold avatar, name, email, "Switch" pill).
- If not signed in → "Sign in to remember you" prompt + manual name/email form (underline-only inputs).
- Results pill: count of services with openings.
- List of ServiceCards in volunteer mode. Each open slot has an "Add" button (disabled when name/email missing); own filled slots have "Need sub" + "Remove".

**Confirmation modal** (`SignUpModal`): bottom-sheet on mobile, centered modal on tablet+. Shows full email preview before commit.

### 10. My Dates (`MyDatesView`)

**Purpose:** Volunteer self-service lookup.

**Layout:**
- If signed in → name auto-loaded; "Welcome back" hero card; assignments listed immediately.
- If not signed in → "Or enter your name" input + "Look Up" button.
- Each match shown as a card (date badge + service info + gold role/timeslot line).
- Signed-in users get a "Your commitment" row at bottom of each card with "Request coverage" + "Remove" actions.
- Action: "Download .ics" / "Email me my calendar" — *to be built per spec decision (volunteer-facing calendar download)*. Current bundle does not yet expose this; treat it as a TODO callout.

### 11. Authentication (`AuthSheet`)

**Purpose:** Sign-in modal.

**Layout:**
- Bottom-sheet on mobile, centered on tablet+.
- Header: "Welcome" eyebrow + "Sign in to Temple Beth El" h3.
- Tabs: "Sign in" / "Continue as guest".
- "Sign in" tab:
  - "Continue with Google" button (multi-color G logo)
  - "or" divider
  - Email + Password fields (border-rounded inputs)
  - Hint: any seeded volunteer email accepts any password in the demo
- "Continue as guest" tab:
  - Name + Email fields
- Sign-in success persists to `localStorage` under `tbe.user`.
- Account menu (anchored under user pill in topbar) shows: name + email + sign-in source line + "View my dates" / "Sign up for a service" / "Sign out" (danger).

### Modals

- **AssignModal** (admin) — date+role context row, volunteer dropdown, email preview that appears after selection, "Assign & Send Invite" primary button with simulated 1.1s spinner.
- **SignUpModal** (volunteer) — confirmation sheet showing email preview before send.
- **EventEditModal** (admin) — create or edit a service:
  - Event-type radio grid (4 cards: Kabbalat Shabbat / Shabbat Morning / High Holiday / Custom Event), each with name + description
  - Date (HTML date input) + Time (text)
  - Custom event: greeter count + usher count steppers (number inputs, 0–10)
  - High Holiday: time field accepts "9:00 AM – 12:00 PM" form; the modal parses this into 30-minute windows
  - Live "slot summary" pill showing the count and breakdown
  - On edit, existing volunteers are preserved where role + timeslot match
- **ConfirmDialog** — for delete confirmation; gold for normal, red for danger. Centered, smaller (380px max).

## Interactions & Behavior

- **Toasts** — bottom-rail, navy pill with gold check-disc, fade-up in 220ms, auto-dismiss after 3.2s.
- **Modal transitions** — backdrop fade-in (180ms), modal slide-up 24px cubic-bezier(0.32, 0.72, 0.18, 1) over 240ms.
- **AI streaming** — character-by-character at 10–18ms with blinking gold caret; action card appears after a 200ms post-text delay.
- **Card hover** — admin tiles raise to `--c-paper` with `--c-gold-soft` border (150ms).
- **Calendar grid cell** — hover shows cream bg; selected day shows cream bg with a 1.5px gold inner-border at inset 2px.
- **Send status animation** — each volunteer's row transitions Queued → Sending → Sent on a 360ms stagger; total time ~4s for 10 volunteers.

## State Management

In production, state should live in:
- **Persisted (Supabase):** services, slots, volunteer profiles, admin roster, email templates, synagogue settings, year horizon, coverage flags.
- **Session (cookie or JWT):** auth identity.
- **localStorage (volunteer convenience):** last entered name/email for guest mode; recent search queries.
- **In-memory (component state):** UI affordances (modals open, tab selection, current view, current admin sub-route, calendar month/year, calendar selected day).

Key state transitions:
- Assigning a volunteer → mutate slot.volunteer + slot.volunteerEmail → fire confirmation email via Gmail API → create GCal event with attendee.
- Volunteer requesting coverage → set slot.coverageRequested = true → fanout email to distribution list → leave the slot filled so admins can see who needs replacing.
- Admin "Mark resolved" → clear slot.coverageRequested without touching slot.volunteer.
- Volunteer self-remove → clear slot.volunteer + slot.volunteerEmail + slot.coverageRequested.
- Event delete → remove entire service from list + send cancellation invites for any assigned volunteers.

## Design Tokens

### Colors (default "Navy & Gold" palette)

```
--c-ink:        #1a1410   /* primary text */
--c-muted:      #6b6256   /* secondary text */
--c-line:       #e6dfd0   /* primary borders */
--c-line-soft:  #efe8d8   /* dashed dividers, secondary borders */
--c-paper:      #fbf8f1   /* warm off-white surface (topbar, modal bg) */
--c-cream:      #f6f1e7   /* app bg, hover states */
--c-card:       #ffffff   /* card surfaces */
--c-navy:       #16263f   /* primary accent */
--c-navy-soft:  #2a3c5a   /* hover on navy */
--c-gold:       #b8893a   /* secondary accent */
--c-gold-soft:  #d9b06a   /* gold light variant */
--c-green:      #4e7a4a   /* success */
--c-green-soft: #e8efe2
--c-amber:      #b67219   /* warning */
--c-amber-soft: #f5e6ce
--c-red:        #a8493a   /* destructive */
--c-red-soft:   #f1dcd4
```

Three alternate palettes are also defined (Olive & Stone, Burgundy & Cream, Indigo & Saffron) — see `PALETTES` in `app.jsx`. Production may expose these as theme presets or drop them; they're decorative.

### Typography

- **Body:** DM Sans (Google Fonts). 14–15px / 1.45 line-height for default. Adjust for density.
- **Headings:** Playfair Display (Google Fonts). Used for page H1s, card titles, modal H3s, badge day numbers, hero h2s.
- **Monospace:** ui-monospace stack — for template textareas and variable chips.

Typography is tweakable via a Heading-font select (Playfair Display / Cormorant Garamond / Fraunces / DM Serif Display) — production may pin one.

### Spacing & sizing scale

```
--r-sm: 6px      /* sm radius */
--r-md: 10px     /* default radius (inputs, buttons, banners) */
--r-lg: 14px     /* cards, hero, modal */
--r-pill: 999px  /* pills + buttons that need oval shape */

/* density (driven by data attribute on <html>) */
[data-density="compact"] { card pad 14, row pad 9, stack gap 12, body 14px }
[data-density="regular"] { card pad 18, row pad 12, stack gap 16, body 15px }
[data-density="cozy"]    { card pad 22, row pad 14, stack gap 20, body 16px }
```

### Shadows

Used sparingly:
- Toast: `0 6px 20px rgba(22, 38, 63, 0.25)`
- Modal: native via the `:slideup` keyframe (no explicit shadow)
- FAB: `0 6px 20px rgba(22, 38, 63, 0.28)`
- Topbar: `1px` bottom border instead of shadow
- App shell: `0 0 0 1px rgba(0,0,0,0.04)`

## Integrations (production)

| Integration | Purpose | Method |
|---|---|---|
| Gmail | Send confirmation + reminder emails | Gmail API via OAuth 2.0, server-side |
| Google Calendar | Send invites to volunteers | Google Calendar API, `sendUpdates: 'all'` |
| Anthropic | AI Scheduler + agent intents | `claude-sonnet-4-*` via Vercel serverless proxy, max 1000 tokens |
| Supabase | Services, slots, profiles, settings | Server-side |
| Vercel scheduled function | Weekly Monday 8am reminder send | Free-tier scheduled function; fallback to cron |

**Anthropic key must never reach the browser.** Proxy all calls through `/api/claude.js`.

## Role-Based Access (added per design review)

The app distinguishes three states. **Role lives on the user object** (`user.role: "admin" | "volunteer"`) and is the single source of truth for which surfaces render.

| State | Detection | Bot nav | Topbar | AI behavior |
|---|---|---|---|---|
| **Guest** | `user === null` | AI · Sign Up · My Dates | "Sign in" pill | Nudge to sign in or browse Sign Up |
| **Volunteer** | `user.role === "volunteer"` | AI · Sign Up · My Dates | Avatar + first name | "Your Scheduling Buddy" — sign me up / list dates / find sub |
| **Admin** | `user.role === "admin"` | AI · Calendar · Admin · Sign Up · My Dates | Avatar + first name + small "Admin" chip | "AI Scheduling Assistant" — add services, set up HH, etc. |

**On sign-in:** `AuthSheet` looks up the typed email against `ADMINS` first, then `VOLUNTEERS`. Match dictates role. Manual ("guest") sign-up always assigns `role: "volunteer"`.

**Route guard:** `App` redirects from `calendar` / `admin` views to `ai` whenever `user?.role !== "admin"`.

---

## Spec Decisions Applied

These were resolved in conversation with the product owner and should guide implementation:

- Admin auth: email/password or Google Auth. Username = registered email.
- Persistence: all state resumes on load, keyed to user profile.
- Weekly reminder: Vercel scheduled function (free tier), fallback to cron job.
- Cancellation flow: volunteer removes themselves; system notifies admin + distribution list with "[Name] is looking for someone to replace them at [event]."
- Confirmation reminder: 48 hours before event, separate email from initial confirmation.
- Self-sign-up: check profile by email first → offer Google Auth → otherwise create new guest record.
- Multi-year: host through 2028, starting May 2026. Easy to extend a year at horizon end.
- My Dates calendar download: .ics export + auto-attached to confirmation emails.
- AI assumptions: agent asks admin to confirm assumed slot structure when creating new events.

## Files Included

- `Greeter Scheduler.html` — entry point HTML, loads fonts + React + Babel + scripts
- `app.jsx` — App shell, view router, modal layer, tweaks panel wiring, auth state
- `components.jsx` — Topbar, BotNav, ServiceCard, DateBadge, modals (Assign / SignUp / Auth / EventEdit / Confirm), Icon component, Toast rail
- `views.jsx` — AIView, CalendarView (List + Grid), SignUpView, MyDatesView, EmailView, AdminHubView, VolunteersView, AdminsView, CoverageView, SettingsView
- `data.js` — Seed data: 17 services across May–Sep 2026, 10 volunteer profiles, 3 admins, synagogue defaults
- `styles.css` — All component styling, custom properties, palette swaps, density variants
- `tweaks-panel.jsx` — In-design tweaks panel (palette / density / heading font / HH accents / default views) — *demo affordance, drop in production*

## Notes for the Engineer

1. **The design canvas is mobile-first.** App shell uses `max-width: 480px` on mobile, `760px` on tablet+. Bottom nav fixed at viewport bottom. Reproduce these constraints in the production responsive system.
2. **Slot rules live in `data.js` and `EVENT_TYPES` in `components.jsx`.** Move these to a server-side validator: Friday Kabbalat → 1 Greeter; Saturday Morning → 1 Greeter; High Holiday → per-30min window: Greeter ×2, Usher ×2; Custom → admin-configurable.
3. **HH window parser** lives in `buildHHWindows()` inside `components.jsx`. It accepts "9:00 AM – 12:00 PM" (literal en-dash or hyphen) and returns array of "H:MM AM/PM – H:MM AM/PM" strings. Port this carefully or replace with a proper date-fns expression.
4. **`coverageRequested` flag** is a slot-level boolean. Admin's Coverage Requests view queries `slots.filter(s => s.coverageRequested)` across all services. In Supabase: index this column.
5. **The AI router** in `AIView` is a stand-in. For production, wrap Claude tool-calling and map tools to the same handlers (`onAssign`, `onRequestCoverage`, `onAIVolunteerSignup`, etc.).
6. **Calendar grid cell sizing** uses `aspect-ratio: 1 / 1.2`. The 3 visible initial discs + "+N" overflow + 2 service pills are tight on a small screen — verify in production at 360px viewport.
7. **The "Tweaks" panel is a design affordance** (it lets reviewers try palette/density/font live). Strip it from production; the controls are not part of the user-facing app.

## Suggested Build Order

1. **Foundation:** App shell, topbar, bot nav, theme tokens, ServiceCard, Date Badge.
2. **Auth:** AuthSheet + middleware. Get the role distinction right early — admin vs volunteer matters everywhere.
3. **Calendar (List + Grid):** Most complex single view. Wire to Supabase via SWR or React Query.
4. **Sign Up + My Dates:** Volunteer flows. These should feel polished — they're the public-facing surfaces.
5. **Admin Hub + sub-screens:** Volunteers / Admins / Coverage / Settings / Email Templates.
6. **AI Scheduler:** Wire to Claude via proxy. Implement the intent tools. Add confirmation step for admin creating events.
7. **Polish:** 48-hour reminder cron, .ics export, multi-year horizon extender, notifications.

## Open Product Questions

These remained open from spec section 15 and should be confirmed before final production launch:

1. Should HH slot groups in list view be collapsible?
2. Should the Assign modal show volunteer history (count of past services)?
3. Should the weekly reminder go only to volunteers without upcoming assignments, or to all?
4. How should duplicate self-sign-ups be handled (same person signs up twice)?
