<script lang="ts">
  // Thumbwheel: vertical drag → integer step deltas; ±1 buttons for fine control. Wrapping
  // is handled by the caller (store.setPosition → normalizePosition). Self-contained pointer
  // state machine (setPointerCapture + rAF flush), mirroring Dial's down/move/up.
  let {
    value,
    numberRange,
    onChange,
  }: {
    value: number;
    numberRange: number;
    onChange: (v: number) => void;
  } = $props();

  const PX_PER_STEP = 7; // vertical pixels per integer step (drag up = increase)

  let padEl: HTMLDivElement;
  let dragging = false;
  let startY = 0;
  let startValue = 0;
  let pendingValue: number | null = null;
  let rafScheduled = false;

  function flush() {
    rafScheduled = false;
    if (pendingValue !== null) {
      onChange(pendingValue);
      pendingValue = null;
    }
  }

  function down(e: PointerEvent) {
    dragging = true;
    startY = e.clientY;
    startValue = value;
    padEl.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!dragging) return;
    const steps = Math.round((startY - e.clientY) / PX_PER_STEP); // up = +
    if (steps === 0) return;
    pendingValue = startValue + steps;
    if (!rafScheduled) {
      rafScheduled = true;
      requestAnimationFrame(flush);
    }
  }
  function up(e: PointerEvent) {
    dragging = false;
    try {
      padEl.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }
</script>

<div class="thumb">
  <button class="step" aria-label="Increase position" onclick={() => onChange(value + 1)}>▲</button>
  <div
    class="pad"
    bind:this={padEl}
    role="slider"
    tabindex="0"
    aria-label="Wheel position"
    aria-valuenow={value}
    aria-valuemin={0}
    aria-valuemax={numberRange - 1}
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
    onkeydown={(e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onChange(value + 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onChange(value - 1);
      }
    }}
  >
    <span class="val">{value}</span>
    <span class="hint">drag</span>
  </div>
  <button class="step" aria-label="Decrease position" onclick={() => onChange(value - 1)}>▼</button>
</div>

<style>
  .thumb {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.3rem;
    width: 72px;
  }
  .step {
    padding: 0.3rem 0;
    border-radius: 8px;
    border: 1px solid var(--divider);
    background: var(--card);
    color: var(--text);
    cursor: pointer;
    font-size: 0.8rem;
  }
  .step:active {
    background: var(--chip);
  }
  .pad {
    flex: 1;
    min-height: 84px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
    border-radius: 10px;
    border: 1px solid var(--divider);
    background: var(--panel);
    color: var(--text);
    cursor: ns-resize;
    touch-action: none;
    user-select: none;
  }
  .val {
    font-size: 1.5rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    font-family: var(--font-mono);
  }
  .hint {
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-secondary);
  }
</style>
