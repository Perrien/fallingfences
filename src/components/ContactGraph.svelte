<script lang="ts">
  import type { ProbeReading } from '../models/LockSession';
  import { buildTracks, graphWindowBounds, trackExtreme, type TrackDef } from '../render/graphModel';
  import { cssVar } from '../render/theme';

  let {
    probeHistory,
    numberRange,
    contactAreaCenter,
    contactAreaWidth,
    showRCP = true,
    showLCP = true,
    showWidth = false,
  }: {
    probeHistory: ProbeReading[];
    numberRange: number;
    contactAreaCenter: number;
    contactAreaWidth: number;
    showRCP?: boolean;
    showLCP?: boolean;
    showWidth?: boolean;
  } = $props();

  const AXIS_H = 14;
  const TRACK_H = 92;

  let canvasEl: HTMLCanvasElement;
  let cssW = $state(320);

  const tracks = $derived(
    buildTracks(probeHistory, { contactAreaCenter, contactAreaWidth, showRCP, showLCP, showWidth }),
  );
  const heightPx = $derived(Math.max(1, tracks.length) * TRACK_H + AXIS_H * 2);

  // Track element width.
  $effect(() => {
    const ro = new ResizeObserver((entries) => {
      cssW = entries[0].contentRect.width;
    });
    ro.observe(canvasEl);
    return () => ro.disconnect();
  });

  // Redraw whenever data, size, or toggles change.
  $effect(() => {
    draw(tracks, cssW, heightPx);
  });

  function draw(defs: TrackDef[], w: number, h: number) {
    const ctx = canvasEl?.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvasEl.width = Math.round(w * dpr);
    canvasEl.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const COLORS: Record<TrackDef['label'], string> = {
      RCP: cssVar('--graph-rcp'),
      LCP: cssVar('--graph-lcp'),
      W: cssVar('--graph-width'),
    };
    const gridCol = cssVar('--graph-grid');
    ctx.fillStyle = cssVar('--graph-bg');
    ctx.fillRect(0, 0, w, h);

    const L = 34;
    const R = 34;
    const plotW = Math.max(1, w - L - R);
    const n = Math.max(1, defs.length);
    const trackH = (h - AXIS_H * 2) / n;
    const plotTop = AXIS_H;
    const plotBottom = h - AXIS_H;
    const xFor = (pos: number) => L + (pos / numberRange) * plotW;
    const majorStep = numberRange <= 60 ? 5 : 10;

    // vertical grid
    for (let i = 0; i <= numberRange; i++) {
      const x = xFor(i);
      ctx.strokeStyle = i % 10 === 0 ? gridCol : i % 5 === 0 ? gridCol + '99' : gridCol + '55';
      ctx.lineWidth = i % 10 === 0 ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, plotTop);
      ctx.lineTo(x, plotBottom);
      ctx.stroke();
    }

    // x-axis labels (top + bottom)
    ctx.fillStyle = cssVar('--text-secondary');
    ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= numberRange; i += majorStep) {
      const x = xFor(i % numberRange === 0 && i > 0 ? numberRange : i);
      ctx.fillText(String(i % numberRange), x, AXIS_H / 2);
      ctx.fillText(String(i % numberRange), x, h - AXIS_H / 2);
    }

    // track dividers
    ctx.strokeStyle = cssVar('--divider');
    ctx.lineWidth = 1;
    for (let i = 0; i <= n; i++) {
      const y = plotTop + i * trackH;
      ctx.beginPath();
      ctx.moveTo(L, y);
      ctx.lineTo(L + plotW, y);
      ctx.stroke();
    }

    defs.forEach((def, i) => {
      const top = plotTop + i * trackH;
      const bottom = top + trackH;
      const values = def.points.flatMap((p) => [p.lo, p.hi]);
      const [lo, hi] = graphWindowBounds(values, def.fallback);
      const span = hi - lo || 1;
      const yFor = (v: number) => bottom - ((v - lo) / span) * trackH;
      const color = COLORS[def.label];

      // track label
      ctx.fillStyle = color;
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(def.label, L + 3, top + 3);

      // connecting line through midpoints of adjacent (close) points
      ctx.strokeStyle = color + 'aa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let penDown = false;
      for (let k = 0; k < def.points.length; k++) {
        const p = def.points[k];
        const x = xFor(p.wheelPosition);
        const y = yFor((p.lo + p.hi) / 2);
        const gap = k > 0 ? p.wheelPosition - def.points[k - 1].wheelPosition : Infinity;
        if (penDown && gap > 0 && gap <= 3) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
        penDown = true;
      }
      ctx.stroke();

      // points: dot (single value) or bar (lo..hi)
      for (const p of def.points) {
        const x = xFor(p.wheelPosition);
        if (p.lo === p.hi) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, yFor(p.lo), 2.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = color;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(x, yFor(p.lo));
          ctx.lineTo(x, yFor(p.hi));
          ctx.stroke();
        }
      }

      // extreme marker (the deducible gate): tick + value at min-RCP / max-LCP
      const extreme = trackExtreme(def);
      if (extreme !== null) {
        const y = yFor(extreme);
        const atExtreme = def.points.filter((p) => (def.isMin ? p.lo : p.hi) === extreme);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        for (const p of atExtreme) {
          const x = xFor(p.wheelPosition);
          ctx.beginPath();
          ctx.moveTo(Math.max(x - 10, L), y);
          ctx.lineTo(Math.min(x + 10, L + plotW), y);
          ctx.stroke();
        }
        ctx.fillStyle = color;
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = def.isMin ? 'top' : 'bottom';
        const lx = Math.max(xFor(atExtreme[0].wheelPosition) - 10, L);
        ctx.fillText(extreme.toFixed(2), lx, def.isMin ? y + 3 : y - 3);
      }

      // y scale labels (mid ± 0.5) at both margins
      const mid = Math.round(((lo + hi) / 2) * 2) / 2;
      ctx.fillStyle = color + 'cc';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      for (const off of [0.5, 0, -0.5]) {
        const v = mid + off;
        const y = Math.max(top, Math.min(bottom, yFor(v)));
        ctx.textAlign = 'right';
        ctx.fillText(v.toFixed(1), L - 3, y);
        ctx.textAlign = 'left';
        ctx.fillText(v.toFixed(1), L + plotW + 3, y);
      }
    });
  }
</script>

<canvas bind:this={canvasEl} style={`width:100%;height:${heightPx}px`}></canvas>

<style>
  canvas {
    display: block;
    border-radius: 8px;
    touch-action: none;
  }
</style>
