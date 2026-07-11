<script lang="ts">
  import type { GameStore } from '../state/GameStore.svelte';

  let { store }: { store: GameStore } = $props();

  let guesses = $state<number[]>([]);
  let result = $state<'none' | 'fail'>('none');

  $effect(() => {
    if (guesses.length !== store.wheelCount) {
      guesses = Array.from({ length: store.wheelCount }, () => 0);
    }
  });

  function test() {
    // On success the solve sheet takes over (store.solveScore is set); on failure, flag it.
    const opened = store.testCombination(guesses.map((g) => Number(g)));
    result = opened ? 'none' : 'fail';
  }
</script>

<section class="entry">
  <div class="head">Enter combination</div>
  <div class="fields">
    {#each guesses as _, i (i)}
      <label>
        <span>W{i + 1}</span>
        <input type="number" min="0" max={store.numberRange - 1} bind:value={guesses[i]} oninput={() => (result = 'none')} />
      </label>
    {/each}
    <button class="test" onclick={test}>Test</button>
  </div>
  {#if result === 'fail'}
    <p class="fail-msg">Didn't open — keep probing.</p>
  {/if}
</section>

<style>
  .entry {
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
  .head {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  .fields {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.5rem;
  }
  .fields label {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.7rem;
    color: var(--text-tertiary);
  }
  .fields input {
    width: 3.2rem;
    background: var(--card);
    color: var(--text);
    border: 1px solid var(--divider);
    border-radius: 6px;
    padding: 0.25rem 0.3rem;
    font-size: 0.95rem;
  }
  .test {
    margin-left: auto;
    padding: 0.45rem 1rem;
    border-radius: 8px;
    border: 1px solid var(--accent-blue);
    background: var(--accent-blue);
    color: #fff;
    cursor: pointer;
  }
  .fail-msg {
    margin: 0;
    font-size: 0.8rem;
    color: var(--graph-rcp);
  }
</style>
