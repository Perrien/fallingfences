<script lang="ts">
  import type { GameStore } from '../state/GameStore.svelte';

  let { store }: { store: GameStore } = $props();

  // Per-wheel lock state (position is player-chosen). One wheel is the "test" wheel — it's
  // left free and charted; the others can be locked at chosen positions.
  let locks = $state<{ locked: boolean; pos: number }[]>([]);
  let testWheel = $state(0);
  let start = $state(0);
  let end = $state(0);
  let step = $state(2);
  let initialized = false;

  $effect(() => {
    if (locks.length !== store.wheelCount) {
      locks = Array.from({ length: store.wheelCount }, () => ({ locked: false, pos: 0 }));
    }
    if (!initialized) {
      initialized = true;
      testWheel = store.selectedWheelIndex;
      end = store.numberRange - 1;
    }
  });

  function selectTest(i: number) {
    testWheel = i;
    store.setSelectedWheel(i);
  }

  function run() {
    const map = new Map<number, number>();
    locks.forEach((l, i) => {
      if (i !== testWheel && l.locked) map.set(i, l.pos);
    });
    store.autoProbe(map, Number(start), Number(step), Number(end), testWheel);
  }
</script>

<section class="iso">
  <div class="iso-head">Isolation · auto-probe</div>

  <div class="wheels">
    {#each locks as l, i (i)}
      <div class="wheel-row" class:test={testWheel === i}>
        <label class="testradio">
          <input type="radio" name="testwheel" checked={testWheel === i} onchange={() => selectTest(i)} />
          Wheel {i + 1}
        </label>
        {#if testWheel === i}
          <span class="state test-state">testing · charted</span>
        {:else}
          <label class="lockbox"><input type="checkbox" bind:checked={l.locked} /> lock</label>
          <input class="pos" type="number" min="0" max={store.numberRange - 1} bind:value={l.pos} disabled={!l.locked} />
          <span class="state">{l.locked ? `@ ${l.pos}` : 'free'}</span>
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
    <div class="run-col">
      <button class="clear" onclick={() => store.erase()}>Clear</button>
      <button class="run" onclick={run}>Run auto-probe</button>
    </div>
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
    font-size: 0.85rem;
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
  .run-col {
    margin-left: auto;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.35rem;
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
