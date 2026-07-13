<script lang="ts">
  import type { ProbeReading } from '../models/LockSession';
  import { buildTracks, trackBounds, type PlotPoint } from '../render/graphModel';
  import { cssVar } from '../render/theme';

  // Polar contact-point graph — the primary graph on the iPhone (narrow) layout.
  // LCP plots in the inner ring (rInner→rMid), RCP in the outer ring (rMid→rOuter), each
  // independently scaled. Green markers flag the minimum-width position(s) — the gate cue.
  let {
    probeHistory,
    numberRange,
    contactAreaCenter,
    contactAreaWidth,
    dialPosition,
    showLCP = true,
    showWidth = false,
    amplified = false,
  }: {
    probeHistory: ProbeReading[];
    numberRange: number;
    contactAreaCenter: number;
    contactAreaWidth: number;
    dialPosition: number;
    showLCP?: boolean;
    showWidth?: boolean;
    amplified?: boolean;
  } = $props();

  let wrapEl: HTMLDivElement;
  let canvasEl: HTMLCanvasElement;
  let size = $state(0);

  $effect(() => {
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0 && w !== size) size = w;
    });
    ro.observe(wrapEl);
    return () => ro.disconnect();
  });

  $effect(() => {
    // deps
    probeHistory;
    dialPosition;
    showLCP;
    showWidth;
    amplified;
    if (size > 0) draw(size);
  });

  const posAngle = (pos: number) => -Math.PI / 2 + (pos / numberRange) * 2 * Math.PI;
  const polar = (cx: number, cy: number, r: number, a: number) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  const zoneRadius = (v: number, lo: number, hi: number, inner: number, outer: number) => {
    const span = hi - lo;
    const t = span > 0 ? (v - lo) / span : 0.5;
    return inner + Math.max(0, Math.min(1, t)) * (outer - inner);
  };
  const toMap = (pts: PlotPoint[]) => new Map(pts.map((p) => [p.wheelPosition, { lo: p.lo, hi: p.hi }]));

  function draw(s: number) {
    const ctx = canvasEl?.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvasEl.width = Math.round(s * dpr);
    canvasEl.height = Math.round(s * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, s, s);

    const c = s / 2;
    const rLabel = s * 0.455;
    const rOuter = s * 0.4;
    const rInner = s * 0.155;
    const rMid = (rInner + rOuter) / 2;

    // Reuse the cartesian track builder for consistent grouping/precision.
    const tracks = buildTracks(probeHistory, {
      contactAreaCenter,
      contactAreaWidth,
      showRCP: true,
      showLCP: true,
      showWidth: false,
      amplified,
    });
    const rcpDef = tracks.find((t) => t.label === 'RCP')!;
    const lcpDef = tracks.find((t) => t.label === 'LCP')!;
    const rcpByPos = toMap(rcpDef.points);
    const lcpByPos = toMap(lcpDef.points);
    const [rcpLo, rcpHi] = trackBounds(rcpDef.points.flatMap((p) => [p.lo, p.hi]), rcpDef.fallback, amplified);
    const [lcpLo, lcpHi] = trackBounds(lcpDef.points.flatMap((p) => [p.lo, p.hi]), lcpDef.fallback, amplified);

    const grid = cssVar('--graph-grid');
    const rcpCol = cssVar('--graph-rcp');
    const lcpCol = cssVar('--graph-lcp');
    const widthCol = cssVar('--graph-width');
    const green = cssVar('--graph-amp');
    const textCol = cssVar('--text');
    const secondary = cssVar('--text-secondary');

    // background disc
    ctx.fillStyle = cssVar('--graph-bg');
    ctx.beginPath();
    ctx.arc(c, c, rOuter, 0, Math.PI * 2);
    ctx.fill();

    // 5 concentric rings (C3 = rMid emphasized)
    for (let i = 0; i < 5; i++) {
      const r = rInner + ((rOuter - rInner) * i) / 4;
      ctx.strokeStyle = grid + (i === 2 ? 'cc' : '88');
      ctx.lineWidth = i === 2 ? 1.5 : 1;
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // spokes at even indices (every 5 heavier)
    for (let i = 0; i < numberRange; i += 2) {
      const a = posAngle(i);
      const p1 = polar(c, c, rInner, a);
      const p2 = polar(c, c, rOuter, a);
      ctx.strokeStyle = grid + '77';
      ctx.lineWidth = i % 5 === 0 ? 0.75 : 0.4;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // position labels every 5
    ctx.fillStyle = secondary;
    ctx.font = `500 ${s * 0.038}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const majorStep = numberRange > 60 ? 10 : 5;
    for (let i = 0; i < numberRange; i += majorStep) {
      const lp = polar(c, c, rLabel, posAngle(i));
      ctx.fillText(String(i), lp.x, lp.y);
    }

    const dotR = s * 0.007;
    const barW = dotR * 2;
    const allPos = [...new Set([...rcpByPos.keys(), ...lcpByPos.keys()])].sort((a, b) => a - b);

    // connection lines within 3 increments (beneath the dots)
    const drawConnections = (map: Map<number, { lo: number; hi: number }>, lo: number, hi: number, inner: number, outer: number, col: string) => {
      const sorted = allPos.filter((p) => map.has(p));
      for (let i = 0; i < sorted.length; i++) {
        const p1 = sorted[i];
        const p2 = sorted[(i + 1) % sorted.length];
        const raw = Math.abs(p2 - p1);
        const dist = Math.min(raw, numberRange - raw);
        if (dist <= 0 || dist > 3) continue;
        const e1 = map.get(p1)!;
        const e2 = map.get(p2)!;
        const a1 = polar(c, c, zoneRadius((e1.lo + e1.hi) / 2, lo, hi, inner, outer), posAngle(p1));
        const a2 = polar(c, c, zoneRadius((e2.lo + e2.hi) / 2, lo, hi, inner, outer), posAngle(p2));
        ctx.strokeStyle = col + '99';
        ctx.lineWidth = dotR;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a1.x, a1.y);
        ctx.lineTo(a2.x, a2.y);
        ctx.stroke();
      }
    };
    if (showLCP) drawConnections(lcpByPos, lcpLo, lcpHi, rInner, rMid, lcpCol);
    drawConnections(rcpByPos, rcpLo, rcpHi, rMid, rOuter, rcpCol);

    // bars / dots per position
    const drawTrace = (map: Map<number, { lo: number; hi: number }>, lo: number, hi: number, inner: number, outer: number, col: string, dotAtLo: boolean) => {
      for (const [pos, e] of map) {
        const a = posAngle(pos);
        const rLo = zoneRadius(e.lo, lo, hi, inner, outer);
        const rHi = zoneRadius(e.hi, lo, hi, inner, outer);
        if (Math.abs(rHi - rLo) < 1) {
          const p = polar(c, c, dotAtLo ? rLo : rHi, a);
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const p1 = polar(c, c, rLo, a);
          const p2 = polar(c, c, rHi, a);
          ctx.strokeStyle = col;
          ctx.lineWidth = barW;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    };

    // width radial lines (LCP hi → RCP lo)
    if (showWidth) {
      for (const pos of allPos) {
        const lcp = lcpByPos.get(pos);
        const rcp = rcpByPos.get(pos);
        if (!lcp || !rcp) continue;
        const a = posAngle(pos);
        const p1 = polar(c, c, zoneRadius(lcp.hi, lcpLo, lcpHi, rInner, rMid), a);
        const p2 = polar(c, c, zoneRadius(rcp.lo, rcpLo, rcpHi, rMid, rOuter), a);
        ctx.strokeStyle = widthCol + '40';
        ctx.lineWidth = s * 0.018;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
    if (showLCP) drawTrace(lcpByPos, lcpLo, lcpHi, rInner, rMid, lcpCol, false);
    drawTrace(rcpByPos, rcpLo, rcpHi, rMid, rOuter, rcpCol, true);

    // minimum-width markers (green) at the outer edge — the gate cue
    const widthByPos = new Map<number, number>();
    for (const [pos, lcp] of lcpByPos) {
      const rcp = rcpByPos.get(pos);
      if (rcp) widthByPos.set(pos, rcp.lo - lcp.hi);
    }
    if (widthByPos.size > 0) {
      const minW = Math.min(...widthByPos.values());
      const atMin = [...widthByPos.entries()].filter(([, w]) => w === minW).map(([p]) => p);
      const markerR = rOuter + s * 0.028;
      ctx.fillStyle = green;
      for (const pos of atMin) {
        const p = polar(c, c, markerR, posAngle(pos));
        ctx.beginPath();
        ctx.arc(p.x, p.y, s * 0.013, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // current-position indicator triangle inside the inner ring, pointing outward
    const a = posAngle(dialPosition);
    const triH = s * 0.03;
    const tipR = rInner * 0.9;
    const baseR = tipR - triH;
    const perp = a + Math.PI / 2;
    const tip = polar(c, c, tipR, a);
    const base = polar(c, c, baseR, a);
    const w2 = s * 0.01;
    ctx.fillStyle = textCol;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(base.x + w2 * Math.cos(perp), base.y + w2 * Math.sin(perp));
    ctx.lineTo(base.x - w2 * Math.cos(perp), base.y - w2 * Math.sin(perp));
    ctx.closePath();
    ctx.fill();

    // centre readout: current dial position (+ width at nearest read position)
    ctx.fillStyle = textCol;
    ctx.font = `200 ${s * 0.09}px ui-monospace, monospace`;
    ctx.fillText(String(Math.round(dialPosition % numberRange)).padStart(2, '0'), c, c - s * 0.01);
    const w = nearestWidth(lcpByPos, rcpByPos);
    ctx.fillStyle = secondary;
    ctx.font = `${s * 0.035}px ui-monospace, monospace`;
    ctx.fillText(w === null ? '—' : w.toFixed(2), c, c + s * 0.06);
  }

  // Width at the read position nearest the current dial position (within 1.0).
  function nearestWidth(lcpByPos: Map<number, { lo: number; hi: number }>, rcpByPos: Map<number, { lo: number; hi: number }>): number | null {
    const raw = dialPosition % numberRange;
    let best: number | null = null;
    let bestDist = Infinity;
    for (const [pos, lcp] of lcpByPos) {
      const rcp = rcpByPos.get(pos);
      if (!rcp) continue;
      const d0 = Math.abs(pos - raw);
      const dist = Math.min(d0, numberRange - d0);
      if (dist < bestDist) {
        bestDist = dist;
        best = rcp.lo - lcp.hi;
      }
    }
    return bestDist <= 1.0 ? best : null;
  }
</script>

<div class="wrap" bind:this={wrapEl}>
  <canvas bind:this={canvasEl}></canvas>
</div>

<style>
  .wrap {
    width: min(88vw, 360px);
    aspect-ratio: 1 / 1;
    margin: 0 auto;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
