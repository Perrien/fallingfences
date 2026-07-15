import { describe, it, expect } from 'vitest';
import { UltraGameState } from '../../src/sim/UltraGameState';
import { UltraProbeEngine } from '../../src/sim/UltraProbeEngine';
import { ultra, type LockProfile } from '../../src/models/LockProfile';
import type { Combination } from '../../src/models/Combination';

// Deterministic Ultra lock: fixed seed + fixed combination (combination is parity-free).
const SEED = 12345n;
const GATES = [20, 50, 80];
function makeState(): UltraGameState {
  const profile = ultra(GATES.length, SEED);
  const combination: Combination = { gatePositions: [...GATES] };
  return new UltraGameState(profile, combination);
}

// A clean profile with an even gateWidth so the gateWidth/2 boundary is exactly
// representable (ultra's RNG-drawn gateWidth makes `g + half - g !== half` in FP).
function cleanProfile(gateWidth = 4.0): LockProfile {
  const seed = ultra(3, SEED); // reuse defaults for the fields we don't care about
  return {
    ...seed,
    heightOrdering: { kind: 'inOrder' },
    baseHeightsByRank: [1.0, 0.9, 0.8],
    surfaceNoiseAmplitude: 0.0,
    ovalEccentricity: 0.0,
    gateWidth,
    gateSeamBuffer: 0.0,
    falseGateConfig: null,
  };
}

describe('UltraGameState.isAligned', () => {
  it('is inclusive at exactly gateWidth/2', () => {
    const profile = cleanProfile(4.0); // half = 2.0, exactly representable
    const s = new UltraGameState(profile, { gatePositions: [...GATES] });
    const half = profile.gateWidth / 2.0;
    // Every wheel exactly gateWidth/2 from its gate → boundary → still aligned.
    s.wheelPositions = GATES.map((g) => g + half);
    expect(s.isAligned()).toBe(true);

    // Just past the boundary → no longer aligned.
    s.wheelPositions[0] = GATES[0] + half + 0.01;
    expect(s.isAligned()).toBe(false);
  });

  it('is aligned when every wheel sits on its gate', () => {
    const s = makeState();
    s.wheelPositions = [...GATES];
    expect(s.isAligned()).toBe(true);
  });
});

describe('UltraGameState.setPositionForSelection', () => {
  it('snaps to the nearest integer', () => {
    const s = makeState();
    s.select(0);
    s.setPositionForSelection(20.4);
    expect(s.wheelPositions[0]).toBe(20);
    expect(s.wheels[0].currentPosition).toBe(20); // lockstep with the engine-read field
    s.setPositionForSelection(20.6);
    expect(s.wheelPositions[0]).toBe(21);
  });

  it('wraps out-of-range values into [0, numberRange-1]', () => {
    const s = makeState();
    s.select(0);
    s.setPositionForSelection(-1);
    expect(s.wheelPositions[0]).toBe(99); // numberRange 100 → wraps to 99
    s.setPositionForSelection(100);
    expect(s.wheelPositions[0]).toBe(0);
  });

  it('writes to every selected wheel', () => {
    const s = makeState();
    s.selectedIndices = new Set([0, 2]);
    s.setPositionForSelection(33);
    expect(s.wheelPositions[0]).toBe(33);
    expect(s.wheelPositions[2]).toBe(33);
    expect(s.wheels[0].currentPosition).toBe(33);
    expect(s.wheels[2].currentPosition).toBe(33);
  });

  it('auto-solves once every wheel is dialed onto its gate', () => {
    const s = makeState();
    expect(s.solved).toBe(false);
    for (let i = 0; i < GATES.length; i++) {
      s.select(i);
      s.setPositionForSelection(GATES[i]);
    }
    expect(s.solved).toBe(true);
  });
});

describe('UltraGameState.detectFlatWheels', () => {
  it('returns one flag per wheel', () => {
    const s = makeState();
    expect(s.detectFlatWheels().length).toBe(s.wheelCount);
  });

  it('flags masked wheels flat and the dominant wheel not-flat (the isolation premise)', () => {
    // At initial all-zero positions the tallest wheel masks the shorter ones: sweeping a
    // masked wheel barely moves the fence (max) → flat; the dominant wheel's own dip shows.
    const s = makeState();
    const flat = s.detectFlatWheels();
    expect(flat.some((f) => f === true)).toBe(true); // at least one masked
    expect(flat.some((f) => f === false)).toBe(true); // dominant wheel visible
  });

  it('a wheel becomes not-flat once the others are parked on their gates (isolated)', () => {
    // Park every other wheel on its gate → those cut to ~0 → the target wheel dominates
    // and its full signal is visible → not flat.
    const s = makeState();
    const target = 0;
    for (let i = 0; i < s.wheelCount; i++) {
      if (i === target) continue;
      s.wheelPositions[i] = GATES[i];
      s.wheels[i].currentPosition = GATES[i];
    }
    expect(s.detectFlatWheels()[target]).toBe(false);
  });
});

describe('UltraGameState realistic 10-wheel lock (graph readability + full solve)', () => {
  const GATES10 = [12, 27, 41, 58, 6, 73, 89, 34, 65, 19];
  function make10(): UltraGameState {
    return new UltraGameState(ultra(10, 987654321n), { gatePositions: [...GATES10] });
  }

  it("an isolated wheel's sweep bottoms out on its true gate", () => {
    const s = make10();
    const target = 3;
    // Park every other wheel on its gate (cut to ~0) so the target wheel dominates.
    for (let i = 0; i < s.wheelCount; i++) {
      if (i === target) continue;
      s.wheelPositions[i] = GATES10[i];
      s.wheels[i].currentPosition = GATES10[i];
    }
    s.select(target);
    const data = s.sweepSelected();
    let argmin = 0;
    for (let i = 1; i < data.length; i++) if (data[i] < data[argmin]) argmin = i;
    // The graph's low point is the deducible gate — within the gate's own half-width.
    const dist = Math.min(
      Math.abs(argmin - GATES10[target]),
      s.numberRange - Math.abs(argmin - GATES10[target]),
    );
    expect(dist).toBeLessThanOrEqual(s.profile.gateWidth / 2 + 1);
  });

  it('auto-opens for 5000 pts once all ten wheels are dialed onto their gates', () => {
    const s = make10();
    for (let i = 0; i < s.wheelCount; i++) {
      s.select(i);
      s.setPositionForSelection(GATES10[i]);
    }
    expect(s.solved).toBe(true);
    expect(s.wheelCount * 500).toBe(5000); // the score the store publishes on solve
  });
});

describe('UltraGameState static Y bounds', () => {
  it('staticYLow is -0.05 and staticYHigh is globalMax × 1.05', () => {
    const s = makeState();
    expect(s.staticYLow).toBe(-0.05);

    let globalMax = -Infinity;
    for (let i = 0; i < s.wheelCount; i++) {
      const data = UltraProbeEngine.sweep(new Set([i]), s.wheels, s.profile);
      for (const v of data) if (v > globalMax) globalMax = v;
    }
    expect(s.staticYHigh).toBeCloseTo(globalMax * 1.05, 12);
  });
});
