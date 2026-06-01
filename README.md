# Temple Beth El — Greeter Scheduler

A mobile-first volunteer scheduling web app for Temple Beth El's greeter and usher program. Built with Vite + React + TypeScript, deployed on Vercel, with an AI scheduling assistant powered by the Anthropic API.

**Live app:** https://tbe-greeter-scheduler.vercel.app

## Features

- **AI Scheduling Assistant** — chat with Claude to add services, sign up for slots, or request coverage
- **Admin view** — calendar management, slot assignment, volunteer/admin roster, coverage requests
- **Volunteer view** — sign up for services, view your upcoming dates, request substitutes
- **Role-based auth** — mock Google sign-in; email matched against seeded admin/volunteer lists
- **Theme system** — four color palettes, three density modes, four heading fonts via Tweaks panel

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Vite 6 + React 19 + TypeScript |
| API | Vercel Edge Function (`api/chat.js`) |
| AI | Anthropic API — `claude-sonnet-4-6` |
| Deployment | Vercel (auto-deploy from `main`) |
| Fonts | Google Fonts — Playfair Display, DM Sans, + 3 alternates |

## Local development

```bash
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

npm install
npm run dev
# Vite: http://localhost:5173
# Express API: http://localhost:3001
```

## Deployment

Push to `main` → Vercel auto-deploys. Requires `ANTHROPIC_API_KEY` set in Vercel project settings.

## Project structure

```
src/
  App.tsx          # Root component — state, routing, all handlers
  types.ts         # Shared TypeScript types
  data.ts          # Seed data — volunteers, admins, initial services
  helpers.ts       # Pure utility functions
  styles.css       # All styles (~700 lines)
  components.tsx   # Shared UI — Topbar, BotNav, modals, auth sheet
  views.tsx        # Page views — AI chat, Calendar, SignUp, Admin, etc.
  TweaksPanel.tsx  # Draggable theme/behavior tweaks panel
  main.tsx         # React entry point

api/
  chat.js          # Vercel Edge Function — Anthropic API proxy

server/
  index.ts         # Local Express dev server (mirrors api/chat.js)

project/           # Original Claude Design prototype files (reference only)
```
