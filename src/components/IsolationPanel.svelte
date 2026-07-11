<script lang="ts">
  import type { GameStore } from '../state/GameStore.svelte';

  let { store }: { store: GameStore } = $props();

  // Per-wheel lock state (position is player-chosen, not hidden). Initialized reactively
  // from the wheel count so we don't capture a stale value in the $state initializer.
  let locks = $state<{ locked: boolean; pos: number }[]>([]);
  let start = $state(0);
  let step = $state(2);

  $effect(() => {
    if (locks.length !== store.wheelCount) {
      locks = Array.from({ length: store.wheelCount }, () => ({ locked: false, pos: 0 }));
    }
  });

  const freeCount = $derived(locks.filter((l) => !l.locked).length);

  function run() {
    const map = new Map<number, number>();
    locks.forEach((l, i) => {
      if (l.locked) map.set(i, l.pos);
    });
    store.autoProbe(map, Number(start), Number(step), null);
  }
</script>

<section class="iso">
  <div class="iso-head">
    <span>Isolation · auto-probe</span>
    <span class="tracked-tag">charting Wheel {store.selectedWheelIndex + 1}</span>
  </div>

  <div class="wheels">
    {#each locks as l, i (i)}
      <div class="wheel-row" class:free={!l.locked}>
        <label class="lockbox">
          <input type="checkbox" bind:checked={l.locked} />
          Wheel {i + 1}
        </label>
        <input
          class="pos"
          type="number"
          min="0"
          max={store.numberRange - 1}
          bind:value={l.pos}
          disabled={!l.locked}
        />
        <span class="state">{l.locked ? `locked @ ${l.pos}` : 'free (charted)'}</span>
      </div>
    {/each}
  </div>

  <div class="sweep-row">
    <label>start <input type="number" min="0" max={store.numberRange - 1} bind:value={start} /></label>
    <label>step
      <select bind:value={step}>
        <option value={1}>1</option>
        <option value={2}>2</option>
        <option value={5}>5</option>
      </select>
    </label>
    <button class="run" onclick={run} disabled={freeCount === 0}>Run auto-probe</button>
  </div>

  <p class="muted">
    Lock all wheels but one at chosen positions, then run — the free wheel is swept and charted;
    its RCP dip marks that wheel's gate.
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
    border-radius: 12px;
    background: var(--panel);
  }
  .iso-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  .tracked-tag {
    color: var(--graph-rcp);
    font-size: 0.78rem;
  }
  .wheels {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .wheel-row {
    display: grid;
    grid-template-columns: auto 4.5rem 1fr;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
  }
  .lockbox {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--text);
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
  .wheel-row.free .state {
    color: var(--graph-rcp);
  }
  .sweep-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
    flex-wrap: wrap;
  }
  .sweep-row label {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .sweep-row input,
  .sweep-row select {
    width: 3.5rem;
    background: var(--card);
    color: var(--text);
    border: 1px solid var(--divider);
    border-radius: 6px;
    padding: 0.2rem 0.3rem;
  }
  .run {
    margin-left: auto;
    padding: 0.4rem 0.8rem;
    border-radius: 8px;
    border: 1px solid var(--accent-blue);
    background: var(--accent-blue);
    color: #fff;
    cursor: pointer;
    font-size: 0.85rem;
  }
  .run:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .muted {
    color: var(--text-tertiary);
    font-size: 0.75rem;
    margin: 0;
  }
</style>
