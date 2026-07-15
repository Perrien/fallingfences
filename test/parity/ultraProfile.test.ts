import { describe, it, expect } from 'vitest';
import { ultra } from '../../src/models/LockProfile';
import fixtures from '../vectors/wheels.json';

// Parity for LockProfile.ultra against the Python oracle (ultra_profile). The oracle's
// emitted profile JSON *is* the expected scalar set — if the TS preset's RNG draw order
// (especially the CONDITIONAL base-height step draw) drifts, these scalars diverge.
// Two seeds cover both branches: "ultra" (10 wheels → step DRAW),
// "ultraTight" (40 wheels → step NO-DRAW).
const f = fixtures as any;

describe('LockProfile.ultra profile parity', () => {
  for (const name of ['ultra', 'ultraTight']) {
    const entry = (f.profiles as any[]).find((e) => e.name === name);
    const oracle = entry.profile;

    describe(name, () => {
      const p = ultra(oracle.wheelCount, BigInt(oracle.seed));

      it('reproduces scalar draws (gateWidth, surfaceNoise, oval)', () => {
        expect(p.gateWidth).toBeCloseTo(oracle.gateWidth, 10);
        expect(p.gateSeamBuffer).toBeCloseTo(oracle.gateWidth, 10);
        expect(p.surfaceNoiseAmplitude).toBeCloseTo(oracle.surfaceNoiseAmplitude, 10);
        expect(p.ovalEccentricity).toBeCloseTo(oracle.ovalEccentricity, 10);
      });

      it('reproduces baseHeightsByRank exactly (incl. conditional step draw)', () => {
        expect(p.baseHeightsByRank).not.toBeNull();
        expect(p.baseHeightsByRank!.length).toBe(oracle.baseHeightsByRank.length);
        p.baseHeightsByRank!.forEach((h, i) =>
          expect(h).toBeCloseTo(oracle.baseHeightsByRank[i], 10),
        );
      });

      it('reproduces derived heightSpread', () => {
        expect(p.heightSpread).toBeCloseTo(oracle.heightSpread, 10);
      });
    });
  }
});
