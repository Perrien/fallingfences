<script lang="ts">
  // Solve-celebration overlay: a gold particle burst (canvas) plus an optional CSS
  // shockwave (two expanding rings). Purely decorative — `pointer-events: none` throughout
  // so it never intercepts drags/taps on whatever it's layered over.
  //
  // Usage: place inside a `position: relative` container sized to the area the burst should
  // fill/clip to, and flip `active` from false → true once when the solve fires (this
  // component only reacts to the *rising edge*, so a sticky `true` prop is safe to pass).
  import { makeSparks, sparkState, type Spark } from '../render/sparkBurst';

  let {
    active,
    originXPct = 50,
    originYPct = 50,
    diameter,
    durationMs = 5000,
    rings = true,
    onDone,
  }: {
    active: boolean;
    originXPct?: number;
    originYPct?: number;
    diameter: number;
    durationMs?: number;
    rings?: boolean;
    onDone?: () => void;
  } = $props();

  let wrapEl: HTMLDivElement;
  let canvasEl: HTMLCanvasElement;
  let cssW = $state(0);
  let cssH = $state(0);
  let running = $state(false);
  let ringKey = $state(0);

  $effect(() => {
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      if (r.width > 0) cssW = r.width;
      if (r.height > 0) cssH = r.height;
    });
    ro.observe(wrapEl);
    return () => ro.disconnect();
  });

  let sparks: Spark[] = [];
  let rafId = 0;
  let startTime = 0;
  let prevActive = false;

  $effect(() => {
    if (active && !prevActive) start();
    prevActive = active;
  });

  $effect(() => {
    return () => cancelAnimationFrame(rafId);
  });

  function start() {
    const d = Math.max(20, diameter);
    sparks = makeSparks(160, d);
    startTime = performance.now();
    running = true;
    ringKey++; // remount the ring divs so their CSS animation restarts from 0
    cancelAnimationFrame(rafId);
    tick();
  }

  function tick() {
    const now = performance.now();
    const elapsed = now - startTime;
    draw(elapsed / 1000);
    if (elapsed >= durationMs) {
      running = false;
      const ctx = canvasEl?.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      onDone?.();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function draw(t: number) {
    const ctx = canvasEl?.getContext('2d');
    if (!ctx || cssW === 0 || cssH === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvasEl.width = Math.round(cssW * dpr);
    canvasEl.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const originX = (originXPct / 100) * cssW;
    const originY = (originYPct / 100) * cssH;
    const d = Math.max(20, diameter);

    for (const s of sparks) {
      const st = sparkState(s, t, d);
      if (!st) continue;
      ctx.strokeStyle = `hsla(${Math.round(s.hue * 360)}, 95%, 60%, ${st.alpha})`;
      ctx.lineWidth = s.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(originX + st.tailX, originY + st.tailY);
      ctx.lineTo(originX + st.x, originY + st.y);
      ctx.stroke();
    }
  }
</script>

<div class="spark-wrap" bind:this={wrapEl} aria-hidden="true">
  <canvas bind:this={canvasEl}></canvas>
  {#if rings && running}
    {#key ringKey}
      <div class="ring" style={`left:${originXPct}%; top:${originYPct}%`}></div>
      <div class="ring ring2" style={`left:${originXPct}%; top:${originYPct}%`}></div>
    {/key}
  {/if}
</div>

<style>
  .spark-wrap {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 6;
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  /* Shockwave rings — experimental, easy to drop: remove the `rings` usages/prop and this
     block if it doesn't earn its keep visually. */
  .ring {
    position: absolute;
    width: 20px;
    height: 20px;
    margin: -10px 0 0 -10px;
    border-radius: 50%;
    border: 2px solid hsla(45, 95%, 60%, 0.9);
    transform: scale(0);
    opacity: 0.9;
    animation: ring-out 0.9s ease-out forwards;
  }
  .ring2 {
    animation-delay: 0.15s;
  }
  @keyframes ring-out {
    from {
      transform: scale(0);
      opacity: 0.9;
    }
    to {
      transform: scale(9);
      opacity: 0;
    }
  }
</style>
