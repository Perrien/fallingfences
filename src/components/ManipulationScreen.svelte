<script lang="ts">
  import type { GameStore } from '../state/GameStore.svelte';
  import Dial from './Dial.svelte';
  import ContactGraph from './ContactGraph.svelte';
  import CircularGraph from './CircularGraph.svelte';
  import SolveSheet from './SolveSheet.svelte';
  import IsolationPanel from './IsolationPanel.svelte';
  import IsolationTests from './IsolationTests.svelte';
  import Candidates from './Candidates.svelte';

  let { store, onExit }: { store: GameStore; onExit: () => void } = $props();

  let showGates = $state(false); // debug aid
  let showLCP = $state(true);
  let showWidth = $state(false);
  let amplified = $state(false);
  let sheetDismissed = $state(false);
  let dialView = $state<'dial' | 'notes'>('dial'); // dial box ↔ candidate/notes toggle

  // Wide (Mac/iPad): graph on top, dial + controls side-by-side below.
  // Narrow (iPhone): graph on top, tabbed Dial/Controls below.
  let isWide = $state(false);
  let tab = $state<'dial' | 'controls' | 'isolation'>('dial');

  $effect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const update = () => (isWide = mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  });
</script>

{#snippet dialPane()}
  <div class="dial-pane">
    <div class="dial-box">
      <div class="dial-header">
        <!-- Wheel positions shown outermost-first (W1 = first digit dialed). -->
        <span class="wheel-readout">{store.wheelPositions.slice().reverse().map((p) => p.toFixed(0)).join(' – ')}</span>
        <div class="seg">
          <button class:on={dialView === 'dial'} onclick={() => (dialView = 'dial')} title="Dial" aria-label="Dial">◎</button>
          <button class:on={dialView === 'notes'} onclick={() => (dialView = 'notes')} title="Candidates & notes" aria-label="Candidates & notes">✎</button>
        </div>
      </div>

      {#if dialView === 'dial'}
        <div class="dial-body">
          <Dial
            numberRange={store.numberRange}
            dialPosition={store.dialPosition}
            contactAreaCenter={store.profile.contactAreaCenter}
            contactAreaWidth={store.profile.contactAreaWidth}
            solved={store.solvePhase === 'solved'}
            flashCounter={store.ledFlashCounter}
            onRotate={(d, v) => store.rotate(d, v)}
            onProbe={() => store.probeNow()}
          />
          {#if store.solvePhase === 'solved'}
            <p class="hint open">Cracked! 🎉</p>
          {:else}
            <p class="hint">Dial the combination — sweep clockwise through the top to open.</p>
          {/if}
        </div>
      {:else}
        <Candidates {store} />
      {/if}
    </div>
  </div>
{/snippet}

{#snippet controlsPane()}
  <div class="controls-pane">
    <IsolationPanel {store} />

    <details class="debug" bind:open={showGates}>
      <summary>Debug: show gate positions</summary>
      <p>Gates: {store.gatePositions.slice().reverse().map((g) => g.toFixed(0)).join(' · ')}</p>
      <button onclick={() => store.debugAlignToGates()}>Align wheels to gates</button>
    </details>
  </div>
{/snippet}

{#snippet isolationPane()}
  <div class="isolation-pane">
    <IsolationTests {store} />
  </div>
{/snippet}

<main>
  <header>
    <button class="link" onclick={onExit}>‹ Locks</button>
    <div class="meta">
      <span>Difficulty {String(store.difficultyRating).padStart(4, '0')}</span>
      <span>{store.profile.wheelCount} wheels · dial {store.numberRange}</span>
    </div>
  </header>

  <div class="graph">
    <div class="graph-head">
      <label><input type="checkbox" bind:checked={showLCP} /> LCP</label>
      <label><input type="checkbox" bind:checked={showWidth} /> Width</label>
      <label><input type="checkbox" bind:checked={amplified} /> Amplify</label>
    </div>
    {#if isWide}
      <ContactGraph
        probeHistory={store.probeHistory}
        numberRange={store.numberRange}
        contactAreaCenter={store.profile.contactAreaCenter}
        contactAreaWidth={store.profile.contactAreaWidth}
        {showLCP}
        {showWidth}
        {amplified}
      />
    {:else}
      <CircularGraph
        probeHistory={store.probeHistory}
        numberRange={store.numberRange}
        contactAreaCenter={store.profile.contactAreaCenter}
        contactAreaWidth={store.profile.contactAreaWidth}
        dialPosition={store.dialPosition}
        {showLCP}
        {showWidth}
        {amplified}
      />
    {/if}
  </div>

  {#if isWide}
    <div class="wide-body">
      {@render dialPane()}
      {@render controlsPane()}
      {@render isolationPane()}
    </div>
  {:else}
    <div class="tabs">
      <button class:active={tab === 'dial'} onclick={() => (tab = 'dial')}>Dial</button>
      <button class:active={tab === 'controls'} onclick={() => (tab = 'controls')}>Controls</button>
      <button class:active={tab === 'isolation'} onclick={() => (tab = 'isolation')}>Isolation</button>
    </div>
    {#if tab === 'dial'}
      {@render dialPane()}
    {:else if tab === 'controls'}
      {@render controlsPane()}
    {:else}
      {@render isolationPane()}
    {/if}
  {/if}
</main>

{#if store.solveScore && !sheetDismissed}
  <SolveSheet
    result={store.solveScore}
    efficiency={store.efficiency}
    manualSweepCount={store.manualSweepCount}
    lifetimeProbeCount={store.lifetimeProbeCount}
    gatePositions={store.gatePositions.slice().reverse()}
    difficulty={store.difficultyRating}
    onNewLock={onExit}
    onClose={() => (sheetDismissed = true)}
  />
{/if}

<style>
  main {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
  }
  header {
    width: min(96vw, 1000px);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .link {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 1rem;
    cursor: pointer;
    padding: 0;
  }
  .meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  /* Graph spans the top at all sizes. */
  .graph {
    width: min(96vw, 1200px);
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .graph-head {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  .graph-head label {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  /* Wide: three panes below the graph — Dial | Controls | Isolation. */
  .wide-body {
    width: min(96vw, 1200px);
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
    justify-content: center;
  }
  .wide-body .dial-pane {
    flex: 0 0 auto;
  }
  .wide-body .controls-pane {
    flex: 1 1 0;
    max-width: 420px;
  }
  .wide-body .isolation-pane {
    flex: 1 1 0;
    max-width: 480px;
  }
  .isolation-pane {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .dial-pane {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }
  .dial-box {
    width: 100%;
    max-width: 400px;
    border: 1px solid var(--divider);
    border-radius: var(--radius-lg);
    background: var(--card);
    overflow: hidden;
  }
  .dial-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--panel);
    border-bottom: 1px solid var(--divider);
  }
  .wheel-readout {
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--text);
  }
  .seg {
    display: flex;
    border: 1px solid var(--divider);
    border-radius: 8px;
    overflow: hidden;
  }
  .seg button {
    padding: 0.25rem 0.6rem;
    border: none;
    background: var(--card);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.95rem;
  }
  .seg button.on {
    background: var(--accent-blue);
    color: #fff;
  }
  .dial-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
  }
  .controls-pane {
    width: 100%;
    max-width: 500px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  /* Narrow: tab switcher between Dial and Controls. */
  .tabs {
    display: flex;
    gap: 0.5rem;
    width: min(96vw, 460px);
  }
  .tabs button {
    flex: 1;
    padding: 0.6rem;
    border-radius: 10px 10px 0 0;
    border: 1px solid var(--divider);
    border-bottom: none;
    background: var(--panel);
    color: var(--text-secondary);
    cursor: pointer;
  }
  .tabs button.active {
    background: var(--card);
    color: var(--text);
    border-color: var(--accent-blue);
  }

  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  .hint.open {
    color: var(--solve);
    font-weight: 700;
  }
  button {
    padding: 0.6rem 1rem;
    border-radius: 10px;
    border: 1px solid var(--divider);
    background: var(--card);
    color: var(--text);
    cursor: pointer;
    font-size: 0.95rem;
  }
  .debug {
    font-size: 0.8rem;
    color: var(--text-secondary);
    width: 100%;
    max-width: 460px;
  }
  .debug summary {
    cursor: pointer;
  }
</style>
