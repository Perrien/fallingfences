<script lang="ts">
  // Playable Ultra tier — one shared responsive layout (iPad + iPhone landscape). Header,
  // fence-height graph, and a controls row (wheel strip + right column of SET / fence
  // indicator / thumbwheel). No X-axis zoom/pan (dropped per the Ultra plan).
  import type { UltraGameStore } from '../state/UltraGameStore.svelte';
  import UltraGraph from './UltraGraph.svelte';
  import WheelStrip from './WheelStrip.svelte';
  import UltraSolveSheet from './UltraSolveSheet.svelte';

  let { store, onExit }: { store: UltraGameStore; onExit: () => void } = $props();

  let sheetDismissed = $state(false);

  const markerPosition = $derived(store.wheelPositions[store.primarySelected] ?? 0);
  const setActive = $derived(store.setFlags[store.primarySelected] ?? false);

  // Delay the solve sheet by the same 0.7s as the graph's spark burst (see UltraGraph),
  // so the celebration is visible before the sheet covers it — matches the app's
  // triggerSolve() gap between the burst and UltraSolveSheetView.
  let sheetReady = $state(false);
  let prevSolved = false;
  $effect(() => {
    if (store.solved && !prevSolved) setTimeout(() => (sheetReady = true), 700);
    prevSolved = store.solved;
  });

  // Non-blocking rotate hint on narrow portrait screens.
  let portrait = $state(false);
  $effect(() => {
    const mq = window.matchMedia('(orientation: portrait) and (max-width: 820px)');
    const update = () => (portrait = mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  });
  let hintDismissed = $state(false);
</script>

<main>
  <header>
    <button class="link" onclick={onExit}>‹ Locks</button>
    <span class="meta">
      Difficulty {String(store.difficultyRating).padStart(4, '0')} · {store.wheelCount} wheels · dial {store.numberRange}
    </span>
  </header>

  <div class="graph">
    <UltraGraph
      sweepData={store.sweepData}
      numberRange={store.numberRange}
      staticYLow={store.staticYLow}
      staticYHigh={store.staticYHigh}
      {markerPosition}
      solved={store.solved}
      onScrub={(v) => store.setPosition(v)}
    />
  </div>

  <div class="lower">
    <WheelStrip
      wheelPositions={store.wheelPositions}
      setFlags={store.setFlags}
      flatWheels={store.flatWheels}
      primarySelected={store.primarySelected}
      onSelect={(i) => store.select(i)}
    />
    <button class="set" class:on={setActive} aria-pressed={setActive} onclick={() => store.toggleSet()}>
      SET
    </button>
  </div>

  {#if portrait && !hintDismissed}
    <button class="rotate-hint" onclick={() => (hintDismissed = true)}>
      Rotate to landscape for the best view · tap to dismiss
    </button>
  {/if}
</main>

{#if store.solveScore !== null && sheetReady && !sheetDismissed}
  <UltraSolveSheet
    score={store.solveScore}
    wheelCount={store.wheelCount}
    gatePositions={store.gatePositions}
    difficulty={store.difficultyRating}
    onNewLock={onExit}
    onClose={() => (sheetDismissed = true)}
  />
{/if}

<style>
  main {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.6rem;
    box-sizing: border-box;
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    flex: 0 0 auto;
  }
  .link {
    background: none;
    border: none;
    color: var(--text);
    cursor: pointer;
    font-size: 1rem;
    padding: 0;
  }
  .meta {
    color: var(--text-secondary);
    font-size: 0.85rem;
  }
  .graph {
    flex: 1 1 auto;
    min-height: 0;
  }
  /* Wheel strip + SET button share one row below the graph — SET stretches to match
     whatever height the strip naturally takes (its own height grew a bit — see
     WheelStrip's .wheel padding — now that the old controls row above it is gone). */
  .lower {
    flex: 0 0 auto;
    display: flex;
    gap: 0.5rem;
    align-items: stretch;
  }
  .set {
    flex: 0 0 auto;
    width: 4.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    border: 1px solid var(--divider);
    background: var(--card);
    color: var(--text);
    cursor: pointer;
    font-weight: 700;
    font-size: 1rem;
    letter-spacing: 0.08em;
  }
  .set.on {
    background: #2fbf5f;
    border-color: #2fbf5f;
    color: #06210f;
  }
  .rotate-hint {
    position: fixed;
    left: 50%;
    bottom: 1rem;
    transform: translateX(-50%);
    background: var(--card);
    border: 1px solid var(--divider);
    border-radius: 999px;
    padding: 0.4rem 0.9rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
    cursor: pointer;
    z-index: 5;
  }
</style>
