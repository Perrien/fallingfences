<script lang="ts">
  // Interactive dial: static number ring + a needle pointing at the current dial position.
  // Drag anywhere on the face to rotate. Canvas rendering (per the plan) is a later polish;
  // SVG is fine at this scale and keeps the first playable slice simple.
  let {
    numberRange,
    dialPosition,
    onRotate,
  }: { numberRange: number; dialPosition: number; onRotate: (deltaIncrements: number) => void } = $props();

  let svgEl: SVGSVGElement;
  let dragging = false;
  let lastAngle = 0;

  const C = 100; // center
  const R = 92; // outer radius

  const labelStep = $derived(numberRange <= 40 ? 5 : numberRange <= 60 ? 5 : 10);
  const ticks = $derived(Array.from({ length: numberRange }, (_, i) => i));
  // Needle points at the current dial position; 0 at top, increasing clockwise.
  const needleRad = $derived(((dialPosition / numberRange) * 360 - 90) * (Math.PI / 180));

  function angleOf(e: PointerEvent): number {
    const rect = svgEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
  }
  function down(e: PointerEvent) {
    dragging = true;
    lastAngle = angleOf(e);
    svgEl.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!dragging) return;
    const a = angleOf(e);
    let d = a - lastAngle;
    if (d > 180) d -= 360;
    else if (d < -180) d += 360;
    lastAngle = a;
    // Screen-clockwise drag (d > 0) turns the dial right (CW). In the sim, CW is a
    // negative delta only for the wheel engine — but the number under the index should
    // increase when dragging clockwise, so map clockwise drag to a positive dial delta.
    onRotate((d / 360) * numberRange);
  }
  function up(e: PointerEvent) {
    dragging = false;
    try {
      svgEl.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function tickPos(t: number, r: number) {
    const rad = ((t / numberRange) * 360 - 90) * (Math.PI / 180);
    return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
  }
</script>

<svg
  bind:this={svgEl}
  viewBox="0 0 200 200"
  class="dial"
  role="slider"
  aria-label="Safe dial"
  aria-valuenow={Math.round(dialPosition)}
  aria-valuemin="0"
  aria-valuemax={numberRange}
  tabindex="0"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
>
  <circle cx={C} cy={C} r={R} class="face" />
  {#each ticks as t}
    {@const outer = tickPos(t, R)}
    {@const major = t % labelStep === 0}
    {@const inner = tickPos(t, R - (major ? 12 : 6))}
    <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} class={major ? 'tick major' : 'tick'} />
    {#if major}
      {@const lp = tickPos(t, R - 24)}
      <text x={lp.x} y={lp.y} class="num">{t}</text>
    {/if}
  {/each}

  <!-- fixed index marker at top -->
  <polygon points="{C - 7},4 {C + 7},4 {C},18" class="index" />

  <!-- needle -->
  <line x1={C} y1={C} x2={C + (R - 14) * Math.cos(needleRad)} y2={C + (R - 14) * Math.sin(needleRad)} class="needle" />
  <circle cx={C} cy={C} r="26" class="hub" />
  <text x={C} y={C} class="readout">{dialPosition.toFixed(1)}</text>
</svg>

<style>
  .dial {
    width: min(72vw, 340px);
    height: min(72vw, 340px);
    touch-action: none;
    cursor: grab;
    user-select: none;
  }
  .dial:active {
    cursor: grabbing;
  }
  .face {
    fill: #26262b;
    stroke: #4a4a52;
    stroke-width: 1.5;
  }
  .tick {
    stroke: #7080a0;
    stroke-width: 0.6;
  }
  .tick.major {
    stroke: #b8a898;
    stroke-width: 1.2;
  }
  .num {
    fill: #b8a898;
    font-size: 8px;
    text-anchor: middle;
    dominant-baseline: middle;
    font-family: -apple-system, system-ui, sans-serif;
  }
  .index {
    fill: #e0574a;
  }
  .needle {
    stroke: #f0e4d8;
    stroke-width: 2;
    stroke-linecap: round;
  }
  .hub {
    fill: #1a1a1c;
    stroke: #4a4a52;
    stroke-width: 1.5;
  }
  .readout {
    fill: #f0e4d8;
    font-size: 14px;
    font-weight: 700;
    text-anchor: middle;
    dominant-baseline: middle;
    font-family: -apple-system, system-ui, sans-serif;
  }
</style>
