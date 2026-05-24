# Calendar Design System

_Started 2026-05-24 15:57 UTC_

---

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "TBE Greeter"
Project is currently empty (no files)
Current date is now May 24, 2026
</system-info>

<default aesthetic>
If no references, art direction or design systems were provided, use this default professional modern, minimal aesthetic as a base. Declare your choice out loud so you stick to it. Guidance:
- Choose a type pairing from web-safe set or Google Fonts. Helvetica is a good choice. Avoid hard-to-read or overly stylized fonts. Use 1-3 fonts only.
- Foreground and background: choose a color tone (warm, cool, neutral, something in-between). Use subtly-toned whites and blacks; avoid saturations above 0.02 for whites.
- Accents: choose 0-2 additional accent colors using oklch. All accents should share same chroma and lightness; vary hue.
- NEVER write out an SVG yourself that's more complicated than a square, circle, diamond, etc.
- For imagery, never hand-draw SVGs; use subtly-striped SVG placeholders instead with monospace explainers for what should be dropped there (e.g. “product shot”)

CRITICAL: ignore default aesthetic entirely if given other aesthetic instructions like reference images, design systems or guidance, or if there are files in the project already.
</default aesthetic>

<pasted_text name="Pasted text (368 lines)">
# Temple Beth El Greeter Scheduler — Product Specification

**Congregation:** Temple Beth El  
**Document status:** Pre-deployment / in testing  
**Last updated:** May 2026  

---

## 1. Overview

A web application for scheduling, managing, and communicating with volunteer greeters and ushers at Congregation Temple Beth El. The system handles regular Shabbat services as well as High Holiday events, with automated email notifications and Google Calendar invitations sent through the synagogue's Gmail account.

### Design Principles
- **Voluntary only** — no forced rotation or fairness algorithm; volunteers self-select
- **Frictionless for volunteers** — no login required to sign up
- **Admin-first automation** — emails and calendar invites fire automatically on assignment
- **Natural language scheduling** — AI agent handles event/slot creation from plain English
- **Aesthetic** — Navy / gold / cream palette; Playfair Display serif headings; DM Sans body

---

## 2. User Roles

### Admin
- Full access to all views
- Can assign, remove, and manage volunteers
- Can edit, create, delete events (new)
- Configures email templates
- Uses the AI Scheduling Assistant to create events and slots
- Sends weekly reminder emails to all volunteers

### Volunteer
- Accesses the Sign Up view (no login)
- Enters name and email to sign up for open slots
- Receives confirmation email and Google Calendar invite on sign-up
- Can look up their own assignments via My Dates

---

## 3. Navigation

Two logical sections in the top navigation bar:

**Admin section:**
- 📅 Calendar
- Manual Scheduler (new)
- ✨ AI Scheduler
- ✉️ Email Templates

**Volunteer section:**
- Sign Up
- My Dates

---

## 4. Views

### 4.1 Calendar

The primary admin view for managing greeter assignments.

**Stats row** (top of page):
- Slots Filled (green accent)
- Slots Open (red accent)

**View toggle:** List | Grid (top-right)

#### List Mode
- Responsive grid: 1 column (mobile) → 2 columns (tablet) → 3 columns (desktop)
- Services sorted chronologically
- Each service rendered as a card (see Service Card spec, §5)

#### Grid Mode
- Full month calendar grid (7 columns, Sun–Sat)
- Month navigation with ‹ › arrows
- Each day cell shows colored pills for any services on that date:
  - **Green pill** — Fully Staffed
  - **Amber pill** — Partially Open
  - **Red pill** — Unfilled
- Clicking a day with services expands a detail panel below the grid showing full Service Cards
- Legend shown above calendar

**No weekly reminder banner** — reminder sending is handled in Email Templates only.

---

### 4.2 AI Scheduling Assistant

A chat interface powered by the Anthropic API (`claude-sonnet-4-*`) that interprets natural language to create or remove scheduled events.

**Quick-pick chips** (pre-filled examples):
- "Add a Friday Shabbat April 25"
- "Set up Rosh Hashanah Oct 1 9am–12pm"
- "Add Purim party March 13 7pm, 3 greeters"
- "Add Yom Kippur Oct 10 9am to 1pm"

**Agent behavior:**
- Responds with a friendly confirmation message
- Applies slot rules automatically (see §6 Slot Rules)
- Adds new services directly to the Calendar state
- Can remove services by name or date
- Maintains conversation history within the session

**Slot generation rules applied by agent:**
- Regular Shabbat Friday → 1 × Greeter
- Regular Shabbat Saturday → 1 × Greeter
- High Holidays → per 30-minute window: Greeter 1, Greeter 2, Usher 1, Usher 2
- Custom events → uses admin's description (e.g., "3 greeters" → 3 Greeter slots)

---

### 4.3 Email Templates

Admin configuration for both outbound email types.

**Two template tabs:**
1. **Weekly Reminder** — sent to all board and volunteer members
2. **Confirmation** — sent automatically to individual volunteers on assignment

**Per template:**
- Info banner describing who receives the email and when
- Variable chip bar — clicking inserts the variable at cursor position in the textarea
- Full-height editable textarea
- "Preview" button — renders template with sample data below the editor
- "Save" button — persists template (in-memory in prototype; database in production)

**Weekly Reminder tab only:**
- "Send to All Volunteers" button
- Live send status card showing each volunteer with status: Queued → Sending… → Sent / Failed
- Each row shows: volunteer name, email address, current status

**Email delivery:**  
All emails sent via the synagogue's connected Gmail account using the Anthropic API + Gmail MCP. Calendar invites are created via Google Calendar API with `sendUpdates: 'all'` — Google handles invite delivery natively.

---

### 4.4 Sign Up (Volunteer-facing)

Public-facing view for volunteers to self-assign to open slots. No login required.

**Fields at top:**
- Name (text input)
- Email (email input)

**Service cards** showing only services with open slots, sorted chronologically. Within each card, open slots are shown with a "Sign Up" button.

**On sign-up:**
1. Slot is marked filled with the volunteer's name and email
2. A modal shows the confirmation email preview
3. On "Confirm & Send": confirmation email sent to volunteer via Gmail; Google Calendar invite sent

---

### 4.5 My Dates

Volunteer self-service lookup for their upcoming assignments.

**Input:** Name text field + "Look Up" button (also triggers on Enter)

**Results:** 
- Count of assignments found
- Card listing each assignment: date badge, service type, role, time slot (if applicable)
- Empty state if no results found

---

## 5. Service Card

Reusable component used in Calendar (both modes) and Sign Up views.

**Card header:**
- Date badge (weekday abbreviation + day number, navy background)
- Service type (Playfair Display serif)
- Full date + time
- Status badge (Fully Staffed / N Open — green / amber / red)
- "HH" tag for High Holiday services

**Slot rows:**
- High Holiday slots grouped by time slot with a section label (e.g., "9:00 AM – 9:30 AM")
- Each row: colored dot, role name, volunteer name (if filled) or "Open" label
- Admin view: filled slots show "Remove" button; open slots show "Assign" button
- Volunteer view: open slots show "Sign Up" button

---

## 6. Slot Rules

| Service Type | Slots |
|---|---|
| Regular Shabbat Friday | 1 × Greeter |
| Regular Shabbat Saturday | 1 × Greeter |
| High Holiday (per 30-min window) | Greeter 1, Greeter 2, Usher 1, Usher 2 |
| Custom event | Defined by admin description |

High Holiday slots include a `timeSlot` field (e.g., `"9:00 AM – 9:30 AM"`) and are grouped visually in the UI.

---

## 7. Volunteer Profiles

Pre-configured in the system by an admin. Each profile contains:

| Field | Type |
|---|---|
| `name` | string |
| `email` | string |

In the prototype, 10 example profiles are seeded. In production, this will be managed via a Volunteer Management screen (not yet built).

**Volunteer email is never manually entered during assignment.** The system looks up the email from the profile automatically when a volunteer is selected in the Assign modal.

---

## 8. Assign Modal (Admin)

Triggered by clicking "Assign" on any open slot.

**Content:**
- Service name, date, and role as context
- Volunteer dropdown (all profiles)
- On volunteer selection: preview line showing the email the invite will go to
- "Assign & Send Invite" button — spinner shown during send

**On confirmation:**
1. Slot updated with volunteer name and email
2. Confirmation email sent via Gmail (using confirmation template)
3. Google Calendar event created with volunteer as attendee (`sendUpdates: 'all'`)
4. Toast notification confirms success or reports delivery failure

---

## 9. Email Templates

### 9.1 Weekly Reminder

**Recipient:** All board and volunteer members (full list)  
**Trigger:** Admin-initiated via "Send to All Volunteers" button in Email Templates  
**Frequency:** Intended for weekly send (scheduling automation to be implemented)

**Default template variables:**
| Variable | Description |
|---|---|
| `{volunteer_name}` | Recipient's name |
| `{open_slots_list}` | Bullet list of all currently open slots |
| `{signup_link}` | URL to the volunteer sign-up board |

### 9.2 Confirmation Email

**Recipient:** Individual volunteer  
**Trigger:** Automatic — fires when admin assigns a volunteer, or when a volunteer self-signs-up  
**Accompanies:** A Google Calendar invitation sent via GCal API

**Default template variables:**
| Variable | Description |
|---|---|
| `{volunteer_name}` | Volunteer's name |
| `{service_type}` | e.g., "Kabbalat Shabbat" |
| `{date}` | e.g., "Friday, April 11" |
| `{time}` | e.g., "6:30 PM" |
| `{role}` | e.g., "Greeter" or "Usher 1" |
| `{timeslot_line}` | Optional slot window for High Holiday assignments |

---

## 10. Data Model

### Service
```
{
  id:          number | string,
  date:        string,           // "Friday, April 11"
  dateISO:     string,           // "2025-04-11"
  time:        string,           // "6:30 PM"
  type:        string,           // "Kabbalat Shabbat"
  isHH:        boolean,          // High Holiday flag
  slots:       Slot[]
}
```

### Slot
```
{
  id:             string,
  role:           string,        // "Greeter", "Usher 1", etc.
  timeSlot:       string | null, // "9:00 AM – 9:30 AM" (HH only)
  volunteer:      string | null,
  volunteerEmail: string | null
}
```

### Volunteer Profile
```
{
  name:  string,
  email: string
}
```

---

## 11. Integrations

| Integration | Purpose | Method |
|---|---|---|
| Gmail (Google) | Send confirmation and reminder emails | Anthropic API + Gmail MCP |
| Google Calendar | Send calendar invites to volunteers | Anthropic API + GCal MCP (`sendUpdates: 'all'`) |
| Anthropic API | AI Scheduling Assistant + email/calendar dispatch | `claude-sonnet-4-*`, `max_tokens: 1000` |

**Note on MCP endpoints:** The Gmail and Google Calendar MCP URLs used in the prototype (`gmail.mcp.claude.com`, `gcal.mcp.claude.com`) are internal to Claude.ai. In the deployed app, these will be replaced with direct Gmail API and Google Calendar API calls using Google OAuth 2.0.

---

## 12. Deployment Architecture (Planned)

| Layer | Technology | Notes |
|---|---|---|
| Hosting | Vercel (Hobby tier) | Static React app + serverless API routes |
| Database | Supabase (free tier) | Services, slots, volunteer profiles |
| Email sending | Gmail API via OAuth 2.0 | Replaces MCP in production |
| Calendar invites | Google Calendar API | Replaces MCP in production |
| AI agent | Anthropic API (server-side) | API key stored as Vercel env variable |
| Auth (admin) | To be determined | Simple password or Google OAuth |

**API key security:** All Anthropic API calls must be proxied through a Vercel serverless function (`/api/claude.js`) to keep the key server-side. Direct browser-to-API calls are not acceptable in production.

---

## 13. Known Gaps / Still To Decide

- [ ] Volunteer management screen — add, edit, deactivate profiles
- [ ] Admin authentication — how admins log in
- [ ] Persistent storage — all state currently resets on page refresh
- [ ] Weekly reminder scheduling — automated Monday 8am send (cron job or Vercel scheduled function)
- [ ] Cancellation / swap request flow — volunteer notifies admin, system finds substitute
- [ ] Confirmation link — "I confirm I'll be there" reply mechanism
- [ ] Email for self-sign-up volunteers — currently uses volunteer-entered email; in production should check against profile if one exists
- [ ] Multi-year scheduling — currently defaults to 2025
- [ ] Volunteer-facing "My Dates" calendar download — removed in v4, may want to restore
- [ ] High Holiday service duration defaults — agent infers from description; explicit UI control not yet built

---

## 14. Seed Data (Prototype)

| Date | Service | Slots | Status |
|---|---|---|---|
| Fri April 11 | Kabbalat Shabbat | 1 Greeter | Open |
| Sat April 12 | Shabbat Morning | 1 Greeter | Open |
| Fri April 18 | Kabbalat Shabbat | 1 Greeter | Filled (Sarah Goldberg) |
| Sat April 19 | Shabbat Morning | 1 Greeter | Open |
| Fri April 25 | Kabbalat Shabbat | 1 Greeter | Open |
| Sat April 26 | Shabbat Morning | 1 Greeter | Open |
| Wed October 1 | Rosh Hashanah Morning | 8 slots (2 time windows × 4 roles) | All open |

---

## 15. Open UX Questions for Testing

The following experience questions should be validated before finalizing for production build:

1. Does the Grid calendar view give enough context at a glance, or is more detail needed per cell?
2. Should volunteers be able to cancel their own sign-up, or is that admin-only?
3. Should the Assign modal show the volunteer's history (how many times they've served)?
4. Is a single confirmation email sufficient, or should a separate reminder be sent 48 hours before?
5. Should the weekly reminder only go to volunteers with no upcoming assignments, or to everyone?
6. How should the system handle the same person signing up twice (duplicate detection)?
7. Should High Holiday slot groups be collapsible in the list view given how many rows they produce?

</pasted_text>

<!-- The user explicitly selected the following skills for this project, as attachments to their message. These are not optional context — they define how you work. Use them. -->
<attached-skill name="Hi-fi design">
Create a high-fidelity, polished design. Follow the instructions about design in your system prompt, particularly the 'How to do design work' section. Use the design_canvas starter component, or make a full-bleed prototype and offer options via Tweaks.
</attached-skill>

<attached-skill name="Interactive prototype">
Create a fully interactive prototype with realistic state management and transitions. Use React useState/useEffect for dynamic behavior. Include hover states, click interactions, form validation, animated transitions, and multi-step navigation flows. It should feel like a real working app, not a static mockup.
</attached-skill>


<system-reminder>Auto-injected reminder (ignore if not relevant): do not recreate copyrighted or branded UI unless the user's email domain matches that company. Create original designs instead.</system-reminder>

## Assistant

_[tool: questions_v2]_

## User

Questions answered:
- scope: Calendar (List + Grid)
- aesthetic: Yes but more refined / less ornate
- starting_state: AI Scheduler — lead with the wow moment
- ai_realness: Scripted/canned responses that look real
- tweaks: Color palette (navy/gold vs alternatives), Calendar default view (List vs Grid), Typography (serif heading options), Density (cozy vs compact), Show/hide HH tags & accents
- data_richness: A full month of services + High Holidays
- interactions_priority: Assign modal flow with email preview, Grid → day-detail expansion, AI chat with streaming responses, Sign-up confirmation modal
- tone: Warm & community-feeling (small congregation vibe)
- device: Mobile-first (volunteers sign up on phones)

## Assistant

_[tool: update_todos]_

_[tool: copy_starter_component]_

_[tool: read_file]_

_[tool: write_file]_

_[tool: write_file]_

Now I have what I need. Let me design the system out loud before writing:

**Aesthetic system** — refined navy/gold/cream:
- Navy `#16263F`, Gold `#B8893A` (bronze-leaning, not flashy), Cream `#F6F1E7`, Paper `#FBF8F1`, Ink `#1A1410`
- Playfair Display for headings only (service titles, page titles); DM Sans for everything else
- Hairline borders, no drop shadows except modal overlays
- Mobile-first: bottom nav bar, full-width cards, sheet-style modals
- Lands on AI Scheduler — that's the wow

Let me build it.

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: show_html]_

_[tool: grep]_

_[tool: read_file]_

Good. Let me ship and check.

_[tool: done]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: grep]_

_[tool: save_screenshot]_

The screenshot tool may be caching. Let me hard-reload by adding a cache buster and re-checking.

_[tool: view_image]_

_[tool: view_image]_

Both fixes landed: "Friday · 6:30 PM" on cards and "May 2026" stays on one line. The design is solid — refined navy/gold/cream, clean cards, working calendar grid with day-detail expansion, AI chat with streaming, sign-up flow, and tweaks for palette/typography/density/view/HH accents.

_[tool: fork_verifier_agent]_

Built a mobile-first interactive prototype landing on the AI Scheduler — the wow moment — with the full admin/volunteer surface behind it.

**What's in `Greeter Scheduler.html`:**
- **AI Scheduler** (landing): hero card with assistant intro, four quick-pick chips that trigger scripted streaming responses + an "Added · …" action card summarizing what the agent created.
- **Calendar**: stats row, List/Grid toggle, full month grid with Fully Staffed / Partial / Unfilled pills, click any day → expanded service cards below. Assign and Remove flows wired up.
- **Sign Up**: name/email at top, only services with openings shown, sign-up disabled until details entered, confirmation modal with email preview before send.
- **My Dates**: name lookup with empty/found states.
- **Email Templates**: tabbed Reminder/Confirmation, variable chips that insert at cursor, live preview, "Send to All" with Queued → Sending → Sent live status rolling through 10 volunteers.
- **Assign / Sign-up modals** show the full email preview (To, Subj, body with bold variables) before "Send Invite".
- **Toasts** confirm assignments + removals.

**Tweaks panel** (toolbar toggle): Density (compact / regular / cozy), Palette (Navy & Gold / Olive & Stone / Burgundy & Cream / Indigo & Saffron), Heading font (Playfair / Cormorant / Fraunces / DM Serif), HH accents on/off, Calendar default view, and landing screen.

A few open caveats worth knowing: AI responses are scripted (per your choice), free-text input shows a generic fallback. The "Send to All" status uses staggered timers rather than real network calls. State resets on refresh.

## User

Apply drawing

## Assistant

_[tool: str_replace_edit]_

Good direction — I'll add auth (manual name, email/password, Google), persist it, and have logged-in state suppress the name/email entry across Sign Up + My Dates.Now add the AuthSheet component and TopbarAuth widget to components.jsx:

_[tool: str_replace_edit]_

Now add the AuthSheet component at the bottom of components.jsx, before the Object.assign:

_[tool: str_replace_edit]_

Now update SignUpView and MyDatesView to be auth-aware, then wire it all in app.jsx:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now wire it all up in app.jsx:

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

I see button text wrapping ("Sign in" → "Sign", "Sign Up" → "Sign"). Need `white-space: nowrap`:

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: eval_js_user_view]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: save_screenshot]_

_[tool: view_image]_

Initials are showing — May 9 has "MK" (Miriam Katz), May 22 has "AF RS" (Aaron Feldman, Rachel Stein for the Shavuot eve windows), May 23 has "JC" (Joshua Cohen). Working as intended.

_[tool: fork_verifier_agent]_

Calendar grid cells now display initials of signed-up volunteers alongside the service pills — small navy circles with 2-letter initials, up to 3 visible per day with "+N" overflow. Tooltips show the full name on hover.

## User

Apply comment

## Assistant

_[tool: update_todos]_

Big enhancement — admin event CRUD + volunteer self-service actions. Let me plan and build.First, the EventEditModal + new styles:

_[tool: str_replace_edit]_

Now build the EventEditModal and ConfirmDialog:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now update CalendarView + GridCalendar to support the admin event CRUD flows:

_[tool: str_replace_edit]_

Now update SignUpView to pass through volunteer-side actions, and MyDatesView. Also wire it all in app.jsx.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now wire it in app.jsx:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Wire props through to views + render the new modals:

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: str_replace_edit]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

"Friday, May 1" now stays on one line. The full flow looks polished:

- **Day click on filled date**: Service card with slot management + Edit/Delete buttons + "Add another event"
- **Day click on empty date**: "Create event on this day" CTA  
- **Floating "+ New event" FAB**: always available
- **Volunteer cards**: "You" label on own slots with **Need sub** + **Remove** actions
- **My Dates cards**: same actions when signed in

_[tool: update_todos]_

_[tool: fork_verifier_agent]_

Big additions wired in:

**Admin (Calendar)**
- **Click any date** to expand: filled days show services with **Edit** + **Delete** buttons + "Add another event"; empty days show a "Create event on this day" CTA
- **Floating + New event** FAB always reachable
- **EventEditModal**: pick a type (Kabbalat Shabbat / Shabbat Morning / High Holiday / Custom) → slot rules auto-apply. HH parses "9:00 AM – 12:00 PM" into 30-min windows ×4 roles. Custom lets you set greeter/usher counts. Edit preserves volunteers whose role survives the change.
- **Delete confirmation** dialog warns when volunteers will be unassigned

**Volunteer (Sign Up + My Dates)**
- Own slots show **"You"** with **Need sub** (sets a "Coverage" tag visible to admins) and **Remove** actions
- Sign Up view now includes services the user is on, not just opens, so they can manage them
- My Dates cards get the same actionsVerifier passed silently. The Greeter Scheduler is now a full prototype:

- AI Scheduler (landing) · scripted streaming
- Calendar with List + Grid + day-click CRUD + Edit/Delete + FAB
- Sign Up · auth-aware (manual / password / Google) · "You" + Need sub + Remove on own slots
- My Dates · auto-loads when signed in
- Email Templates · variable chips + live preview + Send-to-all with rolling status
- Auth · localStorage-persisted, account menu in topbar
- Tweaks · palette, density, heading font, HH accents, default view, landing screen

## User

what other screens need to be built out?

## Assistant

Here's what's still missing or partial — roughly in order of value:

**Critical gaps**
1. **Volunteer Profiles management** — admin screen to add/edit/deactivate the 10 seeded profiles. Currently they're hardcoded.
2. **Coverage Requests inbox (admin)** — when a volunteer hits "Need sub," there's nowhere for admin to see the queue. Should be a dedicated view (or section on Calendar) listing requests + "Find substitute" actions.
3. **Admin login** — right now anyone reaching `/calendar` or `/email` has admin powers. Needs a real auth boundary distinct from volunteer auth (or a `role: "admin"` on the user object).

**High-value additions**
4. **Onboarding / first-run screen** — short welcome that explains what the app is + routes admins vs volunteers (today everyone lands on the AI Scheduler regardless).
5. **Activity / notifications feed** — recent assignments, sign-ups, cancellations, coverage requests. Useful "what's happening" for an admin.
6. **Year planner** — the spec calls out multi-year scheduling. A year-grid showing High Holidays + Shabbat density would help during planning season.
7. **Volunteer dashboard** (the volunteer-facing "home") — "your next service" hero + quick links to Sign Up / My Dates. Less generic than dropping them straight on Sign Up.

**Polish screens**
8. **Settings** — synagogue name, address, default service times, integrations (Gmail/GCal connect status).
9. **Send-history log** — record of reminders that have gone out (per the spec the send currently just animates and forgets).
10. **Empty states & error screens** — friendly 404 / offline / "no services yet" first-run experiences.

**Per the spec's own open questions**
- Sign-up duplicate detection UI
- Collapsible HH slot groups in list view
- Volunteer history shown in Assign modal
- 48-hour reminder cadence

Want me to build any of these? My recommendation: **Volunteer Profiles + Coverage Requests inbox** next — both are mentioned in the spec as gaps, and they close real product loops (profiles feed the assign modal; coverage requests give the "Need sub" button a meaningful destination).

## User

Here are some decisions/changes for the spec. This modifies Section 13 of the spec.

## Assistant

_[tool: snip]_

Got it — these are great clarifications. A few notable implications:

**New things to build**
- **Admin section** in the app — not just "anyone on /calendar," but a real screen where admins can manage other admins + volunteer profiles together
- **Admin auth** — same flow as volunteer (email/password or Google), but role-tagged. Username = email.
- **Coverage flow** — Need sub should remove the volunteer immediately AND fan out a "[Name] is looking for someone to replace them at [event]" notice
- **48-hour confirmation email** — separate from the assignment email, with a confirm link
- **My Dates → .ics download** — also auto-attach to confirmation/calendar invite emails
- **Multi-year calendar** — 2026–2028, with an admin action at end of horizon to extend

**Changes to existing things**
- Persisted state (services + templates) keyed to user — not just the user object
- Sign-up should look up email against profile first, fall back to Google Auth, else create
- AI Scheduler should **ask the admin to confirm** assumed slot structure rather than silently apply defaults; admin can also set recurring entries via chat

Want me to start building? My suggested order:

1. **Admin screen** (volunteer profiles + admin roster + role-based auth) — closes the biggest spec gap and unlocks #3
2. **Coverage flow end-to-end** — Need sub now actually removes + announces, and there's a admin-visible queue
3. **AI Scheduler confirmation step** — agent proposes structure, admin confirms before adding
4. **48-hour confirmation email + .ics download** — adds to the email templates surface
5. **Multi-year + extend-horizon action**

Or I can do all five as one big pass. Which way?

## User

The AI should also work for the volunteer. A statement like "Sign me up for this friday" should check the calendar and if available sign the logged in volunteer for the date/time. The AI should also know the common patterns that a volunteer might need access to for managing their schedule. Something like "Can you send me a list of my dates" would show them and/or send them to the volunteer's email.

## Assistant

_[tool: update_todos]_

_[tool: read_file]_

Good — that turns the AI into a real assistant for both sides. Let me build it now.

_[tool: str_replace_edit]_

Going to ship the AI role-awareness now. Rewriting the AI section:

_[tool: invoke_skill]_

_[tool: update_todos]_

Let me load the handoff skill and plan the remaining screens together.

_[tool: str_replace_edit]_

Now seed admin & coverage data + activity, and update Topbar to reflect admin sub-routes:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now build the AdminHub + sub-screens (Volunteers, Admins, Coverage Requests, Settings) and keep EmailView. Add styles:

_[tool: str_replace_edit]_

Now add the AdminHub, Volunteers, Admins, Coverage, Settings views at the end of views.jsx:

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

Now wire it all into app.jsx — add admin sub-routing and pass AI props:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now update the main view rendering to support admin sub-routes:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

Both work beautifully. Now let me build the handoff package.

_[tool: run_script]_

_[tool: copy_files]_

_[tool: write_file]_

_[tool: str_replace_edit]_

Good catch — the topbar role and the assistant mode were derived from different sources. Need a single source of truth: `user.role`. Let me fix.Update the auth modal hint to clarify both demo accounts:

_[tool: str_replace_edit]_

Now update the Topbar to derive role from `user.role`, and BotNav to filter by role:

_[tool: str_replace_edit]_

Now filter BotNav by role:

_[tool: str_replace_edit]_

Now fix the AI view to derive role from `user.role`, and pass `user` to BotNav in app.jsx:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now wire app.jsx — pass user to BotNav, redirect when role doesn't match view, and update tweaks landing options:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

Both states are now consistent:

- **Sarah (volunteer)** → topbar shows her avatar + name, no admin pill. Bot nav has 3 items: AI, Sign Up, My Dates. AI assistant runs in volunteer mode ("Hi Sarah! I can sign you up for services…").
- **Rabbi David Mendel (admin)** → topbar shows admin badge next to name. Bot nav shows all 5 items: AI, Calendar, Admin, Sign Up, My Dates. AI runs in admin mode ("Plan a service in plain English").

Let me re-copy the updated files to the handoff bundle and present the download.

_[tool: copy_files]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: present_fs_item_for_download]_

Handoff package is ready to download above. Three things landed in this pass:

1. **Role-based UI consistency.** Topbar, bot nav, and AI mode all derive from `user.role` (admin / volunteer) — no more "Admin" pill clashing with a volunteer-mode assistant. Guests get the volunteer-flavored nav with a "Sign in" CTA.
2. **All remaining screens built.** Admin Hub → Coverage Requests · Volunteers · Admins · Email Templates · Settings (with multi-year horizon).
3. **Handoff bundle** at `design_handoff_tbe_greeter/` — README has tokens, screens, behavior, state model, spec decisions, suggested build order. All source files included.

