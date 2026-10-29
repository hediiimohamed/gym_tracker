# 🏋️ Carnet — Gym Tracker

A workout tracker for a **Push / Pull / Legs** program: a single-file frontend backed by a small Node.js server, so your data lives in a real database instead of being trapped in one browser. Open it on your phone and log your sets.

> **Status**: v3 — safe multi-device sync, pre-session plans from Claude, weighed-gram meal logging, and a session screen built for one-handed use between sets. See [Roadmap](#roadmap).

<p align="center">
  <img src="docs/screenshots/home.png" width="220" alt="Dashboard view">
  <img src="docs/screenshots/push.png" width="220" alt="Workout logging view">
  <img src="docs/screenshots/suivi.png" width="220" alt="Weight tracking view">
</p>

## Features

- **Accueil (home)** — « Prochaine séance » card (next split in the Push → Pull → Legs rotation, days since each split, and a « Préparer la séance » button), today's nutrition bar, and the weight trend.
- **Préparer la séance (pre-session plan)** — one tap before training: Claude (Opus) reads your last 3 sessions of that type, days since your last session, the loads you've already used, and today's meals, then returns exact set-by-set targets (« 22×10 · 22×10 · 24×8 »), a one-sentence focus, a cue and a reason per exercise, questions about missing data (« Amplitude à 200 kg confirmée ? ») and up to 2 reminders. It follows the 13-rule target method in `server/profile.js`.
- **Session screen** — built for one hand between sets: planned targets as input placeholders, a « last time » button (tap = copy last time, long-press = copy today's target), a form rating per set (✓ 1 / ~ 0,5 / ✗ 0) that pulses after you enter reps, live « Objectif atteint / Dépassé / En dessous » per exercise, an automatic rest timer (90 s compound, 60 s isolation) with vibration, reps-only core exercises, pull-ups at body weight, and a collapsible execution standard per exercise. The draft survives a reload. After saving: « X/Y séries au standard » and target hit/missed per exercise.
- **Bilan de séance** — after saving, *Analyser avec Claude* reviews the session with the same method and sets next-session targets.
- **Repas (meals)** — write what you ate in weighed grams (photo optional). Written quantities are taken as the truth; « cru » is computed on raw values; anything without a weight is flagged « estimé » with a question. Tap a row to correct the grams; totals recompute. Save a meal as a favourite and log it again in one tap. Daily bar vs 3 000 kcal / 150 g protein / 375 g carbs (protein shows « assez » once reached).
- **Coach** — a chat backed by Claude (Haiku) that sees every set with its form rating, back status and notes for the last 5 sessions, 14 days of weights with the 7-day average, the latest measurements, and today's/yesterday's meal totals. Not a medical professional.
- **Journal** — full history; rated sessions are titled « X/Y séries au standard », volume is secondary.
- **Suivi (tracking)** — 7-day average weight as the main line (daily weigh-ins as faint points), shoulder/waist ratio over time with a « Mesure de taille à prendre » reminder after 14 days, per-exercise progress, and a photo check-in protocol every 4 weeks (photos are not stored).
- **Sync that never loses a session** — see [Data safety](#data-safety).
- **Installable** — web app manifest and icons; add it to your home screen.

## Data safety

- Every change is written to the phone first, then sent to the server with the version it was based on. If another device wrote in between, the server answers `409` and the app merges (union of sessions, weights and measures by date; a `deleted` tombstone list keeps deletions from coming back) and retries.
- If the server can't be reached (Render's free plan sleeps), the change stays on the phone, a banner says « Séance gardée sur ce téléphone, pas encore synchronisée », and it's retried on next load, when the network comes back, and every 30 s. « Séance enregistrée » only appears once the server has confirmed.
- The server keeps the last 5 states in `state_backups`.

## Architecture

```
Browser (index.html)  <-->  Node/Express server  <-->  Turso (hosted SQLite)
                                    |
                                    +-->  Anthropic API (plans, reviews, coach, meals)
```

The frontend is one static HTML file (markup, styles, and UI logic, no build step). The `server/` folder is a small Express app that serves only `index.html`, `manifest.json` and `icons/`, and exposes the API. Every request must carry the access code as a bearer token (compared in constant time); without it, the API returns 401. `/api/*` is rate-limited to 60 requests/min and the Claude endpoints to 10/min.

| Endpoint | What it does |
|---|---|
| `GET/PUT /api/state` | versioned app state (`{data, version}`; PUT needs `baseVersion`, 409 on conflict) |
| `POST /api/plan` | pre-session plan: focus, order, set-by-set targets, missing-data questions, reminders |
| `POST /api/review` | post-session review and next-session targets |
| `GET/POST/DELETE /api/chat` | coach conversation |
| `GET/POST /api/meals`, `PATCH/DELETE /api/meals/:id`, `GET /api/meals/:id/image` | meals (photos load lazily) |
| `GET/POST/DELETE /api/favorites` | favourite meals |

**Athlete profile.** `server/profile.js` is the single source of truth for who the athlete is (goals, back rules, nutrition targets, style) and for the 13-rule target method. It's injected into every Claude call — edit it there, not in the individual prompts.

## Getting started

### Run it locally

```bash
git clone https://github.com/hediiimohamed/gym_tracker.git
cd gym_tracker/server
cp .env.example .env   # fill in TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, APP_TOKEN, ANTHROPIC_API_KEY
npm install
npm start              # serves the app + API on http://localhost:3000
```

### Deploy it for real (free)

1. **Database** — create a free database at [turso.tech](https://turso.tech), then grab its URL and auth token from the "Connect" panel.
2. **Server** — push this repo to GitHub, then create a new Web Service on [Render](https://render.com) pointing at it (the included `render.yaml` preconfigures the build/start commands — Render will just ask you to fill in the environment variables: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `APP_TOKEN` (a long random secret, e.g. `openssl rand -hex 24`), and `ANTHROPIC_API_KEY` from [console.anthropic.com](https://console.anthropic.com) (needed for plans, reviews, the coach and meals; logging works without it).
   **Set a monthly spend limit** in the Anthropic console (Settings → Limits): the Render URL is public, and while the API is rate-limited and token-protected, a hard cap is the only guarantee on cost.
3. Open the Render URL on your phone, enter your `APP_TOKEN` once when prompted, and "Add to Home Screen".

Static GitHub Pages hosting (no backend) is no longer sufficient once a server is involved — the Render URL is now the one to use and install. If Auto-Deploy is off on Render, use *Manual Deploy → Deploy latest commit* after each push.

## Customizing your program

Everything you're likely to want to change lives in one place: the `CONFIG` block at the top of the `<script>` in [index.html](index.html).

```js
const CYCLE = {
  start:      "2026-08-25",   // cycle start date
  weightGoal: 70.0,           // target weight (kg) by end of cycle
  breakDays:  10,             // days without training that count as a break (comeback ramp)
  photoCheck: "2026-11-16",   // photo check-in, then every 4 weeks
};

const PROGRAM = {
  push: { label: "Push", cardio: NO_CARDIO, ex: [
    { id:"dc_incl", n:"Développé incliné haltères", s:4, r:"8-10", note:"…", sub:[…],
      std:"Amplitude complète, haltères au niveau de la poitrine, pas de rebond…" },
    // ...
  ]},
  // pull, legs...
};
```

- Add/remove exercises by editing the `ex` arrays — each needs a unique, **stable** `id` (it's used as the history key; changing it loses that exercise's history).
- `s` = sets, `r` = rep range, `prio:1` = priority exercise, `note` = short reminder, `sub` = substitutions.
- `std` = the execution standard, shown collapsible under the exercise name and sent to Claude. It defines what counts as a set « au standard » (form rating 1). Five exercises have one; fill in the others in your own words.
- `iso:1` = isolation (60 s rest instead of 90 s), `core:1` = core work (reps only, saved at 0 kg), `bw:1` = body-weight load (pull-ups, pre-filled with your latest weigh-in).
- Everything below the config block is app logic and shouldn't need touching.

## Project structure

```
gym_tracker/
├── index.html             # the entire frontend: markup, styles, and logic
├── manifest.json           # PWA manifest (installable, home screen icon)
├── icons/                   # favicon + app icons
├── docs/screenshots/        # images used in this README
├── render.yaml               # Render deployment blueprint
└── server/                    # backend: Express + Turso (hosted SQLite)
    ├── index.js                 # HTTP server, auth, rate limits, routes
    ├── db.js                    # Turso client, schema, versioned state + backups
    ├── profile.js               # athlete profile + target method (in every Claude call)
    ├── format.js                # turns sessions/meals into prompt text
    ├── claude.js                # Anthropic client + JSON-schema helper
    ├── plan.js                  # pre-session plan (POST /api/plan)
    ├── review.js                # post-session review
    ├── coach.js                 # coach chat context
    ├── food.js                  # meal analysis (grams first)
    └── .env.example              # required environment variables
```

## Tech

Frontend: vanilla HTML/CSS/JS, no framework, no build step. Backend: Node.js + Express + [`@libsql/client`](https://github.com/tursodatabase/libsql-client-ts) talking to Turso. Deliberately small — a handful of tables and endpoints — so it's easy to read, fork, and extend.

## Privacy & data

Your data is stored in your own Turso database and served by Render, reachable only with your `APP_TOKEN`. To generate plans, reviews, coach answers and nutrition estimates, your sessions, chat messages, meal descriptions and meal photos are sent to the Anthropic API. Treat the token like a password — anyone who has it can read and overwrite your history. Use the **Export** button in the Données tab regularly for a manual JSON backup.

## Roadmap

1. ~~Backend + real database~~ (done)
2. ~~More analytics and charts on existing session/weight data~~ (done)
3. ~~An AI coaching chat (Claude) that can see your logged sets and answer questions about your training~~ (done)
4. ~~Meal photo logging — snap a photo, get a nutrition estimate~~ (done)

All four original phases are complete, followed by v3 (sync safety, coaching brain, grams-first meals, session screen redesign, home/tracking/security).

## Disclaimer

The back-health check-in, comeback ramp and Claude's targets are personal coaching aids, not medical advice. If you're recovering from an injury or experiencing pain, consult a healthcare professional.

## License

Personal project, shared as-is — feel free to fork it and adapt it to your own program.
