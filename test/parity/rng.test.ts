import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../../src/sim/SeededRNG';
import fixtures from '../vectors/rng.json';

// These fixtures are the Python oracle output (tools/gen_rng_fixtures.py), which
// reproduces Swift's SeededRNG bit-for-bit. Exact equality is expected for all
// RNG-derived integer values; nextDouble/nextDoubleIn use the same IEEE-754 ops in
// both languages, so exact equality holds there too.

const f = fixtures as any;

describe('SeededRNG.next() — raw 64-bit sequence', () => {
  for (const [seed, expected] of Object.entries<string[]>(f.next)) {
    it(`seed ${seed} reproduces ${expected.length} value(s)`, () => {
      const rng = new SeededRNG(BigInt(seed));
      for (const e of expected) {
        expect(rng.next()).toBe(BigInt(e));
      }
    });
  }

  it('seed 0 is remapped to a nonzero, deterministic value', () => {
    const a = new SeededRNG(0n).next();
    const b = new SeededRNG(0n).next();
    expect(a).toBe(b);
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
      for (const e of c.values as string[]) {
        const v = rng.nextDoubleIn(c.lo, c.hi);
        expect(v).toBe(parseFloat(e));
        expect(v).toBeGreaterThanOrEqual(c.lo);
        expect(v).toBeLessThanOrEqual(c.hi);
      }
    });
  }
});

describe('SeededRNG.nextInt() — plain modulo', () => {
  for (const key of Object.keys(f.nextInt)) {
    const c = f.nextInt[key];
    it(`seed ${c.seed} in [${c.lo}, ${c.hi}]`, () => {
      const rng = new SeededRNG(BigInt(c.seed));
      for (const e of c.values as number[]) {
        expect(rng.nextInt(c.lo, c.hi)).toBe(e);
      }
    });
  }
});

describe('SeededRNG.swiftInt() — rejection sampling (shuffle primitive)', () => {
  for (const key of Object.keys(f.swiftInt)) {
    const c = f.swiftInt[key];
    it(`${key}`, () => {
      const rng = new SeededRNG(BigInt(c.seed));
      const results = (c.calls as [number, number][]).map(([lo, hi]) => rng.swiftInt(lo, hi));
      expect(results).toEqual(c.results);
    });
  }
});
