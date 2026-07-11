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

  it('dialing to aligned gates in the contact area, then CW bolt travel, solves', () => {
    const g = new GameState(testProfile(), combo);
    // Park each wheel on its gate so rotation doesn't disturb alignment.
    g.parkWheel(0, 10);
    g.parkWheel(1, 20);
    g.parkWheel(2, 30);

    // Bring the dial into the contact area (center 20) → nose drops.
    g.rotate(20);
    expect(g.solvePhase).toBe('noseDropped');

    // CW travel past the bolt threshold (15° ≈ 1.667 on a 40-dial) → solved.
    g.rotate(-3);
    expect(g.solvePhase).toBe('solved');
    expect(g.session.solvedAt).not.toBeNull();
  });

  it('rotating CCW does not solve without bolt retraction', () => {
    const g = new GameState(testProfile(), combo);
    g.parkWheel(0, 10);
    g.parkWheel(1, 20);
    g.parkWheel(2, 30);
    g.rotate(20); // noseDropped
    g.rotate(20); // more CCW — springs bolt back, never solves
    expect(g.solvePhase).not.toBe('solved');
  });
});
