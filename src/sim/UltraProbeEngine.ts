// Pure analytical probe engine for Ultra-tier locks. Port of Simulation/UltraProbeEngine.swift.
//
// Where the dialing pipeline (ContactPointCalculator.probe) maps wheel heights through a
// contact-area model into RCP/LCP/width, Ultra plots the FENCE HEIGHT directly: at each
// step, the height of whichever wheel is tallest is what determines the signal. This
// mirrors real safe-manipulation isolation — the fence rests on the tallest wheel.
//
// Stateless and deterministic. Must NOT mutate the caller's wheels: the array is shared
// with UltraGameState, so mutating currentPosition here would corrupt wheelPositions.
import type { LockProfile } from '../models/LockProfile';
import type { Wheel } from '../models/Wheel';
import { wheelHeight } from './ContactPointCalculator';

export const UltraProbeEngine = {
  // Sweeps the selected free wheel(s) across [0, range) at integer steps, leaving locked
  // wheels at their stored currentPosition. At each step returns the fence height (max
  // wheel height) across all wheels. wheelHeight already incorporates noise and the cut.
  sweep(freeIndices: Set<number>, wheels: Wheel[], profile: LockProfile): number[] {
    const range = profile.numberRange;
    const result: number[] = new Array(range);
    for (let step = 0; step < range; step++) {
      let best = -Infinity;
      for (let i = 0; i < wheels.length; i++) {
        // Copy (not mutate) when free so the caller's wheel is left untouched.
        const w = freeIndices.has(i) ? { ...wheels[i], currentPosition: step } : wheels[i];
        const h = wheelHeight(w, profile);
        if (h > best) best = h;
      }
      result[step] = best;
    }
    return result;
  },

  // Index of the wheel determining the fence height when the free wheels are at
  // markerPosition and locked wheels are at their stored positions. First on ties
  // (matches Swift `max(by:)` / strict `>` update).
  fenceIndex(
    freeIndices: Set<number>,
    markerPosition: number,
    wheels: Wheel[],
    profile: LockProfile,
  ): number {
    let bestIndex = 0;
    let bestHeight = -Infinity;
    for (let i = 0; i < wheels.length; i++) {
      const w = freeIndices.has(i) ? { ...wheels[i], currentPosition: markerPosition } : wheels[i];
      const h = wheelHeight(w, profile);
      if (h > bestHeight) {
        bestHeight = h;
        bestIndex = i;
      }
    }
    return bestIndex;
  },
};
