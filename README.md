# Falling Fences — Web (PWA)

Web rewrite of the Falling Fences safe-manipulation simulation, as an installable
PWA hosted on GitHub Pages. See `WebPWAPortPlan.md` for the full plan.

## Prerequisites

- **Node.js 20+** (and npm). Install from https://nodejs.org or via `brew install node`.
- **Python 3** (only for regenerating parity fixtures).

### Corporate / managed-Mac setup (if `npm install` fails on certificates)

On TLS-inspecting corporate machines, npm may fail with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`.
Point Node at a PEM built from your keychains, and use the internal registry if you have one:

```
security find-certificate -a -p /System/Library/Keychains/SystemRootCertificates.keychain >  ~/node-ca.pem
security find-certificate -a -p /Library/Keychains/System.keychain                         >> ~/node-ca.pem
security find-certificate -a -p ~/Library/Keychains/login.keychain-db                       >> ~/node-ca.pem
export NODE_EXTRA_CA_CERTS=~/node-ca.pem     # add this line to ~/.zshrc
# npm config set registry https://npm.apple.com   # if your org has an internal mirror
```

## Setup

```
npm install        # local lockfile is gitignored (see below) — no need to commit it
npm run dev        # local dev server
npm run test       # run the parity test suite (Vitest)
npm run build      # production build → dist/
npm run preview    # serve the production build locally
```

> **Note:** `package-lock.json` is intentionally **not committed**. On a managed machine it
> resolves to an internal registry mirror that CI can't reach, so CI installs from the public
> registry instead (`npm install --registry=https://registry.npmjs.org/`). If esbuild/vite
> break on a hardened npm, run `npm approve-scripts esbuild && npm rebuild esbuild`.

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
