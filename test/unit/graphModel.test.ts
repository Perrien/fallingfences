import { describe, it, expect } from 'vitest';
import { buildTracks, graphWindowBounds, trackExtreme } from '../../src/render/graphModel';
import type { ProbeReading } from '../../src/models/LockSession';

function reading(pos: number, rcp: number, lcp: number, side: 'rcp' | 'lcp' | 'both'): ProbeReading {
  return {
    id: `${pos}-${side}`,
    wheelIndex: 0,
    wheelPosition: pos,
    rcp,
    lcp,
    width: rcp - lcp,
    configuration: { kind: 'allMoving' },
    timestamp: 0,
    measuredContact: side,
  };
}

describe('graphWindowBounds', () => {
  it('pads and snaps around a value cluster', () => {
    const [lo, hi] = graphWindowBounds([50.0, 50.5], 50);
    expect(lo).toBeLessThan(50.0);
    expect(hi).toBeGreaterThan(50.5);
    expect(hi - lo).toBeGreaterThanOrEqual(1.0);
  });

  it('falls back to a ±0.5 window when empty', () => {
    const [lo, hi] = graphWindowBounds([], 40);
    expect(lo).toBeLessThanOrEqual(39.5);
    expect(hi).toBeGreaterThanOrEqual(40.5);
  });
});

describe('buildTracks', () => {
  const opts = { contactAreaCenter: 50, contactAreaWidth: 8 };

  it('splits RCP and LCP tracks and sorts by position', () => {
    const readings = [reading(20, 54, 46, 'both'), reading(10, 53, 47, 'both')];
    const defs = buildTracks(readings, opts);
    expect(defs.map((d) => d.label)).toEqual(['RCP', 'LCP']);
    expect(defs[0].points.map((p) => p.wheelPosition)).toEqual([10, 20]);
    expect(defs[0].isMin).toBe(true); // RCP extreme is a minimum
    expect(defs[1].isMin).toBe(false); // LCP extreme is a maximum
  });

  it('groups multiple readings at one position into a lo/hi bar', () => {
    const readings = [reading(30, 54, 46, 'rcp'), reading(30, 52, 46, 'rcp')];
    const defs = buildTracks(readings, { ...opts, showLCP: false });
    expect(defs[0].points).toHaveLength(1);
    expect(defs[0].points[0].lo).toBe(52);
    expect(defs[0].points[0].hi).toBe(54);
  });

  it('trackExtreme picks the gate-revealing value (min RCP)', () => {
    const readings = [reading(10, 54, 46, 'rcp'), reading(50, 49, 46, 'rcp')];
    const defs = buildTracks(readings, { ...opts, showLCP: false });
    expect(trackExtreme(defs[0])).toBe(49); // lowest RCP → gate is near position 50
  });
});
