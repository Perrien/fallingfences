// Solve-score calculation. Port of Simulation/SolveScoring.swift (SolveScoreCalculator).
export interface SolveScoreResult {
  base: number;
  efficiencyModifier: number; // fraction: 0.05 = +5%
  efficiencyPoints: number; // signed
  manualProbeBonus: number; // fraction: 0.10 or 0.20
  manualProbeBonusPoints: number; // >= 0
  total: number;
}

export const SolveScoreCalculator = {
  baseScore(difficultyRating: number): number {
    return difficultyRating;
  },

  // Efficiency = totalProbes / (wheels × digits). Tiers: <1 exceptional → 6+ spam.
  efficiencyModifier(efficiency: number): number {
    if (efficiency < 1) return 0.2;
    if (efficiency < 2) return 0.1;
    if (efficiency < 3) return 0.05;
    if (efficiency < 4) return 0.0;
    if (efficiency < 5) return -0.05;
    if (efficiency < 6) return -0.1;
    return -0.2;
  },

  manualProbeBonus(sweepCount: number): number {
    if (sweepCount >= 100) return 0.2;
    if (sweepCount >= 50) return 0.1;
    return 0.0;
  },

  compute(difficultyRating: number, efficiency: number, manualSweepCount: number): SolveScoreResult {
    const base = this.baseScore(difficultyRating);
    const effMod = this.efficiencyModifier(efficiency);
    const probMod = this.manualProbeBonus(manualSweepCount);
    const effPts = Math.round(base * effMod);
    const probPts = Math.round(base * probMod);
    const total = Math.max(0, base + effPts + probPts);
    return {
      base,
      efficiencyModifier: effMod,
      efficiencyPoints: effPts,
      manualProbeBonus: probMod,
      manualProbeBonusPoints: probPts,
      total,
    };
  },
};
