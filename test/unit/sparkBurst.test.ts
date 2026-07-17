import { describe, it, expect } from 'vitest';
import { makeSparks, sparkState } from '../../src/render/sparkBurst';

describe('sparkBurst.makeSparks', () => {
  it('generates the requested count with values in the documented ranges', () => {
    const sparks = makeSparks(160, 100);
    expect(sparks.length).toBe(160);
    for (const s of sparks) {
      expect(s.angle).toBeGreaterThanOrEqual(0);
      expect(s.angle).toBeLessThan(Math.PI * 2);
      expect(s.speed).toBeGreaterThanOrEqual(0.4 * 100);
      expect(s.speed).toBeLessThanOrEqual(2.5 * 100);
      expect(s.delay).toBeGreaterThanOrEqual(0);
      expect(s.delay).toBeLessThanOrEqual(0.4);
      expect(s.lifetime).toBeGreaterThanOrEqual(1.8);
      expect(s.lifetime).toBeLessThanOrEqual(5.0);
      expect(s.size).toBeGreaterThanOrEqual(1.5);
      expect(s.size).toBeLessThanOrEqual(3.5);
      expect(s.hue).toBeGreaterThanOrEqual(0.09);
      expect(s.hue).toBeLessThanOrEqual(0.15);
    }
  });
});

describe('sparkBurst.sparkState', () => {
  const s = { angle: 0, speed: 100, delay: 0.2, lifetime: 2.0, size: 2, hue: 0.1 };

  it('is null before the particle\'s delay has elapsed', () => {
    expect(sparkState(s, 0, 100)).toBeNull();
    expect(sparkState(s, 0.1, 100)).toBeNull();
  });

  it('is null once local time exceeds the lifetime', () => {
    expect(sparkState(s, s.delay + s.lifetime + 0.01, 100)).toBeNull();
  });

  it('moves outward along its angle and fades alpha toward 0 over its lifetime', () => {
    const early = sparkState(s, s.delay + 0.1, 100)!;
    const late = sparkState(s, s.delay + s.lifetime - 0.01, 100)!;
    expect(early).not.toBeNull();
    expect(late).not.toBeNull();
    // angle 0 → travels in +x; alpha decreases as local time approaches lifetime.
    expect(late.x).toBeGreaterThan(early.x);
    expect(late.alpha).toBeLessThan(early.alpha);
    expect(early.alpha).toBeLessThanOrEqual(1);
    expect(late.alpha).toBeGreaterThanOrEqual(0);
  });

  it('adds a gravity term (0.5 * diameter*0.35 * t²) on top of the linear velocity component', () => {
    const diameter = 100;
    const local = 1.0;
    const point = sparkState(s, s.delay + local, diameter)!;
    const gravity = diameter * 0.35;
    const expectedY = s.speed * Math.sin(s.angle) * local + 0.5 * gravity * local * local;
    expect(point.y).toBeCloseTo(expectedY, 9);
  });
});
