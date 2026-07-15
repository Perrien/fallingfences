import { describe, it, expect } from 'vitest';
import { gateMarkers, xAxisLabels, scrubIndexDelta } from '../../src/render/ultraGraphModel';

describe('gateMarkers', () => {
  it('returns empty for empty data', () => {
    expect(gateMarkers([])).toEqual({ minValue: 0, indices: [], segments: [] });
  });

  it('finds every index tying the global minimum (within epsilon)', () => {
    // Min 0.10 at indices 2 and 3; the +1e-12 tie still counts.
    const data = [1.0, 0.5, 0.1, 0.1 + 1e-12, 0.4, 0.9];
    const gm = gateMarkers(data);
    expect(gm.minValue).toBeCloseTo(0.1, 12);
    expect(gm.indices).toEqual([2, 3]);
  });

  it('groups consecutive extremes within 5 positions into segments', () => {
    // Extremes at 1, 4, 20 (all value 0). 1→4 gap 3 (≤5, joined); 4→20 gap 16 (not joined).
    const data = new Array(30).fill(1.0);
    data[1] = 0;
    data[4] = 0;
    data[20] = 0;
    const gm = gateMarkers(data);
    expect(gm.indices).toEqual([1, 4, 20]);
    expect(gm.segments).toEqual([[1, 4]]);
  });

  it('joins a run of adjacent extremes into chained segments', () => {
    // A gate floor spanning indices 10,11,12 → two connector segments.
    const data = new Array(20).fill(0.8);
    data[10] = 0.2;
    data[11] = 0.2;
    data[12] = 0.2;
    const gm = gateMarkers(data);
    expect(gm.indices).toEqual([10, 11, 12]);
    expect(gm.segments).toEqual([
      [10, 11],
      [11, 12],
    ]);
  });

  it('does not join extremes exactly 6 apart (>5)', () => {
    const data = new Array(20).fill(1.0);
    data[3] = 0;
    data[9] = 0; // gap 6
    const gm = gateMarkers(data);
    expect(gm.segments).toEqual([]);
  });
});

describe('scrubIndexDelta (velocity-scaled 1-finger drag)', () => {
  // plotWidth 500, numberRange 100 → pxPerUnit = 5 (5 px per dial unit).
  const PW = 500;
  const NR = 100;

  it('maps 1:1 with the graph at/above the reference velocity', () => {
    // Fast drag (|vx| ≥ 800) → scale 1.0. 50 px / 5 px-per-unit = 10 units.
    expect(scrubIndexDelta(50, 800, PW, NR)).toBeCloseTo(10, 12);
    expect(scrubIndexDelta(50, 5000, PW, NR)).toBeCloseTo(10, 12); // clamped at 1.0
  });

  it('slows to the 30% floor for very slow drags', () => {
    // Slow drag (|vx| → 0) → scale clamps up to 0.30. 50 px → 10 × 0.30 = 3 units.
    expect(scrubIndexDelta(50, 0, PW, NR)).toBeCloseTo(3, 12);
    expect(scrubIndexDelta(50, 100, PW, NR)).toBeCloseTo(3, 12); // 100/800 < 0.30 → floor
  });

  it('scales linearly between the floor and the reference velocity', () => {
    // |vx| = 400 → scale 0.5. 50 px → 10 × 0.5 = 5 units.
    expect(scrubIndexDelta(50, 400, PW, NR)).toBeCloseTo(5, 12);
  });

  it('preserves drag direction (sign of dx)', () => {
    expect(scrubIndexDelta(-50, 800, PW, NR)).toBeCloseTo(-10, 12);
  });
});

describe('xAxisLabels', () => {
  it('labels every 10 across a 100-dial', () => {
    expect(xAxisLabels(100)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
  });

  it('respects a custom step', () => {
    expect(xAxisLabels(60, 20)).toEqual([0, 20, 40]);
  });
});
