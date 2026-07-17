<script lang="ts">
  // Wheel selector strip. Raw array order (W1 = wheels[0] = cam-adjacent) — Ultra's
  // intentional numbering. Wraps to 2–3 rows on wide screens and horizontal-scrolls in a
  // single row on phone landscape, all via CSS (no JS branch).
  let {
    wheelPositions,
    setFlags,
    flatWheels,
    primarySelected,
    onSelect,
  }: {
    wheelPositions: number[];
    setFlags: boolean[];
    flatWheels: boolean[];
    primarySelected: number;
    onSelect: (i: number) => void;
  } = $props();
</script>

<div class="strip">
  {#each wheelPositions as pos, i}
    <button
      class="wheel"
      class:selected={i === primarySelected}
      class:flat={flatWheels[i]}
      aria-pressed={i === primarySelected}
      onclick={() => onSelect(i)}
    >
      <span class="w">W{i + 1}</span>
      <span class="p">{pos}</span>
      <span class="led" class:on={setFlags[i]} aria-hidden="true"></span>
    </button>
  {/each}
</div>

<style>
  .strip {
    flex: 1 1 auto;
    display: grid;
    /* Up to 2 rows of 15, spanning the full width next to the SET button. */
    grid-template-columns: repeat(15, 1fr);
    gap: 0.3rem;
  }
  .wheel {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.15rem;
    padding: 0.55rem 0.1rem;
    min-width: 0;
    border-radius: 7px;
    border: 1px solid var(--divider);
    background: var(--card);
    color: var(--text);
    cursor: pointer;
    transition: border-color 0.12s, opacity 0.12s;
  }
  .wheel.selected {
    border-color: var(--accent-blue);
    box-shadow: 0 0 0 1px var(--accent-blue) inset;
  }
  .wheel.flat {
    opacity: 0.4;
  }
  .w {
    font-size: 0.6rem;
    line-height: 1;
    color: var(--text-secondary);
  }
  .p {
    font-size: 0.85rem;
    line-height: 1.1;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    font-family: var(--font-mono);
  }
  .led {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--divider);
  }
  .led.on {
    background: #2fbf5f;
    box-shadow: 0 0 4px #2fbf5f;
  }
</style>
