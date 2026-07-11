<script lang="ts">
  import type { GameStore } from '../state/GameStore.svelte';
  import Dial from './Dial.svelte';
  import ContactGraph from './ContactGraph.svelte';

  let { store, onExit }: { store: GameStore; onExit: () => void } = $props();

  let showGates = $state(false); // debug aid until the contact graph lands
  let showWidth = $state(false);

  const phaseLabel = $derived(
    store.solvePhase === 'solved' ? 'OPEN' : store.solvePhase === 'noseDropped' ? 'NOSE DROPPED' : 'MANIPULATING',
  );
</script>

<main>
  <header>
    <button class="link" onclick={onExit}>‹ Locks</button>
    <div class="meta">
      <span>Difficulty {String(store.difficultyRating).padStart(4, '0')}</span>
      <span>{store.profile.wheelCount} wheels · dial {store.numberRange}</span>
    </div>
  </header>

  <div class="stage">
    <Dial
      numberRange={store.numberRange}
      dialPosition={store.dialPosition}
      contactAreaCenter={store.profile.contactAreaCenter}
      contactAreaWidth={store.profile.contactAreaWidth}
      onRotate={(d) => store.rotate(d)}
    />

    <div class={`phase phase-${store.solvePhase}`}>{phaseLabel}</div>

    {#if store.solvePhase === 'noseDropped'}
      <div class="bolt">
        <div class="bolt-fill" style={`width:${Math.round(store.boltTravelProgress * 100)}%`}></div>
      </div>
      <p class="hint">Gates aligned — turn right to retract the bolt.</p>
    {:else if store.solvePhase === 'solved'}
      <p class="hint open">Cracked! 🎉</p>
    {/if}
  </div>

  <div class="controls">
    <button class="primary" onclick={() => store.probeNow()}>Probe</button>
    <button onclick={() => store.sweepAll(0, 2, store.numberRange - 1)}>Sweep all</button>
    <button onclick={() => store.erase()}>Clear</button>
  </div>

  <div class="readout">
    {#if store.currentReading}
      <span>RCP <b>{store.currentReading.rcp.toFixed(2)}</b></span>
      <span>LCP <b>{store.currentReading.lcp.toFixed(2)}</b></span>
      <span>Width <b>{store.currentReading.width.toFixed(2)}</b></span>
    {:else}
      <span class="muted">No reading yet — probe or dial into the contact area.</span>
    {/if}
  </div>

  <div class="graph">
    <div class="graph-head">
      <span>Contact graph</span>
      <label><input type="checkbox" bind:checked={showWidth} /> Width</label>
    </div>
    <ContactGraph
      probeHistory={store.probeHistory}
      numberRange={store.numberRange}
      contactAreaCenter={store.profile.contactAreaCenter}
      contactAreaWidth={store.profile.contactAreaWidth}
      {showWidth}
    />
    <p class="graph-hint muted">
      The dip in RCP (and peak in LCP) marks a gate — the tick + number flags the extreme.
    </p>
  </div>

  <div class="toggles">
    <label><input type="checkbox" bind:checked={store.autoReadingEnabled} onchange={(e) => store.setAutoReading(e.currentTarget.checked)} /> Auto-read on sweep</label>
    <label><input type="checkbox" bind:checked={store.measurementNoiseEnabled} onchange={(e) => store.setMeasurementNoise(e.currentTarget.checked)} /> Measurement noise</label>
    <span class="muted">{store.probeHistory.length} readings</span>
  </div>

  <details class="debug" bind:open={showGates}>
    <summary>Debug: show gate positions</summary>
    <p>Gates: {store.gatePositions.map((g) => g.toFixed(0)).join(' · ')}</p>
    <button onclick={() => store.debugAlignToGates()}>Align wheels to gates</button>
    <p class="muted">Then dial into the contact area (nose drops) and turn right to retract the bolt.</p>
  </details>
</main>

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
    width: min(96vw, 460px);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .link {
    background: none;
    border: none;
    color: #b8a898;
    font-size: 1rem;
    cursor: pointer;
    padding: 0;
  }
  .meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-size: 0.8rem;
    color: #b8a898;
  }
  .stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }
  .phase {
    font-size: 0.8rem;
    letter-spacing: 0.12em;
    font-weight: 700;
    color: #7080a0;
  }
  .phase-noseDropped {
    color: #e0a24a;
  }
  .phase-solved {
    color: #4ac07a;
  }
  .bolt {
    width: min(72vw, 340px);
    height: 8px;
    border-radius: 4px;
    background: #26262b;
    overflow: hidden;
  }
  .bolt-fill {
    height: 100%;
    background: #e0a24a;
    transition: width 0.1s linear;
  }
  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: #b8a898;
  }
  .hint.open {
    color: #4ac07a;
    font-weight: 700;
  }
  .controls {
    display: flex;
    gap: 0.5rem;
  }
  button {
    padding: 0.6rem 1rem;
    border-radius: 10px;
    border: 1px solid #4a4a52;
    background: #26262b;
    color: #f0e4d8;
    cursor: pointer;
    font-size: 0.95rem;
  }
  button.primary {
    background: #3a5bd0;
    border-color: #3a5bd0;
  }
  .readout {
    display: flex;
    gap: 1.25rem;
    font-size: 0.95rem;
  }
  .readout b {
    font-variant-numeric: tabular-nums;
  }
  .toggles {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.85rem;
    color: #b8a898;
    align-items: center;
  }
  .toggles label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .muted {
    color: #7080a0;
  }
  .debug {
    font-size: 0.8rem;
    color: #b8a898;
    max-width: min(96vw, 460px);
  }
  .debug summary {
    cursor: pointer;
  }
  .graph {
    width: min(96vw, 460px);
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .graph-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
    color: #b8a898;
  }
  .graph-head label {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .graph-hint {
    margin: 0;
    font-size: 0.75rem;
  }
</style>
