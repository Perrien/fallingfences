import { describe, it, expect } from 'vitest';
import { UltraProbeEngine } from '../../src/sim/UltraProbeEngine';
import { wheelHeight } from '../../src/sim/ContactPointCalculator';
import type { LockProfile } from '../../src/models/LockProfile';
import type { Wheel } from '../../src/models/Wheel';

// Minimal profile: no oval, no noise, no false gates — so wheelHeight reduces to a clean
// base-minus-gate-cut curve. Only the fields wheelHeight reads need to be present.
const RANGE = 100;
const profile = {
  numberRange: RANGE,
  ovalEccentricity: 0,
  gateWidth: 2.0,
} as unknown as LockProfile;

function makeWheel(index: number, gatePosition: number, baseHeight: number): Wheel {
  return {
    index,
    gatePosition,
    baseHeight,
    noiseSamples: [],
    falseGates: [],
    ovalBumpPosition: 0,
    ovalFrequency: 1,
    currentPosition: 0,
  };
}

describe('UltraProbeEngine.sweep', () => {
  it('returns one sample per position in [0, numberRange)', () => {
    const wheels = [makeWheel(0, 20, 1.0), makeWheel(1, 70, 0.8)];
    const data = UltraProbeEngine.sweep(new Set([0, 1]), wheels, profile);
    expect(data.length).toBe(RANGE);
  });

  it('does not mutate the caller wheels', () => {
    const wheels = [makeWheel(0, 20, 1.0), makeWheel(1, 70, 0.8)];
    wheels[0].currentPosition = 42;
    wheels[1].currentPosition = 17;
    UltraProbeEngine.sweep(new Set([0, 1]), wheels, profile);
    expect(wheels[0].currentPosition).toBe(42);
    expect(wheels[1].currentPosition).toBe(17);
  });

  it('is the pointwise max of the free wheels at each step', () => {
    const a = makeWheel(0, 20, 1.0);
    const b = makeWheel(1, 70, 0.8);
    const data = UltraProbeEngine.sweep(new Set([0, 1]), [a, b], profile);
    for (let p = 0; p < RANGE; p++) {
      const ha = wheelHeight({ ...a, currentPosition: p }, profile);
      const hb = wheelHeight({ ...b, currentPosition: p }, profile);
      expect(data[p]).toBeCloseTo(Math.max(ha, hb), 12);
    }
  });

  it('holds locked wheels at their stored position', () => {
    const free = makeWheel(0, 20, 0.5);
    const locked = makeWheel(1, 70, 1.0);
    locked.currentPosition = 70; // sits in its own gate → height ~0, never the fence
    const data = UltraProbeEngine.sweep(new Set([0]), [free, locked], profile);
    for (let p = 0; p < RANGE; p++) {
      const hFree = wheelHeight({ ...free, currentPosition: p }, profile);
      const hLocked = wheelHeight({ ...locked, currentPosition: 70 }, profile);
      expect(data[p]).toBeCloseTo(Math.max(hFree, hLocked), 12);
    }
  });
});

describe('UltraProbeEngine.fenceIndex', () => {
  it('returns the index of the tallest wheel at the marker', () => {
    // Marker at 20: wheel 0 sits in its gate (~0), wheel 1 is far (~0.8) → wheel 1 is fence.
    const wheels = [makeWheel(0, 20, 1.0), makeWheel(1, 70, 0.8)];
    expect(UltraProbeEngine.fenceIndex(new Set([0, 1]), 20, wheels, profile)).toBe(1);
    // Marker at 70: wheel 1 in its gate (~0), wheel 0 far (~1.0) → wheel 0 is fence.
    expect(UltraProbeEngine.fenceIndex(new Set([0, 1]), 70, wheels, profile)).toBe(0);
  });

  it('breaks ties toward the first (lowest) index', () => {
    // Two identical wheels, marker far from both gates → equal heights → first wins.
    const wheels = [makeWheel(0, 20, 1.0), makeWheel(1, 20, 1.0)];
    expect(UltraProbeEngine.fenceIndex(new Set([0, 1]), 50, wheels, profile)).toBe(0);
  });
});
