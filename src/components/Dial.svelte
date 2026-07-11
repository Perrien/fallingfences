<script lang="ts">
  import { cssVar } from '../render/theme';

  // Canvas dial: static number ring + needle to the current position, single-pass draw.
  // Drag to rotate; moves coalesced to one onRotate call per frame. Same interface as before.
  //
  // Sizing: the ResizeObserver watches the WRAPPER (CSS-sized), never the canvas — observing
  // the canvas while resizing its own buffer causes a runaway resize loop.
  let {
    numberRange,
    dialPosition,
    onRotate,
    contactAreaCenter = 0,
    contactAreaWidth = 0,
  }: {
    numberRange: number;
    dialPosition: number;
    onRotate: (deltaIncrements: number) => void;
    contactAreaCenter?: number;
    contactAreaWidth?: number;
  } = $props();

  let wrapEl: HTMLDivElement;
  let canvasEl: HTMLCanvasElement;
  let size = $state(0);

  let dragging = false;
  let lastAngleDeg = 0;
  let pendingDelta = 0;
  let rafScheduled = false;

  const labelStep = $derived(numberRange <= 60 ? 5 : 10);

  $effect(() => {
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0 && w !== size) size = w;
    });
    ro.observe(wrapEl);
    return () => ro.disconnect();
  });

  $effect(() => {
    if (size > 0) draw(dialPosition, size);
  });

  // point at radius r for an angle measured clockwise from the top
  function pt(cx: number, cy: number, r: number, thetaFromTop: number) {
    return { x: cx + r * Math.sin(thetaFromTop), y: cy - r * Math.cos(thetaFromTop) };
  }

  function draw(pos: number, s: number) {
    const ctx = canvasEl?.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvasEl.width = Math.round(s * dpr);
    canvasEl.height = Math.round(s * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, s, s);

    const c = s / 2;
    const R = c - 4;

    const bezelOuter = cssVar('--dial-bezel-outer');
    const bezelInner = cssVar('--dial-bezel-inner');
    const face = cssVar('--dial-face');
    const tickCol = cssVar('--dial-tick');
    const labelCol = cssVar('--dial-label');
    const needleCol = cssVar('--dial-position');
    const knobRim = cssVar('--dial-knob-rim');
    const knobCore = cssVar('--dial-knob-core');
    const contactCol = cssVar('--contact-area');

    // bezel (outer ring → inner ring) + dark face
    ctx.fillStyle = bezelOuter;
    ctx.beginPath();
    ctx.arc(c, c, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bezelInner;
    ctx.beginPath();
    ctx.arc(c, c, R - 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(c, c, R - 10, 0, Math.PI * 2);
    ctx.fill();

    // contact-area highlight (the fixed zone where contact points are read / the nose drops)
    if (contactAreaWidth > 0) {
      const a1 = ((contactAreaCenter - contactAreaWidth / 2) / numberRange) * Math.PI * 2 - Math.PI / 2;
      const a2 = ((contactAreaCenter + contactAreaWidth / 2) / numberRange) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(c, c, R - 11, a1, a2);
      ctx.arc(c, c, R - 30, a2, a1, true);
      ctx.closePath();
      ctx.fillStyle = contactCol;
      ctx.fill();
    }

    // ticks + numbers (static ring)
    const tickR = R - 12;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let t = 0; t < numberRange; t++) {
      const theta = (t / numberRange) * Math.PI * 2;
      const major = t % labelStep === 0;
      const o = pt(c, c, tickR, theta);
      const i = pt(c, c, tickR - (major ? 12 : 6), theta);
      ctx.strokeStyle = tickCol;
      ctx.globalAlpha = major ? 1 : 0.5;
      ctx.lineWidth = major ? 1.4 : 0.6;
      ctx.beginPath();
      ctx.moveTo(i.x, i.y);
      ctx.lineTo(o.x, o.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (major) {
        const lp = pt(c, c, tickR - 22, theta);
        ctx.fillStyle = labelCol;
        ctx.font = `${Math.max(9, s * 0.04)}px ui-monospace, monospace`;
        ctx.fillText(String(t), lp.x, lp.y);
      }
    }

    // needle → current position
    const nTheta = (pos / numberRange) * Math.PI * 2;
    const tip = pt(c, c, R - 18, nTheta);
    ctx.strokeStyle = needleCol;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    // hub + readout
    ctx.fillStyle = knobCore;
    ctx.beginPath();
    ctx.arc(c, c, s * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = knobRim;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = labelCol;
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.max(13, s * 0.07)}px ui-monospace, monospace`;
    ctx.fillText(pos.toFixed(1), c, c);
  }

  function angleOf(e: PointerEvent): number {
    const rect = canvasEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
  }

  function flush() {
    rafScheduled = false;
    if (pendingDelta !== 0) {
      onRotate(pendingDelta);
      pendingDelta = 0;
    }
  }

  function down(e: PointerEvent) {
    dragging = true;
    lastAngleDeg = angleOf(e);
    canvasEl.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!dragging) return;
    const a = angleOf(e);
    let d = a - lastAngleDeg;
    if (d > 180) d -= 360;
    else if (d < -180) d += 360;
    lastAngleDeg = a;
    // Screen-clockwise drag turns the dial right → the number under the index increases.
    pendingDelta += (d / 360) * numberRange;
    if (!rafScheduled) {
      rafScheduled = true;
      requestAnimationFrame(flush);
    }
  }
  function up(e: PointerEvent) {
    dragging = false;
    try {
      canvasEl.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }
</script>

<div class="dial-wrap" bind:this={wrapEl}>
  <canvas
    bind:this={canvasEl}
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
  ></canvas>
</div>

<style>
  .dial-wrap {
    width: min(72vw, 340px);
    aspect-ratio: 1 / 1;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: grab;
    user-select: none;
  }
  canvas:active {
    cursor: grabbing;
  }
</style>
