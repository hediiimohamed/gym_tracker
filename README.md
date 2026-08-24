# 🏋️ Carnet — Gym Tracker

A minimal, offline-first workout tracker for a **Push / Pull / Legs** program — built as a single self-contained HTML file. No backend, no build step, no account. Open it and log your sets.

<p align="center">
  <img src="docs/screenshots/home.png" width="220" alt="Dashboard view">
  <img src="docs/screenshots/push.png" width="220" alt="Workout logging view">
  <img src="docs/screenshots/suivi.png" width="220" alt="Weight tracking view">
</p>

## Features

- **Dashboard** — current program week, quick links to your last Push/Pull/Legs session, weekly session count, and a weight trend sparkline at a glance.
- **Push / Pull / Legs logging** — pre-filled with your program's sets/reps targets, shows your previous weights as placeholders so you always know what to beat, and flags priority exercises.
- **Rest timer** — 90s / 3min one-tap timers built into the logging bar.
- **Back-health check-in** — quick tap per session (fine / slight discomfort / pain), with an automatic warning if pain is reported.
- **Journal** — full session history with volume per session, per-exercise breakdown, and one-tap delete (with confirmation).
- **Suivi (tracking)** — fasted body weight with a 7-day / 28-day trend, body measurements, and a shoulder-to-waist ratio.
- **Data ownership** — everything is stored locally in your browser (`localStorage`). Export to JSON any time, import to restore or move to another device. A guarded "erase everything" option lives in Settings.
- **Installable** — includes a web app manifest and icons, so it can be added to your phone's home screen and used like a native app, fully offline.

## Getting started

This is a static site — there is nothing to install or build.

- **Locally**: clone the repo and open [index.html](index.html) in a browser.
- **On your phone**: host it (e.g. GitHub Pages) and open the link once, then "Add to Home Screen" — it will work offline from then on.

```bash
git clone https://github.com/hediiimohamed/gym_tracker.git
cd gym_tracker
python3 -m http.server 8000   # or just open index.html directly
```

## Customizing your program

Everything you're likely to want to change lives in one place: the `CONFIG` block at the top of the `<script>` in [index.html](index.html).

```js
const CYCLE = {
  start:      "2026-08-25",   // cycle start date
  weightGoal: 71.5,           // target weight (kg) by end of cycle
  rampWeeks:  2,              // reduced-load weeks after a break
};

const PROGRAM = {
  push: { label: "Push", ex: [
    { id:"dc_incl", n:"Incline dumbbell press", s:4, r:"8-10" },
    // ...
  ]},
  // pull, legs...
};
```

- Add/remove exercises by editing the `ex` arrays — each needs a unique, **stable** `id` (it's used as the history key; changing it loses that exercise's history).
- `s` = sets, `r` = rep range shown as a hint, `prio:1` highlights the exercise as a priority, `note` shows a short reminder under the exercise name.
- Everything below the config block is app logic and shouldn't need touching.

## Project structure

```
gym_tracker/
├── index.html          # the entire app: markup, styles, and logic
├── manifest.json        # PWA manifest (installable, home screen icon)
├── icons/                # favicon + app icons
└── docs/screenshots/     # images used in this README
```

## Tech

Vanilla HTML/CSS/JS. No frameworks, no dependencies, no build tooling — the whole app is one file so it's easy to read, fork, and adapt.

## Privacy & data

All data stays on your device in `localStorage`. Nothing is sent anywhere. Use the **Export** button in the Données tab regularly to back up your history as a JSON file (e.g. into iCloud/Drive), since clearing your browser data will erase it.

## Disclaimer

The back-health check-in and load-ramp guidance are personal notes, not medical advice. If you're recovering from an injury or experiencing pain, consult a healthcare professional.

## License

Personal project, shared as-is — feel free to fork it and adapt it to your own program.
