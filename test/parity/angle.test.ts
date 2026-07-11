import { describe, it, expect } from 'vitest';
import { AngleNormalizer } from '../../src/sim/AngleNormalizer';
import fixtures from '../vectors/angle.json';

const f = fixtures as any;

describe('AngleNormalizer.circularDistance', () => {
  for (const c of f.circularDistance as any[]) {
    it(`d(${c.a}, ${c.b}, r=${c.r})`, () => {
      expect(AngleNormalizer.circularDistance(c.a, c.b, c.r)).toBe(parseFloat(c.expected));
    });
  }
});

describe('AngleNormalizer.normalizePosition', () => {
  for (const c of f.normalizePosition as any[]) {
    it(`norm(${c.p}, r=${c.r})`, () => {
      expect(AngleNormalizer.normalizePosition(c.p, c.r)).toBe(parseFloat(c.expected));
    });
  }
});
