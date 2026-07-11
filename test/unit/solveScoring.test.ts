import { describe, it, expect } from 'vitest';
import { SolveScoreCalculator } from '../../src/sim/SolveScoring';

describe('SolveScoreCalculator', () => {
  it('base score equals difficulty rating', () => {
    expect(SolveScoreCalculator.baseScore(1234)).toBe(1234);
  });

  it('efficiency modifier tiers', () => {
    expect(SolveScoreCalculator.efficiencyModifier(0.5)).toBe(0.2);
    expect(SolveScoreCalculator.efficiencyModifier(1)).toBe(0.1);
    expect(SolveScoreCalculator.efficiencyModifier(2)).toBe(0.05);
    expect(SolveScoreCalculator.efficiencyModifier(3)).toBe(0.0);
    expect(SolveScoreCalculator.efficiencyModifier(4)).toBe(-0.05);
    expect(SolveScoreCalculator.efficiencyModifier(5)).toBe(-0.1);
    expect(SolveScoreCalculator.efficiencyModifier(6)).toBe(-0.2);
    expect(SolveScoreCalculator.efficiencyModifier(99)).toBe(-0.2);
  });

  it('manual probe bonus thresholds', () => {
    expect(SolveScoreCalculator.manualProbeBonus(0)).toBe(0.0);
    expect(SolveScoreCalculator.manualProbeBonus(49)).toBe(0.0);
    expect(SolveScoreCalculator.manualProbeBonus(50)).toBe(0.1);
    expect(SolveScoreCalculator.manualProbeBonus(100)).toBe(0.2);
  });

  it('compute combines base + efficiency + manual bonus', () => {
    const r = SolveScoreCalculator.compute(1000, 0.5 /* +20% */, 100 /* +20% */);
    expect(r.base).toBe(1000);
    expect(r.efficiencyPoints).toBe(200);
    expect(r.manualProbeBonusPoints).toBe(200);
    expect(r.total).toBe(1400);
  });

  it('total never goes below zero', () => {
    const r = SolveScoreCalculator.compute(100, 99 /* -20% */, 0);
    expect(r.total).toBeGreaterThanOrEqual(0);
  });
});
