// The secret combination — gate positions only. Port of Models/Combination.swift.
import { SeededRNG } from '../sim/SeededRNG';
import { AngleNormalizer } from '../sim/AngleNormalizer';
import { randomSeed } from './LockProfile';

export interface Combination {
  readonly gatePositions: number[]; // one per wheel, in [0, numberRange)
}

export interface MakeRandomParams {
  wheelCount: number;
  numberRange: number;
  forbiddenCenter: number;
  forbiddenHalfWidth: number;
  minConsecutiveSeparation?: number;
  seamBuffer?: number;
}

// Random combination respecting the forbidden zone (on the cam-adjacent gate) and a
// minimum separation between consecutive gates. In Swift this uses the system RNG
// (non-deterministic); here `rng` defaults to a crypto-seeded generator so the result
// is likewise independent of the lock's profile seed. Pass an explicit rng for tests.
export function makeRandom(p: MakeRandomParams, rng: SeededRNG = new SeededRNG(randomSeed())): Combination {
  const range = p.numberRange;
  const seamBuffer = p.seamBuffer ?? 0.0;
  const minSep = p.minConsecutiveSeparation ?? 5.0;
  const lower = Math.ceil(seamBuffer);
  const upper = Math.max(lower + 1, Math.floor(range - seamBuffer));

  let lastGate: number;
  do {
    lastGate = rng.randomInt(lower, upper); // [lower, upper)
  } while (AngleNormalizer.circularDistance(lastGate, p.forbiddenCenter, range) <= p.forbiddenHalfWidth);

  const positions = [lastGate];
  for (let i = 1; i < p.wheelCount; i++) {
    let gate: number;
    do {
      gate = rng.randomInt(lower, upper);
    } while (AngleNormalizer.circularDistance(gate, positions[positions.length - 1], range) < minSep);
    positions.push(gate);
  }
  return { gatePositions: positions };
}
