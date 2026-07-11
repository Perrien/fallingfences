# Falling Fences — Web (PWA)

Web rewrite of the Falling Fences safe-manipulation simulation, as an installable
PWA hosted on GitHub Pages. See `WebPWAPortPlan.md` for the full plan.

## Prerequisites

- **Node.js 20+** (and npm). Install from https://nodejs.org or via `brew install node`.
- **Python 3** (only for regenerating parity fixtures).

## Setup

```
npm install        # first run creates package-lock.json — commit it
npm run dev        # local dev server
npm run test       # run the parity test suite (Vitest)
npm run build      # production build → dist/
npm run preview    # serve the production build locally
```

## Layout

```
src/sim/           pure simulation core (ported from the Swift app), zero UI deps
test/parity/       Vitest suites asserting the port matches the oracle
test/vectors/      parity fixtures (generated) — 64-bit values are decimal strings
tools/             gen_rng_fixtures.py — the Python oracle that regenerates fixtures
```

## Parity model

The simulation must reproduce the Swift app bit-for-bit. `tools/gen_rng_fixtures.py`
mirrors the Swift `SeededRNG` (splitmix64) + the rejection-sampling integer draw and
emits `test/vectors/*.json`; the TS port is asserted against those fixtures. Regenerate
with `npm run fixtures` (or `python3 tools/gen_rng_fixtures.py`).

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which runs the parity tests,
builds, and deploys to GitHub Pages. In the repo settings, set **Settings → Pages →
Source: GitHub Actions**. Live at `https://perrien.github.io/fallingfences/`.
