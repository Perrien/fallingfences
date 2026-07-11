import { describe, it, expect } from 'vitest';
import { WheelPositionEngine } from '../../src/sim/WheelPositionEngine';

// Ported from SafeCrackingTests/WheelPositionEngineTests.swift (deterministic, no RNG).
const engine = (wheels: number, range = 40) => new WheelPositionEngine(wheels, range);
const coupled = (e: WheelPositionEngine) => [...e.coupledIndices].sort((a, b) => a - b);

describe('WheelPositionEngine', () => {
  it('no wheels coupled at init', () => {
    const e = engine(3);
    expect(e.coupledIndices.size).toBe(0);
    expect(e.positions.every((p) => p === 0.0)).toBe(true);
  });

  it('2-wheel: wheel 0 picked up after traversing gapSize', () => {
    const e = engine(2, 40);
    e.rotate(e.gapSize - 0.1);
    expect(e.coupledIndices.size).toBe(0);
    e.rotate(0.2);
    expect(coupled(e)).toEqual([0]);
  });

  it('2-wheel: both wheels coupled after 2 × gapSize travel', () => {
    const e = engine(2, 40);
    e.rotate(80.1);
    expect(coupled(e)).toEqual([0, 1]);
  });

  it('3-wheel: wheels couple in order after each rotation', () => {
    const e = engine(3, 40);
    e.rotate(40.0);
    expect(coupled(e)).toEqual([0]);
    e.rotate(40.0);
    expect(coupled(e)).toEqual([0, 1]);
    e.rotate(40.0);
    expect(coupled(e)).toEqual([0, 1, 2]);
  });

  it('3-wheel: wheel 0 position correct after 1.5 rotations', () => {
    const e = engine(3, 40);
    e.rotate(60.0);
    expect(Math.abs(e.positions[0] - (60.0 - e.gapSize))).toBeLessThan(0.001);
    expect(Math.abs(e.positions[1] - 0.0)).toBeLessThan(0.001);
  });

  it('3-wheel: positions wrap correctly past numberRange', () => {
    const e = engine(3, 40);
    e.rotate(100.0);
    const expected = (100.0 - e.gapSize) % 40.0;
    expect(Math.abs(e.positions[0] - expected)).toBeLessThan(0.001);
  });

  it('no wheels move while gap is being re-traversed after reversal', () => {
    const e = engine(3, 40);
    e.rotate(200.0);
    expect(e.coupledIndices.size).toBe(3);
    e.rotate(-1.0);
    expect(e.coupledIndices.size).toBe(0);
  });

  it('wheels freeze at their current positions after reversal', () => {
    const e = engine(2, 40);
    e.rotate(50.0);
    const before = e.positions[0];
    e.rotate(-1.0);
    expect(e.positions[0]).toBe(before);
  });

  it('re-pickup after small reversal requires only re-traversing the opened gap', () => {
    const e = engine(2, 40);
    e.rotate(e.gapSize + 1.0);
    e.rotate(-3.0);
    e.rotate(2.9);
    expect(e.coupledIndices.size).toBe(0);
    e.rotate(0.2);
    expect(coupled(e)).toEqual([0]);
  });

  it('oscillation accumulates net position', () => {
    const e = engine(1, 40);
    e.rotate(e.gapSize + 5.0);
    expect(Math.abs(e.positions[0] - 5.0)).toBeLessThan(0.001);
    for (let k = 0; k < 3; k++) {
      e.rotate(-1.0);
      e.rotate(2.0);
    }
    expect(Math.abs(e.positions[0] - 8.0)).toBeLessThan(0.001);
  });

  it('CW pickup is immediate from home state', () => {
    const e = engine(1, 40);
    e.rotate(-0.1);
    expect(coupled(e)).toEqual([0]);
  });

  it('4-wheel: all coupled after 4 × gapSize travel', () => {
    const e = engine(4, 40);
    e.rotate(40.0 * 4 + 1.0);
    expect(coupled(e)).toEqual([0, 1, 2, 3]);
  });

  it('5-wheel: all coupled after 5 × gapSize travel', () => {
    const e = engine(5, 40);
    e.rotate(40.0 * 5 + 1.0);
    expect(e.coupledIndices.size).toBe(5);
  });

  it('right rotation from home couples immediately and decrements positions', () => {
    const e = engine(2, 40);
    e.rotate(-80.1);
    expect(coupled(e)).toEqual([0, 1]);
    expect(e.positions[1]).toBeGreaterThan(39.0);
    expect(e.positions[1]).toBeLessThan(40.0);
  });
});
