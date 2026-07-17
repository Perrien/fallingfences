import { describe, it, expect } from 'vitest';
import { GameState } from '../../src/sim/GameState';
import type { LockProfile } from '../../src/models/LockProfile';

// A simple deterministic 3-wheel lock: 40-dial, no noise/oval, gates at 10/20/30,
// contact area centered at 20.
function testProfile(): LockProfile {
  return {
    id: 'test',
    seed: 1n,
    wheelCount: 3,
    numberRange: 40,
    heightOrdering: { kind: 'inOrder' },
    heightSpread: 0.2,
    baseHeightsByRank: null,
    surfaceNoiseAmplitude: 0.0,
    measurementNoise: 0.04,
    noiseHarmonicFrequencyRange: [1.0, 5.0],
    ovalEccentricity: 0.0,
    ovalFrequencyRange: [1.0, 1.0],
    ovalBumpPositionOverride: null,
    gateWidth: 3.0,
    gateSeamBuffer: 0.0,
    falseGateConfig: null,
    contactAreaCenter: 20.0,
    contactAreaWidth: (30.0 / 360.0) * 40.0,
    rcpSensitivity: 2.5,
    lcpSensitivity: 1.0,
  };
}
const combo = { gatePositions: [10, 20, 30] };

describe('GameState', () => {
  it('initialises at dial 0, manipulating, with all wheels', () => {
    const g = new GameState(testProfile(), combo);
    expect(g.dialPosition).toBe(0);
    expect(g.solvePhase).toBe('manipulating');
    expect(g.wheels.length).toBe(3);
    expect(g.difficultyRating).toBeGreaterThanOrEqual(0);
  });

  it('probeNow records an rcp + lcp reading and sets currentReading', () => {
    const g = new GameState(testProfile(), combo);
    g.probeNow();
    expect(g.session.probeHistory.length).toBe(2);
    expect(g.currentReading).not.toBeNull();
    const sides = g.session.probeHistory.map((r) => r.measuredContact).sort();
    expect(sides).toEqual(['lcp', 'rcp']);
  });

  it('sweepAll populates probe history across positions', () => {
    const g = new GameState(testProfile(), combo);
    g.measurementNoiseEnabled = false;
    g.sweepAll(0, 2, 38);
    expect(g.session.probeHistory.length).toBeGreaterThan(10);
  });

  it('sweeping clockwise through the contact-area center with gates aligned opens the lock', () => {
    const g = new GameState(testProfile(), combo);
    // Park each wheel on its gate so rotation doesn't disturb alignment.
    g.parkWheel(0, 10);
    g.parkWheel(1, 20);
    g.parkWheel(2, 30);

    // Sweep the dial clockwise (negative) across the contact-area center (20) → opens.
    g.rotate(30); // dial to ~30 (above the center)
    expect(g.solvePhase).toBe('manipulating');
    g.rotate(-15); // sweep CW down through 20
    expect(g.solvePhase).toBe('solved');
    expect(g.session.solvedAt).not.toBeNull();
  });

  it('sweeping clockwise through center does NOT open when gates are misaligned', () => {
    const g = new GameState(testProfile(), combo);
    g.parkWheel(0, 10);
    g.parkWheel(1, 20);
    g.parkWheel(2, 35); // wheel 2 off its gate (30)
    g.rotate(30);
    g.rotate(-15); // sweep through center, but gates not aligned
    expect(g.solvePhase).not.toBe('solved');
  });

  it('sweeping counter-clockwise through center does not open (wrong direction)', () => {
    const g = new GameState(testProfile(), combo);
    g.parkWheel(0, 10);
    g.parkWheel(1, 20);
    g.parkWheel(2, 30);
    g.rotate(10); // CCW up through 20 — wrong direction
    expect(g.solvePhase).not.toBe('solved');
  });

  it('manual probes accumulate at distinct tracked-wheel positions (all wheels coupled)', () => {
    const g = new GameState(testProfile(), combo);
    g.measurementNoiseEnabled = false;
    g.autoReadingEnabled = false; // count only the explicit probeNow() calls
    g.rotate(160); // continuous CCW — picks up all 3 wheels so they move together
    const trackedBefore = g.wheels[2].currentPosition;
    g.probeNow();
    g.rotate(6);
    g.probeNow();
    g.rotate(6);
    g.probeNow();
    const trackedAfter = g.wheels[2].currentPosition;
    // The tracked (last) wheel actually moved, and each probe landed in a new cell.
    expect(Math.abs(trackedAfter - trackedBefore)).toBeGreaterThan(1);
    expect(g.session.probeHistory.length).toBe(6);
  });

  it('after solving, clockwise rotation is soft-stopped at the contact-area edge, not blocked outright', () => {
    const g = new GameState(testProfile(), combo);
    g.parkWheel(0, 10);
    g.parkWheel(1, 20);
    g.parkWheel(2, 30);
    // Land exactly on the contact-area center (20) in one small sub-step, so solving doesn't
    // itself carry the dial any further — isolates what a *subsequent* clockwise rotate does.
    g.rotate(21.2);
    g.rotate(-1.2);
    expect(g.solvePhase).toBe('solved');
    expect(g.dialPosition).toBeCloseTo(20, 6);

    // The old bug: ANY further delta < 0 was a total no-op. A small further clockwise nudge
    // that stays within the contact area should still move the dial.
    g.rotate(-1);
    expect(g.dialPosition).toBeCloseTo(19, 6);

    // But a further nudge that would take it outside the contact area (gates still aligned)
    // must be soft-stopped right there, not allowed to sail on through.
    g.rotate(-1);
    expect(g.dialPosition).toBeCloseTo(19, 6);
  });

  it('un-solves (reverts to manipulating) the moment the wheels move off their gates, restoring normal rotation', () => {
    const g = new GameState(testProfile(), combo);
    g.parkWheel(0, 10);
    g.parkWheel(1, 20);
    g.parkWheel(2, 30);
    g.rotate(30);
    g.rotate(-15); // solved, gates aligned
    expect(g.solvePhase).toBe('solved');

    // Unpark so a rotate can actually move the wheels, then explore counter-clockwise far
    // enough to move them off their gates.
    g.unparkAll();
    g.rotate(200); // scrambles wheel positions well off their gates
    expect(g.solvePhase).toBe('manipulating');

    // Now clockwise rotation should behave normally (move freely), not be capped at the
    // contact-area edge.
    const before = g.dialPosition;
    g.rotate(-25);
    expect(g.dialPosition).not.toBe(before);
  });

  it('can be solved again after exploring away and dialing back onto the gates', () => {
    const g = new GameState(testProfile(), combo);
    g.parkWheel(0, 10);
    g.parkWheel(1, 20);
    g.parkWheel(2, 30);
    g.rotate(30);
    g.rotate(-15); // first solve
    expect(g.solvePhase).toBe('solved');

    // Move wheel 0 off its gate (still parked, just at a different position) — deterministic,
    // dial-position-independent stand-in for "explore away". A tiny rotate is needed to
    // actually run the reversion check (parking alone doesn't trigger it).
    g.parkWheel(0, 15);
    g.rotate(0.001);
    expect(g.solvePhase).toBe('manipulating');

    // Park it back on its gate and dial clockwise through the contact-area center again.
    g.parkWheel(0, 10);
    g.rotate(10); // back above the center, comfortably clear of it
    g.rotate(-15); // sweep CW through it again
    expect(g.solvePhase).toBe('solved');
    expect(g.session.solvedAt).not.toBeNull();
  });

  it('autoProbe isolates the free wheel and restores the others', () => {
    const g = new GameState(testProfile(), combo);
    g.measurementNoiseEnabled = false;
    g.autoReadingEnabled = false; // isolate autoProbe from survey auto-reads
    g.rotate(200); // scramble wheel positions
    const before = g.wheels.map((w) => w.currentPosition);

    const locked = new Map<number, number>();
    before.forEach((p, i) => {
      if (i !== 1) locked.set(i, p); // free wheel = index 1
    });
    g.autoProbe(locked, 0, 2, null);

    // readings all recorded against the free wheel
    expect(g.session.probeHistory.length).toBeGreaterThan(0);
    expect(g.session.probeHistory.every((r) => r.wheelIndex === 1)).toBe(true);

    // the parked wheels are back where they were
    const after = g.wheels.map((w) => w.currentPosition);
    expect(after[0]).toBeCloseTo(before[0], 6);
    expect(after[2]).toBeCloseTo(before[2], 6);
  });
});
