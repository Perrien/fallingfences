// The physical lock — port of Models/LockProfile.swift (struct + difficulty presets).
// Closed ranges are represented as [lo, hi] tuples.
import { SeededRNG } from '../sim/SeededRNG';

export type ClosedRange = readonly [number, number];

export type HeightOrdering =
  | { kind: 'inOrder' }
  | { kind: 'random' }
  | { kind: 'custom'; mapping: number[] }; // mapping[rank] = wheelIndex

export type Distribution =
  | { kind: 'allWheels' }
  | { kind: 'lastWheelOnly' }
  | { kind: 'randomSubset'; probability: number }
  | { kind: 'halvingBase'; probability: number };

export interface FalseGateConfig {
  readonly countRange: ClosedRange;
  readonly depthRatioRange: ClosedRange;
  readonly width: number | null; // null = match true gate width
  readonly distribution: Distribution;
  readonly eligibleWheelIndices: number[] | null; // null = all wheels
}

export interface LockProfile {
  readonly id: string;
  readonly seed: bigint; // UInt64
  readonly wheelCount: number;
  readonly numberRange: number;
  readonly heightOrdering: HeightOrdering;
  readonly heightSpread: number;
  readonly baseHeightsByRank: number[] | null;
  readonly surfaceNoiseAmplitude: number;
  readonly measurementNoise: number;
  readonly noiseHarmonicFrequencyRange: ClosedRange;
  readonly ovalEccentricity: number;
  readonly ovalFrequencyRange: ClosedRange;
  readonly ovalBumpPositionOverride: number | null;
  readonly gateWidth: number;
  readonly gateSeamBuffer: number;
  readonly falseGateConfig: FalseGateConfig | null;
  readonly contactAreaCenter: number;
  readonly contactAreaWidth: number;
  readonly rcpSensitivity: number;
  readonly lcpSensitivity: number;
}

// A nonzero UInt64 seed from crypto (combinations/locks are independently random).
export function randomSeed(): bigint {
  const buf = new BigUint64Array(1);
  crypto.getRandomValues(buf);
  return buf[0] === 0n ? 1n : buf[0];
}

// Fields common to every dial-tier preset; overridden per tier.
function base(seed: bigint, over: Partial<LockProfile> & Pick<LockProfile, 'wheelCount' | 'numberRange'>): LockProfile {
  const numberRange = over.numberRange;
  return {
    id: crypto.randomUUID(),
    seed,
    heightOrdering: { kind: 'random' },
    baseHeightsByRank: null,
    measurementNoise: 0.04,
    noiseHarmonicFrequencyRange: [1.0, 5.0],
    ovalFrequencyRange: [1.0, 1.0],
    ovalBumpPositionOverride: null,
    gateSeamBuffer: 0.0,
    contactAreaCenter: numberRange / 2.0,
    contactAreaWidth: (30.0 / 360.0) * numberRange,
    rcpSensitivity: 2.5,
    lcpSensitivity: 1.0,
    // required fields with no universal default must be supplied by `over`:
    heightSpread: 0,
    surfaceNoiseAmplitude: 0,
    ovalEccentricity: 0,
    gateWidth: 0,
    falseGateConfig: null,
    ...over,
  };
}

// --- Difficulty presets (port of LockProfile.beginner/standard/…). ---
// RNG draw order mirrors the Swift source exactly.

export function beginner(seed: bigint = randomSeed()): LockProfile {
  const rng = new SeededRNG(seed);
  const numberRange = rng.nextDouble() < 0.4 ? 40 : 60;
  const gateWidth = rng.nextDoubleIn(3.0, 4.0);
  const surfaceNoise = rng.nextDoubleIn(0.02, 0.04);
  return base(seed, {
    wheelCount: 3,
    numberRange,
    heightSpread: rng.nextDoubleIn(0.2, 0.3),
    surfaceNoiseAmplitude: surfaceNoise,
    ovalEccentricity: 0.0,
    gateWidth,
    falseGateConfig: null,
  });
}

export function standard(seed: bigint = randomSeed()): LockProfile {
  const rng = new SeededRNG(seed);
  const wheelCount = rng.nextDouble() < 0.55 ? 3 : 4;
  const numberRange = [40, 40, 60, 60, 60, 80, 80, 80][rng.nextInt(0, 7)];
  const gateWidth = rng.nextDoubleIn(2.2, 3.2);
  const surfaceNoise = rng.nextDoubleIn(0.03, 0.06);
  const oval = rng.nextDoubleIn(0.0, 0.08);
  const fgProb = rng.nextDoubleIn(0.1, 0.45);
  return base(seed, {
    wheelCount,
    numberRange,
    heightSpread: rng.nextDoubleIn(0.15, 0.25),
    surfaceNoiseAmplitude: surfaceNoise,
    ovalEccentricity: oval,
    gateWidth,
    falseGateConfig: {
      countRange: [1, 1],
      depthRatioRange: [0.2, 0.4],
      width: null,
      distribution: { kind: 'randomSubset', probability: fgProb },
      eligibleWheelIndices: null,
    },
  });
}

export function advanced(seed: bigint = randomSeed()): LockProfile {
  const rng = new SeededRNG(seed);
  const wheelCount = [3, 4, 4, 4, 4, 4, 5, 5, 5][rng.nextInt(0, 8)];
  const numberRange = [60, 80, 80, 80, 80, 80, 100, 100, 100][rng.nextInt(0, 8)];
  const gateWidth = rng.nextDoubleIn(1.8, 2.8);
  const surfaceNoise = rng.nextDoubleIn(0.03, 0.045);
  const oval = rng.nextDoubleIn(0.0, 0.12);
  const fgProb = rng.nextDoubleIn(0.2, 0.55);
  return base(seed, {
    wheelCount,
    numberRange,
    heightSpread: rng.nextDoubleIn(0.13, 0.22),
    surfaceNoiseAmplitude: surfaceNoise,
    ovalEccentricity: oval,
    gateWidth,
    falseGateConfig: {
      countRange: [1, 2],
      depthRatioRange: [0.2, 0.5],
      width: null,
      distribution: { kind: 'randomSubset', probability: fgProb },
      eligibleWheelIndices: null,
    },
  });
}

export function expert(seed: bigint = randomSeed()): LockProfile {
  const rng = new SeededRNG(seed);
  const wheelCount = rng.nextDouble() < 0.25 ? 4 : 5;
  const numberRange = [60, 80, 80, 80, 100, 100, 100, 100][rng.nextInt(0, 7)];
  const gateWidth = rng.nextDoubleIn(1.5, 2.2);
  const surfaceNoise = rng.nextDoubleIn(0.03, 0.05);
  const oval = rng.nextDoubleIn(0.1, 0.2);
  const fgProb = rng.nextDoubleIn(0.5, 0.8);
  return base(seed, {
    wheelCount,
    numberRange,
    heightSpread: rng.nextDoubleIn(0.1, 0.18),
    surfaceNoiseAmplitude: surfaceNoise,
    ovalEccentricity: oval,
    gateWidth,
    falseGateConfig: {
      countRange: [1, 2],
      depthRatioRange: [0.2, 0.6],
      width: null,
      distribution: { kind: 'randomSubset', probability: fgProb },
      eligibleWheelIndices: null,
    },
  });
}

// Ultra tier — analytical fence-height graph reading. Port of LockProfile.ultra.
// RNG draw order is parity-critical; the base-height step draw is CONDITIONAL
// (only drawn when stepFloor < stepCap) — replicate exactly in the oracle.
export function ultra(wheelCount = 10, seed: bigint = randomSeed()): LockProfile {
  const rng = new SeededRNG(seed);
  const numberRange = 100;
  const gateWidth = rng.nextDoubleIn(1.5, 2.2);
  const surfaceNoise = rng.nextDoubleIn(0.03, 0.05);
  const oval = rng.nextDoubleIn(0.1, 0.5);
  const center = numberRange / 2.0;

  // Per-wheel random spread within a budget that keeps the shortest wheel's
  // surface (base + oval + noise) above 0. Each rank-step is uniform in
  // [stepFloor, stepCap]; when the budget is tight the range collapses to a
  // single value (no draw) rather than violating the floor.
  const safetyMargin = 0.05;
  const totalBudget = Math.max(0.0, 1.0 - oval - surfaceNoise - safetyMargin);
  const denom = Math.max(wheelCount - 1, 1);
  const absMin = 0.02;
  const absMax = 0.08;
  const stepCap = Math.min(absMax, 1.0 / denom, totalBudget / denom);
  const stepFloor = Math.min(absMin, stepCap);
  const baseHeights: number[] = [1.0];
  for (let i = 0; i < Math.max(wheelCount - 1, 0); i++) {
    const step = stepFloor < stepCap ? rng.nextDoubleIn(stepFloor, stepCap) : stepFloor;
    baseHeights.push(baseHeights[baseHeights.length - 1] - step);
  }
  const spread = 1.0 - baseHeights[baseHeights.length - 1];

  return base(seed, {
    wheelCount,
    numberRange,
    heightOrdering: { kind: 'random' },
    heightSpread: spread,
    baseHeightsByRank: baseHeights,
    surfaceNoiseAmplitude: surfaceNoise,
    measurementNoise: 0.04,
    noiseHarmonicFrequencyRange: [3.0, 10.0], // ⚠ base defaults [1.0, 5.0]
    ovalEccentricity: oval,
    ovalFrequencyRange: [0.25, 2.0],
    ovalBumpPositionOverride: 0.0,
    gateWidth,
    gateSeamBuffer: gateWidth,
    falseGateConfig: {
      countRange: [1, 3],
      depthRatioRange: [0.2, 0.55],
      width: null,
      distribution: { kind: 'halvingBase', probability: 0.95 },
      eligibleWheelIndices: null,
    },
    contactAreaCenter: center,
    contactAreaWidth: (30.0 / 360.0) * numberRange,
    rcpSensitivity: 2.5,
    lcpSensitivity: 1.0,
  });
}

export function examination(seed: bigint = randomSeed()): LockProfile {
  // All parameters fixed (no RNG draws beyond wheel construction).
  return base(seed, {
    wheelCount: 5,
    numberRange: 100,
    heightSpread: 0.07,
    surfaceNoiseAmplitude: 0.1,
    ovalEccentricity: 0.4,
    gateWidth: 1.5,
    falseGateConfig: {
      countRange: [1, 3],
      depthRatioRange: [0.3, 0.65],
      width: null,
      distribution: { kind: 'halvingBase', probability: 0.9 },
      eligibleWheelIndices: null,
    },
  });
}
