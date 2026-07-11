# Porting Falling Fences to an Installable PWA

*Temporary porting doc — lives in this repo only until the port is complete.*

## Status

- **Phase 0 — DONE (2026-07-10).** Repo live and deploying to `perrien.github.io/fallingfences/`
  via GitHub Actions. `SeededRNG` (BigInt splitmix64 + `swiftInt` rejection sampling) and
  `AngleNormalizer` ported; **30 parity tests green** against the Python oracle; production PWA
  build verified. Next session: **Phase 1** (standard manipulation MVP).

## Context

The original app is a Swift/SwiftUI iOS+macOS safe-manipulation simulation living in a
**separate** repo (`~/CCode/SafeCracking`, local-only, no remote). This repo
(`github.com/Perrien/fallingfences`) is the standalone web rewrite: a **PWA** — installable
to an iPhone/iPad home screen, offline-capable, hosted on **GitHub Pages** (static, no server).

**Verdict: realistic.** No server dependency (persistence is client-side). The real cost is a
**UI rewrite**: ~2,800 lines of pure simulation logic translate cleanly to TypeScript, while
~9,400 lines of SwiftUI must be rebuilt.

Decisions:
- **Goal:** full feature parity as target, open to trimming.
- **First milestone:** Standard manipulation tier (dial-driven), NOT Ultra.
- **Stack:** Svelte 5 (runes) + TypeScript + Vite.
- **Persistence:** ephemeral — only an in-progress unsolved lock must survive; solved locks
  are discarded; progression best-effort; preferences are hardcoded defaults.
- **Native-save interop:** none.
- **Responsive layout:** **full parity** — reproduce the distinct layouts, keyed off viewport
  width (not OS): a compact/tabbed layout on narrow screens (phone), a split/sidebar layout on
  wide screens (iPad/Mac), plus the landscape full-screen graph mode. Do NOT collapse to a
  single adaptive layout. This maps onto CSS breakpoints the same way the native app keys off
  `horizontalSizeClass` (compact vs regular).
- **Repo:** standalone `github.com/Perrien/fallingfences`, Pages URL
  `perrien.github.io/fallingfences/`, so **Vite `base: '/fallingfences/'`**.

## Why this is feasible

- **No backend needed.** The Swift persistence layer is just JSON read/write → maps to
  **IndexedDB** (`idb`), fully client-side.
- **Sim core is pure and portable** (~2,800 lines, only `import Foundation` in the Swift original).
- **Cross-language determinism is already proven.** The Swift repo's `diagnostic_sim.py`
  (349 lines) is a working Python reimplementation of `SeededRNG` (splitmix64) + `WheelFactory`
  + `wheel_height`. It is the reference oracle for validating the TS port.
- **No haptics, no audio** anywhere.

## Stack

**Svelte 5 + TypeScript + Vite**, with `vite-plugin-pwa` (Workbox) for manifest + service
worker, and `idb` for IndexedDB. Keep `models/` and `sim/` as **pure `.ts` with zero Svelte
imports** (testable under Vitest/Node); wrap them in one `GameState.svelte.ts` mirroring the
Swift `SafeSimulator`.

## Repository layout (standalone — this repo IS the web app)

```
fallingfences/                     ← repo root = the web app
├── src/
│   ├── sim/{SeededRNG.ts, AngleNormalizer.ts}     ← ported + parity-tested (Phase 0)
│   ├── App.svelte  main.ts  app.css  vite-env.d.ts
│   └── (models, state, persistence, render, components — added in later phases)
├── test/
│   ├── vectors/{rng.json, angle.json}   ← generated parity fixtures (committed)
│   └── parity/{rng.test.ts, angle.test.ts}
├── tools/gen_rng_fixtures.py            ← Python oracle; regenerates fixtures (npm run fixtures)
├── index.html  vite.config.ts  svelte.config.js  tsconfig.json  package.json
├── .github/workflows/deploy.yml         ← build + deploy to Pages
├── README.md
└── WebPWAPortPlan.md                    ← this doc (temporary)
```

(`node_modules/`, `dist/`, and `package-lock.json` are gitignored — see Build environment notes.)

**Deploy:** GitHub Actions on push to `main` → `npm install` (public registry) → `npm run test`
(parity gate) → `npm run build` → `upload-pages-artifact`(`dist`) → `deploy-pages`. Enable in
repo **Settings → Pages → Source: GitHub Actions** (ignore the "Static HTML" starter — our
workflow builds the app). **Critical:** Pages serves under `/fallingfences/`, so `base`, PWA
`scope`, and `start_url` must all be `/fallingfences/` or assets 404.

## Cross-repo parity handoff

The reference oracle lives in the SafeCracking repo (`diagnostic_sim.py` + the Swift parity
tests); this repo can't reference it directly. **What we actually did in Phase 0:**
`tools/gen_rng_fixtures.py` is a self-contained copy of the oracle's RNG + `swift_int` logic
(lifted verbatim from `diagnostic_sim.py`); it emits `test/vectors/*.json`, which Vitest asserts
the TS port against. Expected values were cross-checked against the Swift `SeededRNGTests` /
`DiagnosticParityTests`. For Phase 1's `WheelFactory`/`ContactPointCalculator`, extend
`gen_rng_fixtures.py` with `build_wheels`/`wheel_height` (also in `diagnostic_sim.py`) and gate
on the `DiagnosticParityTests` values (seed 12345 → base heights `[1.0, 0.965, 0.930]`, freqs
`[0.558, 0.764, 1.771]`, false gates W1@79 / W2@[34,41] / W3@[3,12,28]).

## Core-logic translation (bottom-up, each layer parity-gated)

1. **`SeededRNG`** — everything in `BigInt` masked to 64 bits. Two integer paths:
   `nextInt` (plain modulo) vs **`Array.shuffle` = Fisher-Yates rejection sampling**
   (`swift_int` in Python) — implement the rejection loop exactly, or base-height order desyncs.
2. **`AngleNormalizer`** (trivial).
3. **`WheelFactory`** — preserve exact RNG draw order incl. the degenerate-range oval-freq skip.
   Gate on the `DiagnosticParityTests` fixtures (seed 12345 → known heights/freqs/false-gates).
4. **`ContactPointCalculator`** — proportional-cut `wheelHeight`, oval, surface noise.
5. **`WheelPositionEngine`** — drive-pin/fly-gap state machine.
6. **`SolveScoreCalculator`**, difficulty rating.
7. **`SafeSimulator` → `GameState.svelte.ts`** — last. Its noise RNG is intentionally
   non-deterministic (`crypto.getRandomValues` on web) — no parity needed there.

Tolerances: `< 1e-9` for RNG-integer-derived values, `< 1e-6` for trig-derived (`Math.sin/cos`
are not bit-identical across engines — matches existing Swift test tolerances).

## Storage (IndexedDB) — deliberately ephemeral

- **`locks` store** — only *unsolved* working locks (profile + combination + probe history /
  session). On solve, **delete the record** (no archive).
- **`progression` store** — best-effort; resetting it is acceptable.
- **Preferences → hardcoded defaults**; `localStorage` is convenience only.

Schema notes: dates as ISO-8601 strings; **seed as string → BigInt** (JSON loses precision
> 2^53); Swift `[Int:_]` dicts encode as flat alternating key/value arrays (only relevant when
reading exported fixtures). No native-save import, no export/backup UI, no solved-lock archive
or profile library — so the home screen is "resume in-progress lock, or start a new one."

## PWA specifics

Manifest (standalone, `scope`/`start_url` = `/fallingfences/`, icons from the Swift appiconset);
Workbox precache of app shell (`registerType: 'autoUpdate'` + reload prompt so a solve isn't
interrupted mid-session). iOS: no `beforeinstallprompt` (show a manual "Add to Home Screen"
card); `viewport-fit=cover` + safe-area insets. Installed home-screen PWAs are exempt from
WebKit's 7-day storage eviction (that cap only hits uninstalled Safari-tab use), so nudge
installation; call `navigator.storage.persist()` as cheap insurance.

**Update behavior (verified):** `registerType: 'autoUpdate'` means an installed home-screen PWA
picks up new deploys automatically — no delete/re-add. The service worker revalidates on launch;
the new version typically goes live on the *next* launch after the one that detected it (on iOS,
fully closing + reopening guarantees the check). **Exception:** iOS bakes the home-screen icon
and app name in at install time — *content* updates freely, but a changed icon/name requires
re-adding. Relevant once: when the real app icon lands (Phase 1), re-add to pick it up.

## Build environment & CI notes (this machine — see also team memory)

This is an Apple-managed Mac; getting `npm` working took some doing. What was found:

- **TLS / cert:** npm failed with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` (corporate TLS
  inspection). `--use-system-ca` and the Claude sandbox `bundle.pem` were NOT enough — the corp
  CA is in the **login keychain**. Fix that worked: dump all keychains to a PEM and point Node at
  it via `NODE_EXTRA_CA_CERTS=~/node-ca.pem` (added to `~/.zshrc`). See README for the exact
  `security find-certificate` commands.
- **Registry:** local npm uses the internal mirror `https://npm.apple.com`
  (`npm config set registry ...`).
- **CI cannot use the local lockfile.** `package-lock.json` generated here resolves to
  `npm.apple.com` / `artifacts.apple.com` — unreachable from GitHub's runners. So the lockfile is
  **gitignored** (not committed) and CI runs `npm install --registry=https://registry.npmjs.org/`
  (public registry, re-resolves fresh). Trade-off: no locked reproducibility in CI; acceptable for
  a project this small. If locked builds ever matter, generate a public-registry lockfile from a
  clean-internet machine.
- **Node:** local is v26; CI pinned to Node 22 (the setup-node "Node 20 deprecated" line is a
  harmless action-runtime warning, not our build).
- **npm is Apple-hardened** (blocks package install-scripts). If esbuild/vite break on a fresh
  install, `npm approve-scripts esbuild && npm rebuild esbuild`.

## Phased milestones

- **Phase 0 — Foundation & parity (no UI). ✅ DONE (2026-07-10).** Scaffolded
  Vite+Svelte 5+TS+Vitest+PWA; deployed the shell to prove the `/fallingfences/` subpath;
  ported `SeededRNG` + `AngleNormalizer`; built the Python-oracle fixtures. Exit gate met:
  30 parity tests green (incl. `swiftInt`).
- **Phase 1 — Standard MVP (target).** Full loop: home → pick preset lock → dial → probe →
  graph → solve → score. Ports: `WheelFactory`, `ContactPointCalculator`, `WheelPositionEngine`,
  `SolveScoreCalculator`, `GameState`, `locks` store, and views `StartScreenView` (preset picker
  only), `ManipulationScreen` (full-parity layouts: compact/tabbed on narrow, split/sidebar on
  wide, breakpoint-driven), `DialRingView` (canvas),
  `ContactGraphView` (canvas), `ScanSidebarView`, `PostSolveSheetView`, `SettingsView`.
  Single-pointer drag → dial rotation.
- **Phase 2 — Standard depth.** Isolation tests, auto-probe, multi-scan trees, wheel notes,
  polar `CircularGraphView`, custom lock creation.
- **Phase 3 — Progression.** `ProgressionSheetView`, ranks (best-effort persistence).
- **Phase 4 — Ultra tier.** `UltraProbeEngine`, `UltraManipulationView`, and the hard part:
  `UltraGraphGestureOverlay` (concurrent 1-finger drag / 2-finger pan / pinch) → a Pointer
  Events state machine in one isolated `render/ultraGestures.ts` module.

## Hardest risks + mitigation

1. **RNG determinism** (highest impact) — BigInt everywhere; exact `swift_int` rejection;
   preserve draw order. Mitigate with the parity fixture suite as a CI gate.
2. **Trig not bit-identical** — tolerances for trig-derived values only.
3. **Canvas perf on live dial drag** — single `requestAnimationFrame` loop coalescing
   pointermove; DPR-scaled canvas; static (axes) vs dynamic layer split; decimate long histories.
4. **Ultra multi-touch** (Phase 4) — `Map<pointerId,pos>`, classify on 2nd pointerdown,
   `setPointerCapture` + `touch-action:none`. Isolated + unit-tested; does not block MVP.
5. **Pages subpath** — prove deploy in Phase 0.

## Trim for v1

Standard tier only; defer isolation/auto-probe/multi-scan/custom-creation to Phase 2; polar
graph to Phase 2; particles optional; no native-save import; no solved-lock archive or profile
library. (Layout parity is NOT trimmed — see Decisions: distinct compact/wide layouts from the
start.)

## Verification

- **Phase 0 gate:** `npm test` (Vitest) — RNG raw-sequence + `swift_int` fixtures green; empty
  PWA installs from the live `perrien.github.io/fallingfences/` URL on an iPhone.
- **Phase 1 gate:** parity suite green for all standard-tier wheel/height fixtures; manual
  end-to-end play (generate → dial → probe → graph reads correctly → solve fires → score matches
  the Swift `SolveScoreCalculator` for the same inputs); reload mid-session restores from
  IndexedDB; offline (airplane mode) still launches the installed PWA.
