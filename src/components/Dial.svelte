<script lang="ts">
  import { cssVar } from '../render/theme';
  import SparkBurst from './SparkBurst.svelte';

  // Rotating-ring dial, ported from the app's DialRingView: the numbered ring + knurled
  // knob rotate under a fixed reference triangle at 12 o'clock. The dark centre knob is the
  // Probe button — tap it to probe, drag anywhere to rotate. Single-pass canvas draw;
  // ResizeObserver watches the CSS-sized wrapper (never the canvas) to avoid a resize loop.
  let {
    numberRange,
    dialPosition,
    onRotate,
    onProbe,
    contactAreaCenter = 0,
    contactAreaWidth = 0,
    solved = false,
    flashCounter = 0,
  }: {
    numberRange: number;
    dialPosition: number;
    onRotate: (deltaIncrements: number, velocity: number) => void;
    onProbe: () => void;
    contactAreaCenter?: number;
    contactAreaWidth?: number;
    solved?: boolean;
    flashCounter?: number;
  } = $props();

  let wrapEl: HTMLDivElement;
  let canvasEl: HTMLCanvasElement;
  let size = $state(0);

  const majorStep = $derived(numberRange > 60 ? 10 : 5);

  // pointer state
  let dragging = false;
  let lastAngleRad = 0;
  let startClientX = 0;
  let startClientY = 0;
  let startedInKnob = false;
  let moved = 0;
  let pendingDelta = 0;
  let rafScheduled = false;
  let lastFlushTime = 0;

  // Wheel-reader LED (green, 12 o'clock). Idle brightness drifts with dial position; each
  // flashCounter change kicks it to 0.72 and eases back over 0.45s. Matches the app.
  let flashBoost = $state(0);
  let ledInit = false;
  let flashRaf = 0;

  $effect(() => {
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0 && w !== size) size = w;
    });
    ro.observe(wrapEl);
    return () => ro.disconnect();
  });

  // Solve celebration — fires once on the rising edge of `solved` (matches the app's
  // 5s spark burst, centered on the dial).
  let sparkActive = $state(false);
  let prevSolved = false;
  $effect(() => {
    if (solved && !prevSolved) sparkActive = true;
    prevSolved = solved;
  });

  $effect(() => {
    flashBoost; // redraw the LED as the flash decays
    if (size > 0) draw(dialPosition, size);
  });

  // Flash the LED whenever the counter changes (skip the initial mount).
  $effect(() => {
    flashCounter; // track
    if (!ledInit) {
      ledInit = true;
      return;
    }
    cancelAnimationFrame(flashRaf);
    flashBoost = 0.72;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 450); // 0.45s ease-out
      flashBoost = 0.72 * (1 - k);
      if (k < 1) flashRaf = requestAnimationFrame(step);
    };
    flashRaf = requestAnimationFrame(step);
  });

  const polar = (c: number, r: number, a: number) => ({ x: c + r * Math.cos(a), y: c + r * Math.sin(a) });
  // Ring angle for a dial number: number `dialPosition` sits at 12 o'clock (−90°).
  const ringAngle = (n: number) => -Math.PI / 2 + ((n - dialPosition) / numberRange) * 2 * Math.PI;

  function draw(pos: number, s: number) {
    const ctx = canvasEl?.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvasEl.width = Math.round(s * dpr);
    canvasEl.height = Math.round(s * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, s, s);

    const c = s / 2;
    const R = s * 0.46;

    const bezel = cssVar('--dial-bezel-outer');
    const face = cssVar('--dial-face');
    const tickCol = cssVar('--dial-tick');
    const labelCol = cssVar('--dial-label');
    const refRed = cssVar('--dial-reference');
    const primary = cssVar('--text');

    // radius schedule (fractions of R, from the app)
    const rRingOut = R * 0.958;
    const rRingIn = R * 0.6;
    const rKnOut = R * 0.59;
    const rKnIn = R * 0.465;
    const rRimOut = R * 0.46;
    const rCap = R * 0.437;
    const labelR = R * 0.73;
    const ringW = rRingOut - rRingIn;

    // 1. outer bezel band
    ctx.fillStyle = bezel;
    ctx.beginPath();
    ctx.arc(c, c, R, 0, Math.PI * 2);
    ctx.fill();

    // 2. aluminium number ring (radial-vertical gradient)
    const grad = ctx.createLinearGradient(0, c - rRingOut, 0, c + rRingOut);
    grad.addColorStop(0, '#eeeef1');
    grad.addColorStop(0.55, '#b6b6ba');
    grad.addColorStop(1, '#cccccf');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c, c, rRingOut, 0, Math.PI * 2);
    ctx.fill();

    // 3. tick marks (rotate with the ring). Red tick only at the contact-area centre.
    const caCenter = contactAreaWidth > 0 ? Math.round(contactAreaCenter) % numberRange : -1;
    const halfMajor = majorStep / 2;
    for (let i = 0; i < numberRange; i++) {
      const a = ringAngle(i);
      const isMajor = i % majorStep === 0;
      const isMedium = i % halfMajor === 0 && !isMajor;
      const isCA = i === caCenter;
      const len = isCA || isMajor ? ringW * 0.36 : isMedium ? ringW * 0.26 : ringW * 0.2;
      const w = isCA ? R * 0.018 : isMajor ? R * 0.014 : isMedium ? R * 0.009 : R * 0.005;
      const outer = rRingOut - R * 0.01;
      const o = polar(c, outer, a);
      const inn = polar(c, outer - len, a);
      ctx.strokeStyle = isCA ? refRed : tickCol;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(o.x, o.y);
      ctx.lineTo(inn.x, inn.y);
      ctx.stroke();
    }

    // 4. numbers (rotate with the ring, oriented radially)
    ctx.fillStyle = labelCol;
    ctx.font = `600 ${R * 0.11}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < numberRange; i += majorStep) {
      const a = ringAngle(i);
      const p = polar(c, labelR, a);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(String(i), 0, 0);
      ctx.restore();
    }

    // 5. knurled knob (backing + 72 teeth, rotates with position)
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(c, c, rKnOut, 0, Math.PI * 2);
    ctx.fill();
    const teeth = 72;
    const knurOffset = -(pos / numberRange) * 2 * Math.PI;
    for (let i = 0; i < teeth; i++) {
      const a1 = (i / teeth) * 2 * Math.PI - Math.PI / 2 + knurOffset;
      const a2 = ((i + 1) / teeth) * 2 * Math.PI - Math.PI / 2 + knurOffset;
      const isValley = i % 2 === 1;
      const rOut = isValley ? rKnOut * 0.968 : rKnOut;
      const p1 = polar(c, rKnIn, a1);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      const p2 = polar(c, rOut, a1 + 0.004);
      ctx.lineTo(p2.x, p2.y);
      ctx.arc(c, c, rOut, a1 + 0.004, a2 - 0.004, false);
      const p3 = polar(c, rKnIn, a2 - 0.004);
      ctx.lineTo(p3.x, p3.y);
      ctx.arc(c, c, rKnIn, a2 - 0.004, a1, true);
      ctx.closePath();
      ctx.fillStyle = isValley ? '#48484c' : '#c8c8cc';
      ctx.fill();
    }

    // 6. inner rim + 7. dark centre cap (the Probe knob face)
    ctx.fillStyle = '#d4d4d8';
    ctx.beginPath();
    ctx.arc(c, c, rRimOut, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(c, c, rCap, 0, Math.PI * 2);
    ctx.fill();

    // solved check on the knob
    if (solved) {
      ctx.strokeStyle = '#4fb56f';
      ctx.lineWidth = R * 0.03;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(c - rCap * 0.34, c);
      ctx.lineTo(c - rCap * 0.08, c + rCap * 0.28);
      ctx.lineTo(c + rCap * 0.36, c - rCap * 0.26);
      ctx.stroke();
    }

    // 8. fixed reference triangle at 12 o'clock, pointing inward
    const triH = R * 0.07;
    const triW = R * 0.06;
    const tipY = c - R + R * 0.008;
    const baseY = c - R - triH;
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.moveTo(c, tipY);
    ctx.lineTo(c - triW / 2, baseY);
    ctx.lineTo(c + triW / 2, baseY);
    ctx.closePath();
    ctx.fill();

    // 9. wheel-reader LED — green, in the outer bezel at 12 o'clock
    const idle = 0.25 + 0.15 * (0.5 + 0.5 * Math.sin(pos * 0.45));
    const b = Math.min(1, idle + flashBoost);
    const ledR = R * 0.03;
    const ledY = c - R * 0.978;
    ctx.fillStyle = `rgba(70, 200, 90, ${b * 0.3})`;
    ctx.beginPath();
    ctx.arc(c, ledY, ledR * 2.6, 0, Math.PI * 2); // glow halo
    ctx.fill();
    ctx.fillStyle = `rgba(70, 200, 90, ${b})`;
    ctx.beginPath();
    ctx.arc(c, ledY, ledR, 0, Math.PI * 2); // core
    ctx.fill();
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(b * 0.55, 0.5)})`;
    ctx.beginPath();
    ctx.arc(c - ledR * 0.28, ledY - ledR * 0.28, ledR * 0.4, 0, Math.PI * 2); // highlight
    ctx.fill();
  }

  // ── interaction ──────────────────────────────────────────────────────────
  function center() {
    const r = canvasEl.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
  }
  function angleOf(e: PointerEvent, cx: number, cy: number) {
    return Math.atan2(e.clientY - cy, e.clientX - cx);
  }
  function flush(now: number) {
    rafScheduled = false;
    if (pendingDelta !== 0) {
      // Real dial speed in increments/second, so the sim can gate auto-read on velocity.
      const dt = lastFlushTime ? (now - lastFlushTime) / 1000 : 1 / 60;
      const velocity = dt > 0 ? Math.abs(pendingDelta) / dt : 0;
      onRotate(pendingDelta, velocity);
      pendingDelta = 0;
    }
    lastFlushTime = now;
  }
  function down(e: PointerEvent) {
    const ctr = center();
    dragging = true;
    moved = 0;
    startClientX = e.clientX;
    startClientY = e.clientY;
    lastAngleRad = angleOf(e, ctr.x, ctr.y);
    const dist = Math.hypot(e.clientX - ctr.x, e.clientY - ctr.y);
    startedInKnob = dist <= ctr.w * 0.28; // knob ≈ rKnOut of the dial
    lastFlushTime = 0;
    canvasEl.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!dragging) return;
    const ctr = center();
    const a = angleOf(e, ctr.x, ctr.y);
    let d = a - lastAngleRad;
    if (d > Math.PI) d -= 2 * Math.PI;
    else if (d < -Math.PI) d += 2 * Math.PI;
    lastAngleRad = a;
    moved = Math.hypot(e.clientX - startClientX, e.clientY - startClientY);
    // Rotating ring: negate the screen delta so dragging clockwise turns the dial right
    // (number under the fixed index increases). Matches the app's `-delta` mapping.
    pendingDelta += -(d / (2 * Math.PI)) * numberRange;
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
    // A tap on the knob (negligible movement) = probe.
    if (startedInKnob && moved < 5) onProbe();
  }
</script>

<div class="dial-wrap" bind:this={wrapEl}>
  <canvas
    bind:this={canvasEl}
    aria-label="Safe dial — drag to rotate, tap centre to probe"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
  ></canvas>
  <SparkBurst active={sparkActive} diameter={size} durationMs={5000} onDone={() => (sparkActive = false)} />
</div>

<style>
  .dial-wrap {
    position: relative;
    width: min(80vw, 360px);
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
