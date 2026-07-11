// Pure contact-point / wheel-height model. Port of Simulation/ContactPointCalculator.swift.
import type { LockProfile } from '../models/LockProfile';
import type { Wheel } from '../models/Wheel';
import { AngleNormalizer } from './AngleNormalizer';

export interface ContactPointReading {
  readonly rcp: number;
  readonly lcp: number;
  readonly width: number;
  readonly perWheelHeights: number[];
}

// rcpNoiseOffset / lcpNoiseOffset: pre-generated per-probe noise in [-noise, +noise].
// Caller (GameState) owns the RNG; pass 0 for deterministic tests.
export function probe(
  wheels: Wheel[],
  profile: LockProfile,
  rcpNoiseOffset = 0.0,
  lcpNoiseOffset = 0.0,
): ContactPointReading {
  const heights = wheels.map((w) => wheelHeight(w, profile));
  const fenceHeight = heights.length ? Math.max(...heights) : 0.0;
  const maxBaseHeight = wheels.length ? Math.max(...wheels.map((w) => w.baseHeight)) : 0.0;
  const noseDepth = maxBaseHeight - fenceHeight;

  const rcp =
    profile.contactAreaCenter +
    profile.contactAreaWidth / 2.0 -
    profile.rcpSensitivity * noseDepth +
    rcpNoiseOffset;
  const lcp =
    profile.contactAreaCenter -
    profile.contactAreaWidth / 2.0 +
    profile.lcpSensitivity * noseDepth +
    lcpNoiseOffset;

  return { rcp, lcp, width: rcp - lcp, perWheelHeights: heights };
}

// S = base + oval(pos) + surfaceNoise(pos); cut = min(1, α_t² + Σ α_f²·ratio_f);
// height = S − max(0, S)·cut. Surface noise is embedded — do not add it again.
export function wheelHeight(wheel: Wheel, profile: LockProfile): number {
  const pos = wheel.currentPosition;
  const range = profile.numberRange;

  const oval = ovalContribution(
    pos,
    wheel.ovalBumpPosition,
    range,
    profile.ovalEccentricity,
    wheel.ovalFrequency,
  );
  const noise = surfaceNoise(pos, wheel.noiseSamples, range);
  const surface = wheel.baseHeight + oval + noise;

  let cutFraction = alphaSquared(
    AngleNormalizer.circularDistance(pos, wheel.gatePosition, range),
    profile.gateWidth,
  );
  for (const fg of wheel.falseGates) {
    cutFraction +=
      alphaSquared(AngleNormalizer.circularDistance(pos, fg.position, range), fg.width) *
      fg.depthRatio;
  }
  const cut = Math.min(1.0, cutFraction);
  return surface - Math.max(0, surface) * cut;
}

function alphaSquared(distance: number, width: number): number {
  const alignment = Math.max(0.0, 1.0 - distance / width);
  return alignment * alignment;
}

function ovalContribution(
  position: number,
  bumpPosition: number,
  range: number,
  eccentricity: number,
  frequency: number,
): number {
  if (eccentricity <= 0) return 0.0;
  let delta = (position - bumpPosition) % range;
  if (delta < 0) delta += range;
  return eccentricity * Math.cos((2 * Math.PI * frequency * delta) / range);
}

// Position-consistent surface noise via linear interpolation through the samples.
export function surfaceNoise(position: number, samples: number[], range: number): number {
  if (samples.length === 0) return 0.0;
  const t = (position / range) * samples.length;
  const i0 = Math.trunc(t) % samples.length;
  const i1 = (i0 + 1) % samples.length;
  const frac = t - Math.floor(t);
  return samples[i0] * (1 - frac) + samples[i1] * frac;
}
