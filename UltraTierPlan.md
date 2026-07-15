# Web Build — Ultra Tier Port (Phase 4)

*Companion to `WebPWAPortPlan.md`. Decisions: single shared iPad/iPhone layout (iPhone landscape);
input is phased (thumbwheel + tap first, graph drag optional later); **X-axis zoom/pan dropped
entirely** — thumbwheel gives exact integer steps, so the Swift app's concurrent multi-touch
pinch/pan system is out of scope.*

## Context

The web build has the standard dial tier fully ported and playable. The remaining major tier is
**Ultra**: an *analytical* mode with a completely different UI. Instead of dialing and probing, the
player sees a **graph of fence height vs. dial position** for a selected wheel, isolates each wheel,
reads its gate (the low point), sets each wheel's position onto its gate, and the lock **auto-opens**
when every wheel is within `gateWidth/2` of its gate. Typical lock: 10 wheels, dial range 100. No
dialing, no probe history.

### Reuse — already present in the web codebase (do NOT rewrite)
- `src/models/LockProfile.ts` — interface already has every Ultra field (`baseHeightsByRank`,
  `ovalFrequencyRange`, `ovalBumpPositionOverride`, `gateSeamBuffer`). Missing only an `ultra()` preset.
- `src/models/Combination.ts` — `makeRandom({…, seamBuffer})` already supports the seam buffer.
- `src/sim/WheelFactory.ts` — `makeWheels` already handles draw-then-override oval bump, variable
  `ovalFrequencyRange`, `gateSeamBuffer`, and `halvingBase` false-gate distribution. **No changes.**
- `src/sim/ContactPointCalculator.ts` — `wheelHeight(wheel, profile)` is exported; `UltraProbeEngine` reuses it.
- `src/sim/AngleNormalizer.ts` — `circularDistance`, `normalizePosition`.
- `src/models/difficulty.ts` — `difficultyRating(profile)`.
- Patterns to mirror: `src/state/GameStore.svelte.ts` + `src/sim/GameState.ts` (pure engine + reactive
  `$state` wrapper with `sync()`); `src/components/ContactGraph.svelte` / `Dial.svelte` (canvas:
  ResizeObserver → `$effect` → `draw()`, DPR scaling, `cssVar()` tokens, `touch-action:none`,
  pointer state machine); `src/App.svelte` (screen switching); `tools/gen_rng_fixtures.py` +
  `test/parity/wheels.test.ts` (parity oracle).

### Wheel numbering (intentional, matches Swift)
Ultra keeps **raw array order**: `W1 = wheels[0] = cam-adjacent`. Do NOT reverse (that's the
standard tier's convention only).

### Solve / scoring
Ultra solve = `wheelCount × 500`, no efficiency. The web build has **no progression store** (Phase 3
not built) and **no persistence** (deferred). So solve just shows a sheet with the score — no rank
or persistence wiring, matching how the standard tier currently works.

---

## Phase 4a — Sim core + parity (no UI). *Smallest safe first increment.*

**New:** `src/sim/UltraProbeEngine.ts`
**Modify:** `src/models/LockProfile.ts`, `tools/gen_rng_fixtures.py`, `test/parity/wheels.test.ts`
(+ new `test/unit/ultraProbeEngine.test.ts`)

### `ultra(wheelCount = 10, seed = randomSeed())` in `LockProfile.ts`
Port via the existing `base(seed, {…})` helper. **RNG draw order is parity-critical** (draw with
`rng.nextDoubleIn`):
1. `gateWidth = nextDoubleIn(1.5, 2.2)`
2. `surfaceNoise = nextDoubleIn(0.03, 0.05)`
3. `oval = nextDoubleIn(0.10, 0.50)`
4. compute (no draws): `safetyMargin=0.05`, `totalBudget=max(0, 1-oval-surfaceNoise-0.05)`,
   `denom=max(wheelCount-1,1)`, `stepCap=min(0.08, 1/denom, totalBudget/denom)`, `stepFloor=min(0.02, stepCap)`.
5. `baseHeights=[1.0]`; loop `max(wheelCount-1,0)`×: `step = stepFloor < stepCap ? nextDoubleIn(stepFloor, stepCap) : stepFloor`
   (**draw only when `stepFloor < stepCap`**), push `last - step`.
6. `spread = 1 - baseHeights.at(-1)`.

Override fields (rest come from `base()` defaults): `wheelCount`, `numberRange:100`,
`heightOrdering:{kind:'random'}`, `heightSpread:spread`, `baseHeightsByRank:baseHeights`,
`surfaceNoiseAmplitude:surfaceNoise`, `noiseHarmonicFrequencyRange:[3.0,10.0]` (⚠ base defaults
`[1.0,5.0]` — must override), `ovalEccentricity:oval`, `ovalFrequencyRange:[0.25,2.0]`,
`ovalBumpPositionOverride:0.0`, `gateWidth`, `gateSeamBuffer:gateWidth`,
`falseGateConfig:{countRange:[1,3], depthRatioRange:[0.20,0.55], width:null, distribution:{kind:'halvingBase', probability:0.95}, eligibleWheelIndices:null}`,
`contactAreaCenter:50`, `contactAreaWidth:(30/360)*100`, `rcpSensitivity:2.5`, `lcpSensitivity:1.0`.

### `UltraProbeEngine.ts` (stateless, mirrors `AngleNormalizer` export style)
- `sweep(freeIndices: Set<number>, wheels: Wheel[], profile): number[]` — for `p` in
  `[0, numberRange)`: for each wheel use `{...w, currentPosition: p}` if `freeIndices.has(i)` else `w`
  as-is; compute `wheelHeight` for all; push `Math.max(...)`. **Must not mutate the caller's wheels.**
- `fenceIndex(freeIndices, markerPosition, wheels, profile): number` — same copy-not-mutate at
  `markerPosition`; return argmax index (first on ties — match Swift `max(by:)`).

### Parity
Add `ultra()` to `gen_rng_fixtures.py` (replicate steps 1–6, **including the conditional step draw**).
Add a `"ultra"` entry to `PROFILES` (fixed seed; use **two seeds** so both branches of the
`stepFloor < stepCap` conditional get coverage) with any fixed 10-element combination (combination is
crypto-seeded → parity-free). Existing height/false-gate/base-height assertions cover `makeWheels`
automatically. Also emit raw profile scalars (`gateWidth`, `surfaceNoiseAmplitude`,
`ovalEccentricity`, `baseHeightsByRank`) and assert `ultra(10, seed)` reproduces them to 1e-10 in
`wheels.test.ts` (or a new `ultraProfile.test.ts`). First execution step: `npm run fixtures` then `npm test`.

### Unit tests (`ultraProbeEngine.test.ts`)
`sweep` length == numberRange; no-mutation (caller `wheels[i].currentPosition` unchanged); pointwise-max
of two disjoint-gate wheels; `fenceIndex` argmax + tie-break.

---

## Phase 4b — State layer + routing + Start entry

**New:** `src/sim/UltraGameState.ts` (pure), `src/state/UltraGameStore.svelte.ts` (reactive)
**Modify:** `src/App.svelte`, `src/components/StartScreen.svelte` (+ `test/unit/ultraGameState.test.ts`)

### `UltraGameState` (pure, no runes)
Fields: `profile`, `combination`, `wheels` (from `makeWheels`), `wheelPositions:number[]` (init 0),
`setFlags:boolean[]` (init false), `selectedIndices:Set<number>`, `primarySelected:number` (init 0),
`solved:boolean`, `staticYLow`/`staticYHigh`, readonly `difficultyRating`. Getters `numberRange`,
`wheelCount`, `gatePositions`.
Methods: `computeStaticYBounds()` (sweep each wheel alone, `staticYHigh=globalMax*1.05`,
`staticYLow=-0.05`); `select(i)`; `sweepSelected()`; `fenceIndex(marker)`;
`setPositionForSelection(v)` (round + `normalizePosition` to `[0,numberRange-1]`, write to every
selected wheel's `wheelPositions[i]` **and** `wheels[i].currentPosition`, then auto-solve if
`isAligned`); `toggleSet()`; `detectFlatWheels()→boolean[]` (`(max-min)/ySpan < 0.005`); `isAligned()`
(`every` wheel `circularDistance(pos, gate, range) <= gateWidth/2`).
Keep `wheelPositions` and `wheels[i].currentPosition` in lockstep — the latter is what the engine reads.

### `UltraGameStore.svelte.ts` (mirror `GameStore`)
Private `game`; `$state`: `wheelPositions`, `setFlags`, `primarySelected`, `solved`, `flatWheels`,
`sweepData`. Readonly `profile`, `difficultyRating`, `staticYLow/High`; getters `numberRange`,
`wheelCount`, `gatePositions`. Actions (each → `sync()`): `select(i)`, `setPosition(v)`,
`nudge(±1)`, `toggleSet()`. `sync()` republishes state, recomputes `sweepData = game.sweepSelected()`
and `flatWheels = game.detectFlatWheels()`, and computes the `wheelCount*500` solve payload once when
`solved` first flips true.

### Routing (`App.svelte`)
Replace `store: GameStore | null` with a discriminated union:
`{kind:'start'} | {kind:'dial'; store: GameStore} | {kind:'ultra'; store: UltraGameStore}`.
Render `StartScreen` / `ManipulationScreen` / new `UltraScreen`. Broaden `StartScreen.onStart` to pass
the discriminated result (or add `onStartUltra`).

### Start entry (`StartScreen.svelte`)
Add a dedicated `startUltra()` (can't reuse the `presets` array whose `make` returns a plain profile):
build `ultra(10, randomSeed())` + `makeRandom({wheelCount, numberRange, forbiddenCenter:contactAreaCenter,
forbiddenHalfWidth:(15/360)*numberRange, seamBuffer:gateSeamBuffer})` → `new UltraGameStore(...)`.
Render as a distinct card ("Ultra — 10 wheels · analytical / graph reading").

### Unit tests (`ultraGameState.test.ts`)
`isAligned` boundary at exactly `gateWidth/2`; `setPositionForSelection` snap/clamp/wrap + auto-solve;
`detectFlatWheels` threshold; static Y bounds values.

---

## Phase 4c — Playable Ultra screen (single responsive layout, static graph)

**New:** `src/components/UltraScreen.svelte`, `UltraGraph.svelte`, `WheelStrip.svelte`,
`Thumbwheel.svelte`, `UltraSolveSheet.svelte`, `src/render/ultraGraphModel.ts` (pure)

### One shared layout (iPad + iPhone landscape) — no dual component trees
```
main (column, 100dvh)
├── header       (‹ Locks · "Difficulty NNNN · 10 wheels · dial 100")
├── UltraGraph   (flex: 1 1 auto — fills top area)
└── controls row (flex row)
    ├── WheelStrip   (flex:1; CSS grid repeat(auto-fill,minmax(btn,1fr)); wraps to 2–3 rows wide,
    │                 horizontal-scroll single row on phone landscape — pure CSS, no JS branch)
    └── right column (fixed width: SET toggle · fence indicator · Thumbwheel)
```
Use `min()`-based widths like `ManipulationScreen`. Non-blocking rotate hint via
`matchMedia('(orientation: portrait) and (max-width: 820px)')` → dismissible "Rotate to landscape" overlay.

### `UltraGraph.svelte` (reuse ContactGraph canvas pattern; **identity X transform — no zoom/pan**)
Props: `sweepData`, `numberRange`, `staticYLow`, `staticYHigh`, `markerPosition`. ResizeObserver →
`$effect` → `draw()` with DPR + `cssVar()`. Render: 5 horizontal grid lines across `[staticYLow,
staticYHigh]`; translucent orange area fill (`--graph-rcp` alpha); orange trace polyline; **gate
markers** (ticks at every index within `1e-9` of the sweep's global min, grouped into segments when
consecutive within 5 positions, with a value label — grouping logic in `ultraGraphModel.ts`);
bright-green vertical marker line at `markerPosition`; X-axis labels every 10. `xFor(pos)` is a plain
linear map (no transform).

### `WheelStrip.svelte`
Props: `wheelPositions`, `setFlags`, `flatWheels`, `primarySelected`, `onSelect(i)`. Buttons `W1..WN`
(raw index+1) showing current position + green SET LED (`setFlags[i]`); dim when `flatWheels[i]`;
highlight selected (border `--accent-blue`). Click → `onSelect`.

### `Thumbwheel.svelte` (self-contained pointer state machine — reuse Dial's down/move/up + `setPointerCapture` + rAF)
Props: `value`, `numberRange`, `onChange`. Vertical drag → integer step deltas (wrap via
`normalizePosition`); ±1 buttons → `onChange(value±1)`.

### Right column & wiring
SET toggle → `store.toggleSet()`; fence indicator shows `store.fenceIndex(markerPosition)` ("Fence:
W{n}"); thumbwheel → `store.setPosition`. `markerPosition = wheelPositions[primarySelected]`. All
position writes funnel through `store.setPosition`. On `store.solved`, show `UltraSolveSheet`
(`wheelCount × 500`, `onNewLock` → start).

### Tests
`test/unit/ultraGraphModel.test.ts` — gate-marker segment grouping + x-label math.
Manual (via `/run`): pick Ultra → 10 wheels, graph plots selected wheel's sweep with static Y bounds,
selecting re-plots, thumbwheel/±1 move green marker + readout, flat wheels dimmed, fence updates,
aligning all within `gateWidth/2` auto-opens showing `5000`.

---

## Phase 4d — Optional follow-up: 1-finger drag-to-scrub on the graph
Add a single-pointer handler on `UltraGraph` that maps drag X → `store.setPosition` for the selected
wheel (velocity-scaled), as an alternative to the thumbwheel. **No pinch, no pan, no zoom** (dropped
per decision). Isolated pointer logic; the thumbwheel already makes the tier fully playable, so this
is purely additive.

## Phase 4e — Polish
Flat-wheel dimming + tooltip; gate-marker label refinement (verify Swift's 5-position grouping /
`1e-9` epsilon); rotate-hint styling; a11y labels + `aria-pressed` on SET; Ultra solve-sheet copy.

---

## Parity / ordering risks
- `noiseHarmonicFrequencyRange` must be overridden to `[3.0,10.0]` (base defaults `[1.0,5.0]`) — same
  draw count, different values; caught by height parity.
- The `stepFloor < stepCap` **conditional draw** must be replicated exactly in the oracle — a missing
  draw desyncs the profile stream. Cover both branches with two fixture seeds.
- `ovalBumpPositionOverride = 0.0` (not null): `makeWheels` still draws then discards — order preserved (confirmed).
- No-mutation contract in `sweep`/`fenceIndex`: the `wheels` array is shared with `UltraGameState`;
  mutating `currentPosition` there corrupts `wheelPositions`. Enforce copies; assert in tests.

## End-to-end verification
1. `npm run fixtures` then `npm test` — parity + unit green (gate for 4a).
2. `npm run build` / typecheck after 4b (discriminated `Screen` union, no `any`).
3. Manual play after 4c (see 4c tests) — confirm auto-open shows `10 × 500 = 5000`.
4. Cross-check `ultra(10, <seed>)` `baseHeightsByRank`/`gateWidth` against the oracle's printed values.

## Build order
**4a → 4b → 4c** delivers a complete, playable, parity-tested Ultra tier. 4d/4e are additive polish.
Start with **4a only** (preset + engine + parity), fully verifiable by `npm test` before any UI.
