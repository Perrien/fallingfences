<script lang="ts">
  import type { GameStore } from '../state/GameStore.svelte';

  let { store }: { store: GameStore } = $props();

  // Lock config + test-wheel selection are shared via the store (so "Lock to Candidates" in
  // the notes panel can drive them). Only the sweep range is local.
  let start = $state(0);
  let end = $state(0);
  let step = $state(2);
  let initialized = false;

  $effect(() => {
    if (!initialized && store.numberRange > 0) {
      initialized = true;
      end = store.numberRange - 1;
    }
  });

  function run() {
    const map = new Map<number, number>();
    store.autoProbeLocks.forEach((l, i) => {
      if (i !== store.selectedWheelIndex && l.locked) map.set(i, l.pos);
    });
    store.autoProbe(map, Number(start), Number(step), Number(end), store.selectedWheelIndex);
  }

  // Display wheels outermost-first (Wheel 1 = outermost). Internal array is cam-adjacent-first.
  const rows = $derived(Array.from({ length: store.wheelCount }, (_, i) => i).reverse());
</script>

<section class="iso">
  <div class="iso-head">Auto Probe</div>

  <div class="wheels">
    {#each rows as i (i)}
      <div class="wheel-row" class:test={store.selectedWheelIndex === i}>
        <label class="testradio">
          <input type="radio" name="testwheel" checked={store.selectedWheelIndex === i} onchange={() => store.setSelectedWheel(i)} />
          Wheel {store.wheelCount - i}
        </label>
        {#if store.selectedWheelIndex === i}
          <span class="state test-state">testing · charted</span>
        {:else}
          <label class="lockbox"><input type="checkbox" bind:checked={store.autoProbeLocks[i].locked} /> lock</label>
          <input class="pos" type="number" min="0" max={store.numberRange - 1} bind:value={store.autoProbeLocks[i].pos} disabled={!store.autoProbeLocks[i].locked} />
          <span class="state">{store.autoProbeLocks[i].locked ? `@ ${store.autoProbeLocks[i].pos}` : 'free'}</span>
        {/if}
      </div>
    {/each}
  </div>

  <div class="sweep-row">
    <label>start <input type="number" min="0" max={store.numberRange - 1} bind:value={start} /></label>
    <label>end <input type="number" min="0" max={store.numberRange - 1} bind:value={end} /></label>
    <label>step
      <select bind:value={step}>
        <option value={1}>1</option>
        <option value={2}>2</option>
        <option value={5}>5</option>
      </select>
    </label>
  </div>

  <div class="button-row">
    <button class="run" onclick={run}>Run auto-probe</button>
    <button class="clear" onclick={() => store.erase()}>Clear</button>
  </div>

  <p class="muted">
    Pick the wheel to test, lock the others at chosen positions, then run — the test wheel is
    swept and charted; its RCP dip marks that wheel's gate.
  </p>
</section>

<style>
  .iso {
    width: 100%;
    max-width: 460px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    border: 1px solid var(--divider);
    border-radius: var(--radius-lg);
    background: var(--panel);
  }
  .iso-head {
    font-family: var(--font-typewriter);
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-secondary);
  }
  .wheels {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .wheel-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.85rem;
  }
  .testradio {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--text);
    min-width: 6rem;
  }
  .lockbox {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--text-secondary);
  }
  .pos {
    width: 4rem;
    background: var(--card);
    color: var(--text);
    border: 1px solid var(--divider);
    border-radius: 6px;
    padding: 0.2rem 0.3rem;
  }
  .pos:disabled {
    opacity: 0.4;
  }
  .state {
    color: var(--text-tertiary);
    font-size: 0.75rem;
  }
  .test-state {
    color: var(--graph-rcp);
  }
  .sweep-row {
    display: flex;
    align-items: flex-end;
    gap: 0.6rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
    flex-wrap: wrap;
  }
  .sweep-row > label {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .sweep-row input,
  .sweep-row select {
    width: 3.4rem;
    background: var(--card);
    color: var(--text);
    border: 1px solid var(--divider);
    border-radius: 6px;
    padding: 0.2rem 0.3rem;
  }
  .button-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
  }
  .clear {
    padding: 0.35rem 0.8rem;
    border-radius: 8px;
    border: 1px solid var(--divider);
    background: var(--card);
    color: var(--text);
    cursor: pointer;
    font-size: 0.8rem;
  }
  .run {
    padding: 0.4rem 0.8rem;
    border-radius: 8px;
    border: 1px solid var(--accent-blue);
    background: var(--accent-blue);
    color: #fff;
    cursor: pointer;
    font-size: 0.85rem;
  }
  .muted {
    color: var(--text-tertiary);
    font-size: 0.75rem;
    margin: 0;
  }
</style>
