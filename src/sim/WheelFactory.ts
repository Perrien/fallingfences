// Builds the Wheel[] from a LockProfile + Combination. Port of Simulation/WheelFactory.swift.
// RNG draw order is load-bearing and must match the Swift source exactly.
import type { LockProfile, ClosedRange, FalseGateConfig } from '../models/LockProfile';
import type { Combination } from '../models/Combination';
import type { Wheel, FalseGate } from '../models/Wheel';
import { SeededRNG } from './SeededRNG';
import { AngleNormalizer } from './AngleNormalizer';

export function makeWheels(profile: LockProfile, combination: Combination): Wheel[] {
  const rng = new SeededRNG(profile.seed);
  const baseHeights = assignBaseHeights(profile, rng);

  const safeCount = Math.min(profile.wheelCount, combination.gatePositions.length);
  const wheels: Wheel[] = [];
  for (let i = 0; i < safeCount; i++) {
    // Always draw so noise/false-gate sequences are stable regardless of the override.
    const ovalBumpRaw = rng.nextDoubleIn(0.0, profile.numberRange - 1.0);
    const ovalBumpPosition = profile.ovalBumpPositionOverride ?? ovalBumpRaw;
    const ovalFrequency = sampleOvalFrequency(profile.ovalFrequencyRange, rng);
    const noiseSamples = generateNoiseSamples(
      profile.surfaceNoiseAmplitude,
      profile.noiseHarmonicFrequencyRange,
      rng,
    );
    const falseGates = generateFalseGates(i, combination.gatePositions[i], profile, rng);
    wheels.push({
      index: i,
      gatePosition: combination.gatePositions[i],
      baseHeight: baseHeights[i],
      noiseSamples,
      falseGates,
      ovalBumpPosition,
      ovalFrequency,
      currentPosition: 0.0,
    });
  }
  return wheels;
}

// Skip the RNG draw on a degenerate range (keeps legacy tiers' sequences unchanged).
function sampleOvalFrequency(range: ClosedRange, rng: SeededRNG): number {
  if (range[0] === range[1]) return range[0];
  return rng.nextDoubleIn(range[0], range[1]);
}

function assignBaseHeights(profile: LockProfile, rng: SeededRNG): number[] {
  const count = profile.wheelCount;
  let ranked: number[];
  if (profile.baseHeightsByRank && profile.baseHeightsByRank.length === count) {
    ranked = [...profile.baseHeightsByRank];
  } else {
    ranked = Array.from({ length: count }, (_, rank) =>
      1.0 - (profile.heightSpread * rank) / Math.max(count - 1, 1),
    );
  }

  switch (profile.heightOrdering.kind) {
    case 'inOrder':
      ranked.reverse();
      break;
    case 'random':
      rng.shuffle(ranked);
      break;
    case 'custom': {
      const ordered = new Array<number>(count).fill(1.0);
      profile.heightOrdering.mapping.forEach((wheelIndex, rank) => {
        if (wheelIndex < count) ordered[wheelIndex] = ranked[rank];
      });
      ranked = ordered;
      break;
    }
  }
  return ranked;
}

// 200 samples of smooth low-frequency noise via a sum of 4 seeded sine harmonics.
function generateNoiseSamples(
  amplitude: number,
  frequencyRange: ClosedRange,
  rng: SeededRNG,
): number[] {
  if (amplitude <= 0) return new Array<number>(200).fill(0.0);

  const harmonics: { amp: number; freq: number; phase: number }[] = [];
  for (let h = 0; h < 4; h++) {
    harmonics.push({
      amp: rng.nextDoubleIn(0.1, 1.0),
      freq: rng.nextDoubleIn(frequencyRange[0], frequencyRange[1]),
      phase: rng.nextDoubleIn(0.0, 2 * Math.PI),
    });
  }

  const totalAmp = harmonics.reduce((s, h) => s + h.amp, 0);
  const scale = totalAmp > 0 ? amplitude / totalAmp : 0.0;

  return Array.from({ length: 200 }, (_, i) => {
    const t = (i / 200.0) * 2 * Math.PI;
    return harmonics.reduce((sum, h) => sum + h.amp * scale * Math.sin(h.freq * t + h.phase), 0);
  });
}

function generateFalseGates(
  wheelIndex: number,
  gatePosition: number,
  profile: LockProfile,
  rng: SeededRNG,
): FalseGate[] {
  const config: FalseGateConfig | null = profile.falseGateConfig;
  if (!config) return [];
  if (config.eligibleWheelIndices && !config.eligibleWheelIndices.includes(wheelIndex)) return [];

  // Gate count — NOTE: uses nextInt (plain modulo, always 1 draw), matching Swift.
  let count: number;
  const dist = config.distribution;
  switch (dist.kind) {
    case 'lastWheelOnly':
      if (wheelIndex !== profile.wheelCount - 1) return [];
      count = rng.nextInt(config.countRange[0], config.countRange[1]);
      break;
    case 'allWheels':
      count = rng.nextInt(config.countRange[0], config.countRange[1]);
      break;
    case 'randomSubset':
      if (rng.nextDouble() >= dist.probability) return [];
      count = rng.nextInt(config.countRange[0], config.countRange[1]);
      break;
    case 'halvingBase': {
      let n = 0;
      let p = dist.probability;
      while (p > 0.001) {
        if (rng.nextDouble() < p) {
          n += 1;
          p /= 2;
        } else {
          break;
        }
      }
      count = n;
      break;
    }
  }
  if (count <= 0) return [];

  const range = profile.numberRange;
  const minSep = 2.0 * profile.gateWidth;
  const candLower = Math.ceil(profile.gateSeamBuffer);
  const candUpper = Math.min(
    profile.numberRange - 1,
    Math.floor(range - profile.gateSeamBuffer),
  );
  const positions: number[] = [];
  let attempts = 0;
  while (positions.length < count && attempts < 300 && candLower <= candUpper) {
    attempts += 1;
    const candidate = Math.trunc(rng.nextDoubleIn(candLower, candUpper));
    const tooClose =
      AngleNormalizer.circularDistance(candidate, gatePosition, range) < minSep ||
      positions.some((p) => AngleNormalizer.circularDistance(candidate, p, range) < minSep);
    if (!tooClose) positions.push(candidate);
  }

  const gateWidth = config.width ?? profile.gateWidth;
  return positions.map((pos) => ({
    position: pos,
    depthRatio: rng.nextDoubleIn(config.depthRatioRange[0], config.depthRatioRange[1]),
    width: gateWidth,
  }));
}
