import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../../src/sim/SeededRNG';
import fixtures from '../vectors/rng.json';

// Fixtures are the Python oracle output (tools/gen_rng_fixtures.py), faithful to Swift.
// Exact equality is expected throughout — nextDouble/nextDoubleIn use identical IEEE-754
// ops in both languages.
const f = fixtures as any;

describe('SeededRNG.next() — raw 64-bit sequence', () => {
  for (const [seed, expected] of Object.entries<string[]>(f.next)) {
    it(`seed ${seed} reproduces ${expected.length} value(s)`, () => {
      const rng = new SeededRNG(BigInt(seed));
      for (const e of expected) expect(rng.next()).toBe(BigInt(e));
    });
  }

  it('seed 0 is remapped to a nonzero, deterministic value', () => {
    const a = new SeededRNG(0n).next();
    expect(a).toBe(new SeededRNG(0n).next());
    expect(a).not.toBe(0n);
  });

  it('seeds 1 and 2 differ on first output', () => {
    expect(new SeededRNG(1n).next()).not.toBe(new SeededRNG(2n).next());
  });
});

describe('SeededRNG.nextDouble() — unit interval', () => {
  for (const [seed, expected] of Object.entries<string[]>(f.nextDouble)) {
    it(`seed ${seed} matches oracle`, () => {
      const rng = new SeededRNG(BigInt(seed));
      for (const e of expected) {
        const v = rng.nextDouble();
        expect(v).toBe(parseFloat(e));
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
  }
});

describe('SeededRNG.nextDoubleIn() — closed range', () => {
  for (const key of Object.keys(f.nextDoubleIn)) {
    const c = f.nextDoubleIn[key];
    it(`seed ${c.seed} in [${c.lo}, ${c.hi}]`, () => {
      const rng = new SeededRNG(BigInt(c.seed));
      for (const e of c.values as string[]) expect(rng.nextDoubleIn(c.lo, c.hi)).toBe(parseFloat(e));
    });
  }
});

describe('SeededRNG.nextInt() — plain modulo (false-gate counts)', () => {
  for (const key of Object.keys(f.nextInt)) {
    const c = f.nextInt[key];
    it(`seed ${c.seed} in [${c.lo}, ${c.hi}]`, () => {
      const rng = new SeededRNG(BigInt(c.seed));
      for (const e of c.values as number[]) expect(rng.nextInt(c.lo, c.hi)).toBe(e);
    });
  }
});

describe('SeededRNG.nextUpperBound() — Lemire (stdlib next(upperBound:))', () => {
  for (const key of Object.keys(f.nextUpperBound)) {
    const c = f.nextUpperBound[key];
    it(`${key}`, () => {
      const rng = new SeededRNG(BigInt(c.seed));
      const got = (c.bounds as number[]).map((b) => rng.nextUpperBound(BigInt(b)).toString());
      expect(got).toEqual(c.results);
    });
  }
});

describe('SeededRNG.shuffle() — Fisher-Yates (Array.shuffle(using:))', () => {
  for (const key of Object.keys(f.shuffle)) {
    const c = f.shuffle[key];
    it(`${key}`, () => {
      const rng = new SeededRNG(BigInt(c.seed));
      const arr = Array.from({ length: c.n }, (_, i) => i);
      rng.shuffle(arr);
      expect(arr).toEqual(c.result);
    });
  }
});
