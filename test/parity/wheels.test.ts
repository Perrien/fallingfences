import { describe, it, expect } from 'vitest';
import { makeWheels } from '../../src/sim/WheelFactory';
import { wheelHeight } from '../../src/sim/ContactPointCalculator';
import type { LockProfile } from '../../src/models/LockProfile';
import fixtures from '../vectors/wheels.json';

// Parity for WheelFactory.makeWheels + ContactPointCalculator.wheelHeight against the
// Python oracle (faithful to WheelFactory.swift). Tolerances: RNG-derived values are
// exact; heights carry trig (sin/cos) so use 1e-6 (matches the Swift tests' tolerances).
const f = fixtures as any;

// Fixture profile JSON → LockProfile (only conversion needed is seed string → bigint).
function toProfile(p: any): LockProfile {
  return { ...p, seed: BigInt(p.seed) } as LockProfile;
}

describe('WheelFactory + wheelHeight parity', () => {
  for (const entry of f.profiles as any[]) {
    describe(entry.name, () => {
      const profile = toProfile(entry.profile);
      const combination = { gatePositions: entry.combination as number[] };
      const exp = entry.expected;

      it('base heights', () => {
        const wheels = makeWheels(profile, combination);
        wheels.forEach((w, i) => expect(w.baseHeight).toBeCloseTo(exp.baseHeights[i], 10));
      });

      it('oval frequencies + bump positions', () => {
        const wheels = makeWheels(profile, combination);
        wheels.forEach((w, i) => {
          expect(w.ovalFrequency).toBeCloseTo(exp.ovalFrequencies[i], 10);
          expect(w.ovalBumpPosition).toBeCloseTo(exp.ovalBumps[i], 10);
        });
      });

      it('false gates (position, depth, width)', () => {
        const wheels = makeWheels(profile, combination);
        wheels.forEach((w, i) => {
          const expGates = exp.falseGates[i] as any[];
          expect(w.falseGates.length).toBe(expGates.length);
          w.falseGates.forEach((fg, k) => {
            expect(fg.position).toBe(expGates[k].position);
            expect(fg.depthRatio).toBeCloseTo(parseFloat(expGates[k].depthRatio), 10);
            expect(fg.width).toBe(expGates[k].width);
          });
        });
      });

      it('surface noise samples', () => {
        const wheels = makeWheels(profile, combination);
        wheels.forEach((w, i) => {
          (exp.noiseFirst8[i] as string[]).forEach((e, k) =>
            expect(w.noiseSamples[k]).toBeCloseTo(parseFloat(e), 9),
          );
        });
      });

      it('wheel heights across sample positions', () => {
        const wheels = makeWheels(profile, combination);
        const positions = exp.heights.positions as number[];
        wheels.forEach((w, i) => {
          positions.forEach((pos, k) => {
            w.currentPosition = pos;
            expect(wheelHeight(w, profile)).toBeCloseTo(parseFloat(exp.heights.perWheel[i][k]), 6);
          });
        });
      });
    });
  }
});

// Hard Swift-ground-truth checkpoint: the exact values asserted in
// SafeCrackingTests/DiagnosticParityTests.swift (seed 12345). Independent of the oracle —
// if the port drifts from Swift, this fails even if TS still matches its own fixtures.
describe('Swift ground truth — DiagnosticParityTests (seed 12345)', () => {
  const entry = (f.profiles as any[]).find((e) => e.name === 'diagnosticParity');
  const profile = toProfile(entry.profile);
  const combination = { gatePositions: entry.combination as number[] };

  it('reproduces the Swift-asserted wheel parameters', () => {
    const wheels = makeWheels(profile, combination);
    expect(wheels[0].baseHeight).toBeCloseTo(1.0, 3);
    expect(wheels[1].baseHeight).toBeCloseTo(0.965, 3);
    expect(wheels[2].baseHeight).toBeCloseTo(0.93, 3);

    expect(wheels[0].ovalFrequency).toBeCloseTo(0.558, 3);
    expect(wheels[1].ovalFrequency).toBeCloseTo(0.764, 3);
    expect(wheels[2].ovalFrequency).toBeCloseTo(1.771, 3);

    expect(wheels[0].falseGates.map((g) => g.position)).toEqual([79]);
    expect(wheels[1].falseGates.map((g) => g.position).sort((a, b) => a - b)).toEqual([34, 41]);
    expect(wheels[2].falseGates.map((g) => g.position).sort((a, b) => a - b)).toEqual([3, 12, 28]);
  });
});
