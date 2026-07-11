// Pure data-shaping for the contact graph. Port of ContactGraphView.buildTracks +
// graphWindowBounds (Simulation/Views). Kept UI-free so it's unit-testable.
import type { ProbeReading } from '../models/LockSession';

export interface PlotPoint {
  wheelPosition: number;
  lo: number; // lower value (== hi for a single reading)
  hi: number;
}

export interface TrackDef {
  label: 'RCP' | 'LCP' | 'W';
  points: PlotPoint[]; // sorted by wheelPosition
  fallback: number;
  isMin: boolean; // extreme of interest: min for RCP/Width, max for LCP
}

export interface TrackOptions {
  contactAreaCenter: number;
  contactAreaWidth: number;
  showRCP?: boolean;
  showLCP?: boolean;
  showWidth?: boolean;
  precision?: number;
}

const roundedVal = (v: number, precision: number) => Math.round(v / precision) * precision;

// ±0.5 window snapped to nearest 0.5, plus ±0.125 padding. Matches graphWindowBounds().
export function graphWindowBounds(values: number[], fallback: number): [number, number] {
  const rawMin = values.length ? Math.min(...values) : fallback - 0.5;
  const rawMax = values.length ? Math.max(...values) : fallback + 0.5;
  const center = (rawMin + rawMax) / 2.0;
  const mid = Math.round(center * 2) / 2;
  const lo = Math.min(rawMin, mid - 0.5) - 0.125;
  const hi = Math.max(rawMax, mid + 0.5) + 0.125;
  return [lo, hi];
}

export function buildTracks(readings: ProbeReading[], opts: TrackOptions): TrackDef[] {
  const precision = opts.precision ?? 0.25;
  const showRCP = opts.showRCP ?? true;
  const showLCP = opts.showLCP ?? true;
  const showWidth = opts.showWidth ?? false;

  const makePoints = (filtered: ProbeReading[], value: (r: ProbeReading) => number): PlotPoint[] => {
    const groups = new Map<number, number[]>();
    for (const r of filtered) {
      const arr = groups.get(r.wheelPosition) ?? [];
      arr.push(roundedVal(value(r), precision));
      groups.set(r.wheelPosition, arr);
    }
    return [...groups.entries()]
      .map(([pos, vals]) => ({ wheelPosition: pos, lo: Math.min(...vals), hi: Math.max(...vals) }))
      .sort((a, b) => a.wheelPosition - b.wheelPosition);
  };

  const defs: TrackDef[] = [];
  if (showRCP) {
    defs.push({
      label: 'RCP',
      points: makePoints(readings.filter((r) => r.measuredContact !== 'lcp'), (r) => r.rcp),
      fallback: opts.contactAreaCenter + opts.contactAreaWidth / 2,
      isMin: true,
    });
  }
  if (showLCP) {
    defs.push({
      label: 'LCP',
      points: makePoints(readings.filter((r) => r.measuredContact !== 'rcp'), (r) => r.lcp),
      fallback: opts.contactAreaCenter - opts.contactAreaWidth / 2,
      isMin: false,
    });
  }
  if (showWidth) {
    // Prefer direction-specific readings over generic .both, per position.
    const rcpByPos = new Map<number, number[]>();
    const lcpByPos = new Map<number, number[]>();
    const push = (m: Map<number, number[]>, pos: number, v: number) => m.set(pos, [...(m.get(pos) ?? []), v]);
    for (const r of readings) {
      if (r.measuredContact === 'rcp') push(rcpByPos, r.wheelPosition, r.rcp);
      if (r.measuredContact === 'lcp') push(lcpByPos, r.wheelPosition, r.lcp);
    }
    for (const r of readings) {
      if (r.measuredContact !== 'both') continue;
      if (!rcpByPos.has(r.wheelPosition)) push(rcpByPos, r.wheelPosition, r.rcp);
      if (!lcpByPos.has(r.wheelPosition)) push(lcpByPos, r.wheelPosition, r.lcp);
    }
    const positions = [...rcpByPos.keys()].filter((p) => lcpByPos.has(p)).sort((a, b) => a - b);
    const points: PlotPoint[] = positions.map((pos) => {
      const rcps = rcpByPos.get(pos)!;
      const lcps = lcpByPos.get(pos)!;
      return {
        wheelPosition: pos,
        lo: roundedVal(Math.min(...rcps) - Math.max(...lcps), precision),
        hi: roundedVal(Math.max(...rcps) - Math.min(...lcps), precision),
      };
    });
    defs.push({ label: 'W', points, fallback: opts.contactAreaWidth, isMin: true });
  }
  return defs;
}

// The extreme (deducible gate) value for a track.
export function trackExtreme(def: TrackDef): number | null {
  if (def.points.length === 0) return null;
  return def.isMin ? Math.min(...def.points.map((p) => p.lo)) : Math.max(...def.points.map((p) => p.hi));
}
