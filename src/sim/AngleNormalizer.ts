// Circular/modular position arithmetic. Direct port of Simulation/AngleNormalizer.swift.
// All positions are in [0, range) — the same units as LockProfile.numberRange.
//
// Note: JS `%` on floats truncates toward zero, matching Swift's
// `truncatingRemainder(dividingBy:)` and Python's `math.fmod` — so results are identical.
export const AngleNormalizer = {
  // Shortest arc distance between two positions on a circular dial. Returns [0, range/2].
  circularDistance(a: number, b: number, range: number): number {
    let diff = (a - b) % range;
    if (diff < 0) diff += range;
    return Math.min(diff, range - diff);
  },

  // Wrap a position into [0, range), handling negative values.
  normalizePosition(position: number, range: number): number {
    let mod = position % range;
    if (mod < 0) mod += range;
    return mod;
  },
};
