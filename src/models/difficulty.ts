// Difficulty rating (0–9999). Port of Models/LockProfile+Difficulty.swift.
import type { LockProfile } from './LockProfile';

// Pass actualFalseGateCount from generated wheels for an exact score; omit to estimate.
export function difficultyRating(p: LockProfile, actualFalseGateCount: number | null = null): number {
  const fg =
    actualFalseGateCount !== null ? Math.min(1.0, actualFalseGateCount / 10.0) : falseGateNormalizedScore(p);
  const gw = (4.0 - p.gateWidth) / 3.0;
  const sn = (p.surfaceNoiseAmplitude - 0.02) / 0.06;
  const mn = (p.measurementNoise - 0.02) / 0.38;
  const ov = p.ovalEccentricity / 0.2;
  const wc = (p.wheelCount - 3.0) / 2.0;
  const nr = (p.numberRange - 40.0) / 60.0;

  const score = wc * 0.2 + fg * 0.22 + gw * 0.18 + sn * 0.18 + nr * 0.1 + mn * 0.07 + ov * 0.05;
  return Math.round(Math.min(1.0, Math.max(0.0, score)) * 9999);
}

function falseGateNormalizedScore(p: LockProfile): number {
  const config = p.falseGateConfig;
  if (!config) return 0.0;
  let probability: number;
  switch (config.distribution.kind) {
    case 'randomSubset':
    case 'halvingBase':
      probability = config.distribution.probability;
      break;
    case 'allWheels':
      probability = 1.0;
      break;
    case 'lastWheelOnly':
      probability = 1.0 / Math.max(p.wheelCount, 1);
      break;
  }
  const midCount = (config.countRange[0] + config.countRange[1]) / 2.0;
  return probability * Math.min(1.0, midCount / 3.0);
}
