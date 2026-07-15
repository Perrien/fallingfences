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
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
    gap: 0.35rem;
    align-content: start;
    overflow-y: auto;
    min-width: 0;
  }
  .wheel {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.05rem;
    padding: 0.35rem 0.2rem;
    border-radius: 8px;
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
    font-size: 0.68rem;
    color: var(--text-secondary);
  }
  .p {
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
