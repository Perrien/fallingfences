# Porting Falling Fences to an Installable PWA

*Temporary porting doc — lives in this repo only until the port is complete.*

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
├── src/{models,sim,state,persistence,render,components}/  App.svelte  main.ts
├── test/{vectors,parity}/         ← parity vectors (committed) + Vitest suites
├── static/                        ← manifest, icons (copy from Swift AppIcon PNGs)
├── vite.config.ts                 ← base:'/fallingfences/' + vite-plugin-pwa
├── package.json  tsconfig.json
├── .github/workflows/deploy.yml   ← build + deploy to Pages
└── WebPWAPortPlan.md              ← this doc (temporary)
```

**Deploy:** GitHub Actions on push to `main` → `npm ci && npm run build` →
`upload-pages-artifact`(`dist`) → `deploy-pages`. Enable in repo **Settings → Pages → Source:
GitHub Actions**. **Critical:** Pages serves under `/fallingfences/`, so `base`, PWA `scope`,
and `start_url` must all be `/fallingfences/` or assets 404.

## Cross-repo parity handoff

The reference oracle (`diagnostic_sim.py` + Swift parity tests) stays in the SafeCracking repo;
this repo cannot reference it directly. Handoff:
1. In the SafeCracking repo, add a vector-export step (Swift test or reuse `diagnostic_sim.py`)
   that emits JSON for ~30 seed/profile combos: expected base heights, oval freqs, false gates,
   sampled noise, and heights at test positions.
2. **Copy those JSON fixtures once** into this repo's `test/vectors/`.
3. (Optional) copy `diagnostic_sim.py` in as a tooling script for regenerating fixtures.
Vitest here asserts the TS engine reproduces the fixtures.

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

## Phased milestones

- **Phase 0 — Foundation & parity (no UI).** Scaffold Vite+Svelte+TS+Vitest+PWA; deploy an
  empty shell to prove the `/fallingfences/` subpath config end-to-end; port `SeededRNG` +
  `AngleNormalizer`; import parity fixtures from SafeCracking. Exit gate: RNG + `swift_int`
  parity green.
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
