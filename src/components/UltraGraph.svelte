<script lang="ts">
  // Fence-height graph for the selected wheel. Reuses the ContactGraph canvas pattern
  // (ResizeObserver → $effect → draw, DPR scaling, cssVar tokens). Identity X transform —
  // no zoom/pan (dropped per the Ultra plan; the thumbwheel gives exact integer steps).
  import { cssVar } from '../render/theme';
  import { gateMarkers, xAxisLabels, scrubIndexDelta } from '../render/ultraGraphModel';
  import SparkBurst from './SparkBurst.svelte';

  let {
    sweepData,
    numberRange,
    staticYLow,
    staticYHigh,
    markerPosition,
    solved = false,
    onScrub,
  }: {
    sweepData: number[];
    numberRange: number;
    staticYLow: number;
    staticYHigh: number;
    markerPosition: number;
    solved?: boolean;
    // Optional 1-finger drag-to-scrub: emits a new (unwrapped) dial position for the
    // selected wheel. The caller wraps/clamps (store.setPosition). Purely additive — the
    // thumbwheel remains the primary control.
    onScrub?: (position: number) => void;
  } = $props();

  let wrapEl: HTMLDivElement;
  let canvasEl: HTMLCanvasElement;
  let cssW = $state(320);
  let cssH = $state(200);

  const GREEN = '#2fbf5f';
  const PLOT = { left: 36, top: 12, right: 8, bottom: 20 };

  $effect(() => {
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      if (r.width > 0) cssW = r.width;
      if (r.height > 0) cssH = r.height;
    });
    ro.observe(wrapEl);
    return () => ro.disconnect();
  });

  $effect(() => {
    // Track reactive inputs so the graph redraws on data / size / marker change.
    draw(sweepData, cssW, cssH, staticYLow, staticYHigh, markerPosition);
  });

  // Solve celebration — fires once on the rising edge of `solved`, from the just-solved
  // gate's position (the selected wheel's marker, frozen at the moment it fires — matches
  // the app's Ultra spark, which originates from the graph gate rather than a UI button).
  // 0.7s burst (matches the app); the caller delays the solve sheet by the same amount so
  // the burst is visible before it's covered.
  let sparkActive = $state(false);
  let frozenMarker = $state(0);
  let prevSolved = false;
  $effect(() => {
    if (solved && !prevSolved) {
      frozenMarker = markerPosition;
      sparkActive = true;
    }
    prevSolved = solved;
  });

  const sparkOriginXPct = $derived.by(() => {
    if (cssW === 0) return 50;
    const lastIdx = Math.max(1, numberRange - 1);
    const plotW = Math.max(1, cssW - PLOT.left - PLOT.right);
    const x = PLOT.left + (frozenMarker / lastIdx) * plotW;
    return (x / cssW) * 100;
  });
  const sparkOriginYPct = $derived.by(() => (cssH > 0 ? (PLOT.top / cssH) * 100 : 10));
  const sparkDiameter = $derived(Math.max(20, cssH - PLOT.top - PLOT.bottom));

  // ── 1-finger drag-to-scrub (relative, velocity-scaled) ─────────────────────
  // Single pointer only; extra fingers are ignored (no pinch/pan/zoom, per plan).
  let activePointer: number | null = null;
  let dragFloat = 0; // running (unwrapped) position; rounds to the emitted step
  let lastRounded = 0;
  let lastX = 0;
  let lastT = 0;

  function scrubDown(e: PointerEvent) {
    if (!onScrub || activePointer !== null) return;
    activePointer = e.pointerId;
    dragFloat = markerPosition;
    lastRounded = Math.round(markerPosition);
    lastX = e.clientX;
    lastT = e.timeStamp || performance.now();
    canvasEl.setPointerCapture(e.pointerId);
  }
  function scrubMove(e: PointerEvent) {
    if (activePointer !== e.pointerId || !onScrub) return;
    const now = e.timeStamp || performance.now();
    const dx = e.clientX - lastX;
    const dt = Math.max(1, now - lastT) / 1000; // seconds (guard against 0)
    lastX = e.clientX;
    lastT = now;
    const plotW = Math.max(1, cssW - PLOT.left - PLOT.right);
    dragFloat += scrubIndexDelta(dx, Math.abs(dx) / dt, plotW, numberRange);
    const snapped = Math.round(dragFloat);
    if (snapped !== lastRounded) {
      lastRounded = snapped;
      onScrub(snapped);
    }
  }
  function scrubUp(e: PointerEvent) {
    if (activePointer !== e.pointerId) return;
    activePointer = null;
    try {
      canvasEl.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function draw(
    data: number[],
    w: number,
    h: number,
    yLow: number,
    yHigh: number,
    marker: number,
  ) {
    const ctx = canvasEl?.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvasEl.width = Math.round(w * dpr);
    canvasEl.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = cssVar('--graph-bg');
    ctx.fillRect(0, 0, w, h);

    const plotLeft = PLOT.left;
    const plotTop = PLOT.top;
    const plotW = Math.max(1, w - PLOT.left - PLOT.right);
    const plotH = Math.max(1, h - PLOT.top - PLOT.bottom);
    const plotBottom = plotTop + plotH;
    const plotRight = plotLeft + plotW;
    const ySpan = yHigh - yLow || 1;
    const lastIdx = Math.max(1, numberRange - 1);
    const xFor = (pos: number) => plotLeft + (pos / lastIdx) * plotW;
    const yFor = (v: number) => plotTop + ((yHigh - v) / ySpan) * plotH;

    const orange = cssVar('--graph-rcp');
    const grid = cssVar('--graph-grid');
    const textSec = cssVar('--text-secondary');

    // 5 horizontal grid lines across [yLow, yHigh].
    ctx.strokeStyle = grid + '66';
    ctx.lineWidth = 0.6;
    for (let i = 0; i <= 4; i++) {
      const y = plotTop + (i / 4) * plotH;
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotRight, y);
      ctx.stroke();
    }

    if (data.length > 0) {
      // Translucent orange area fill under the trace.
      ctx.beginPath();
      ctx.moveTo(xFor(0), plotBottom);
      for (let i = 0; i < data.length; i++) ctx.lineTo(xFor(i), yFor(data[i]));
      ctx.lineTo(xFor(data.length - 1), plotBottom);
      ctx.closePath();
      ctx.fillStyle = orange + '1a'; // ~10% alpha
      ctx.fill();

      // Orange trace polyline.
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = xFor(i);
        const y = yFor(data[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = orange;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Gate markers: tick at every min-tie index, connectors between close pairs, label.
      const gm = gateMarkers(data);
      if (gm.indices.length > 0) {
        const y = yFor(gm.minValue);
        ctx.strokeStyle = orange + 'd9';
        ctx.lineWidth = 2.5;
        const half = 10;
        for (const idx of gm.indices) {
          const x = xFor(idx);
          ctx.beginPath();
          ctx.moveTo(Math.max(x - half, plotLeft), y);
          ctx.lineTo(Math.min(x + half, plotRight), y);
          ctx.stroke();
        }
        for (const [a, b] of gm.segments) {
          ctx.beginPath();
          ctx.moveTo(xFor(a), y);
          ctx.lineTo(xFor(b), y);
          ctx.stroke();
        }
        // Value label with a readable background pill, above the leftmost extreme.
        const label = gm.minValue.toFixed(2);
        ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        const lx = Math.max(xFor(gm.indices[0]) - half, plotLeft);
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = cssVar('--graph-bg') + 'd9';
        ctx.fillRect(lx - 2, y - 15, tw + 4, 13);
        ctx.fillStyle = orange;
        ctx.fillText(label, lx, y - 3);
      }
    }

    // Bright-green vertical marker line at markerPosition.
    const mx = xFor(Math.max(0, Math.min(lastIdx, Math.round(marker))));
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mx, plotTop);
    ctx.lineTo(mx, plotBottom);
    ctx.stroke();

    // X-axis labels every 10.
    ctx.fillStyle = textSec;
    ctx.font = '9px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const p of xAxisLabels(numberRange, 10)) {
      ctx.fillText(String(p), xFor(p), plotBottom + 4);
    }

    // Y-axis labels: top (yHigh), mid, bottom (yLow).
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const [frac, v] of [
      [0, yHigh],
      [0.5, (yHigh + yLow) / 2],
      [1, yLow],
    ] as [number, number][]) {
      ctx.fillText(v.toFixed(2), plotLeft - 4, plotTop + frac * plotH);
    }
  }
</script>

<div class="graph-wrap" bind:this={wrapEl}>
  <canvas
    bind:this={canvasEl}
    class:scrubbable={!!onScrub}
    aria-label="Fence-height graph for the selected wheel — drag horizontally to scrub"
    onpointerdown={scrubDown}
    onpointermove={scrubMove}
    onpointerup={scrubUp}
    onpointercancel={scrubUp}
  ></canvas>
  <SparkBurst
    active={sparkActive}
    originXPct={sparkOriginXPct}
    originYPct={sparkOriginYPct}
    diameter={sparkDiameter}
    durationMs={700}
    onDone={() => (sparkActive = false)}
  />
</div>

<style>
  .graph-wrap {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 8px;
    touch-action: none;
  }
  canvas.scrubbable {
    cursor: ew-resize;
  }
</style>
