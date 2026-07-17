// Bridge between the simulation and the UI — port of Simulation/SafeSimulator.swift.
// Plain class (unit-testable); the reactive Svelte wrapper (GameStore) adds runes.
import type { LockProfile } from '../models/LockProfile';
import type { Combination } from '../models/Combination';
import type { Wheel } from '../models/Wheel';
import type { LockSession, ProbeReading, ContactSide, WheelConfiguration } from '../models/LockSession';
import type { WheelIsolationTest } from '../models/WheelIsolationTest';
import { buildTest, repopulateTest } from '../models/WheelIsolationTest';
import { makeWheels } from './WheelFactory';
import { probe, type ContactPointReading } from './ContactPointCalculator';
import { WheelPositionEngine } from './WheelPositionEngine';
import { SeededRNG } from './SeededRNG';
import { AngleNormalizer } from './AngleNormalizer';
import { difficultyRating } from '../models/difficulty';
import { randomSeed } from '../models/LockProfile';

// The lock opens when the dial is swept clockwise (numbers decreasing) through the contact-area
// center while every wheel sits within its gate tolerance — i.e. you dial the combination in.
export type SolvePhase = 'manipulating' | 'solved';

const VELOCITY_SMOOTHING = 0.3;
const SNAP_GRANULARITY = 0.5;

export class GameState {
  session: LockSession;
  wheels: Wheel[];
  dialPosition = 0.0;
  currentReading: ContactPointReading | null = null;
  wheelConfiguration: WheelConfiguration = { kind: 'allMoving' };
  solvePhase: SolvePhase = 'manipulating';
  isolationTests: WheelIsolationTest[] = [];

  autoReadingEnabled = true; // always on (auto-read on sweep is the core interaction)
  measurementNoiseEnabled = false; // always off in the web version
  // Auto-read fires only below this dial speed (increments/second). Scaled by dial size in
  // the constructor: a bigger dial needs a higher inc/sec for the same feel. Baseline ~3 @ 40.
  velocityThreshold = 3;
  selectedWheelIndex: number;
  ledFlashCounter = 0;
  manualSweepCount = 0;
  combinationRevealed = false;
  lifetimeProbeCount = 0; // running total of recorded readings; never decremented

  private positionEngine: WheelPositionEngine;
  private parkedWheelPositions = new Map<number, number>();
  private noiseRNG: SeededRNG;
  private wasInContactArea = false;
  private smoothedVelocity = 0.0;
  private lastCoupledIndices = new Set<number>();

  constructor(profile: LockProfile, combination: Combination, startingPositions?: number[]) {
    this.session = {
      id: crypto.randomUUID(),
      profile,
      combination,
      probeHistory: [],
      solvedAt: null,
    };
    this.wheels = makeWheels(profile, combination);
    this.positionEngine = new WheelPositionEngine(profile.wheelCount, profile.numberRange, startingPositions);
    // Measurement noise is intentionally non-deterministic (models hand tremor); separate
    // from the seeded, position-consistent surface noise baked into the wheels.
    this.noiseRNG = new SeededRNG(randomSeed());
    this.selectedWheelIndex = profile.wheelCount - 1;
    // Dial-relative auto-read cutoff: ~3 inc/s on a 40-dial, proportionally higher on bigger dials.
    this.velocityThreshold = 3 * (profile.numberRange / 40);
    for (let i = 0; i < this.wheels.length; i++) {
      this.wheels[i].currentPosition = this.positionEngine.positions[i];
    }
  }

  get profile(): LockProfile {
    return this.session.profile;
  }

  get difficultyRating(): number {
    const fgCount = this.wheels.reduce((s, w) => s + w.falseGates.length, 0);
    return difficultyRating(this.profile, fgCount);
  }

  // --- Dial rotation. Positive = CCW (left), negative = CW (right). ---
  // `velocity` is the dial speed in increments/second (from the input layer); auto-read on
  // sweep only fires when the smoothed speed is below velocityThreshold, so fast passes don't read.
  rotate(delta: number, velocity = 0): void {
    this.smoothedVelocity =
      (1.0 - VELOCITY_SMOOTHING) * this.smoothedVelocity + VELOCITY_SMOOTHING * velocity;
    const range = this.profile.numberRange;
    const maxStep = this.profile.contactAreaWidth / 2.0;
    const sign = delta > 0 ? 1.0 : -1.0;
    let remaining = Math.abs(delta);
    while (remaining > 0.0) {
      const stepMagnitude = Math.min(remaining, maxStep);
      const stepDelta = stepMagnitude * sign;

      // Soft mechanical stop: while still freshly solved with the gates aligned, don't let a
      // clockwise sweep swing the dial straight back out through the dialed-in position.
      // The moment the wheels move off their gates, applyRotationStep below reverts
      // solvePhase to 'manipulating', so this condition stops applying on its own — no
      // separate "lifted" flag needed, and the player can dial it in and re-solve freely.
      if (this.solvePhase === 'solved' && sign < 0 && this.wouldExitContactAreaClockwise(stepDelta, range)) {
        break;
      }

      this.applyRotationStep(stepDelta, range);
      remaining -= stepMagnitude;
    }
    const newlyCoupled = [...this.positionEngine.coupledIndices].filter((i) => !this.lastCoupledIndices.has(i));
    if (newlyCoupled.length > 0) this.ledFlashCounter += 1;
    this.lastCoupledIndices = new Set(this.positionEngine.coupledIndices);
  }

  private applyRotationStep(delta: number, range: number): void {
    this.dialPosition = AngleNormalizer.normalizePosition(this.dialPosition + delta, range);
    this.positionEngine.rotate(delta);
    this.syncWheelPositions();
    if (this.autoReadingEnabled) this.checkContactAreaCrossing(range, delta);
    this.checkSolvePhase(delta, range);
    // A solved lock un-solves the moment the wheels are moved off their gates — this lifts
    // the post-solve clockwise stop above and lets the player dial it in again for a fresh
    // solve (and a fresh spark burst) instead of being permanently "done".
    if (this.solvePhase === 'solved' && !this.gatesAligned(range)) {
      this.solvePhase = 'manipulating';
    }
  }

  // --- Probe triggers ---
  // Button mode: noiseless capture at the current positions.
  probeNow(): void {
    this.ledFlashCounter += 1;
    this.recordReading('both', 0.0);
  }

  // Step all moving wheels through positions [start, stop] (default whole dial) and record.
  sweepAll(start = 0.0, step = 2.0, stop: number | null = null, recordingWheelIndex: number | null = null, rcpOnly = false): void {
    const range = this.profile.numberRange;
    const moving = this.movingWheelIndices();
    if (moving.length === 0) return;
    const contact: ContactSide = rcpOnly ? 'rcp' : 'both';

    const record = (pos: number) => {
      for (const i of moving) this.wheels[i].currentPosition = pos;
      this.recordReading(contact, 0.0, recordingWheelIndex, true);
    };

    let pos = start % range;
    if (pos < 0) pos += range;

    if (stop !== null) {
      let stopPos = stop % range;
      if (stopPos < 0) stopPos += range;
      if (stopPos >= pos) {
        for (; pos <= stopPos; pos += step) record(pos);
      } else {
        for (; pos < range; pos += step) record(pos);
        pos = pos % range;
        for (; pos <= stopPos; pos += step) record(pos);
      }
    } else {
      for (; pos < range; pos += step) record(pos);
    }

    this.positionEngine.reset(this.wheels.map((w) => w.currentPosition));
  }

  // --- Wheel parking (minimal — used for isolation/auto-probe later) ---
  parkWheel(index: number, position: number): void {
    if (index >= this.wheels.length) return;
    const p = AngleNormalizer.normalizePosition(position, this.profile.numberRange);
    this.parkedWheelPositions.set(index, p);
    this.wheels[index].currentPosition = p;
    this.updateWheelConfiguration();
  }

  unparkAll(): void {
    this.parkedWheelPositions.clear();
    this.wheelConfiguration = { kind: 'allMoving' };
  }

  unparkWheel(index: number): void {
    this.parkedWheelPositions.delete(index);
    this.updateWheelConfiguration();
  }

  // Auto-probe: park each wheel in `locked` at its position, sweep the remaining (free)
  // wheels across [startAt, stopAt], recording against `recordingWheelIndex` (or the first free
  // wheel if null), then restore the prior park configuration. Port of SafeSimulator.autoProbe.
  autoProbe(
    locked: Map<number, number>,
    startAt: number,
    step: number,
    stopAt: number | null = null,
    recordingWheelIndex: number | null = null,
  ): void {
    if (step <= 0) return;
    const savedParked = new Map(this.parkedWheelPositions);
    const savedPositions = this.wheels.map((w) => w.currentPosition);

    for (let i = 0; i < this.wheels.length; i++) {
      const pos = locked.get(i);
      if (pos !== undefined) this.parkWheel(i, pos);
      else this.unparkWheel(i);
    }

    // Record against the explicitly chosen wheel, else the first free wheel (highest index).
    let recordingIdx = recordingWheelIndex;
    if (recordingIdx === null || locked.has(recordingIdx)) {
      recordingIdx = null;
      for (let i = this.wheels.length - 1; i >= 0; i--) {
        if (!locked.has(i)) {
          recordingIdx = i;
          break;
        }
      }
    }
    if (recordingIdx !== null) this.selectedWheelIndex = recordingIdx;

    this.sweepAll(startAt, step, stopAt, recordingIdx, false);

    // restore pre-run state
    this.parkedWheelPositions = savedParked;
    for (let i = 0; i < this.wheels.length; i++) {
      this.wheels[i].currentPosition = savedParked.get(i) ?? savedPositions[i];
    }
    this.positionEngine.restoreFromState(
      this.dialPosition,
      this.wheels.map((w) => w.currentPosition),
    );
    this.updateWheelConfiguration();
  }

  revealCombination(): void {
    this.combinationRevealed = true;
  }

  // --- Wheel isolation tests (port of SafeSimulator isolation methods) ---
  addIsolationTest(testPosition: number, controlPosition: number): void {
    this.isolationTests.push(buildTest(this.wheels.length, testPosition, controlPosition));
  }
  removeIsolationTest(id: string): void {
    this.isolationTests = this.isolationTests.filter((t) => t.id !== id);
  }
  repopulateIsolationTest(id: string, testPosition: number, controlPosition: number): void {
    const t = this.isolationTests.find((x) => x.id === id);
    if (t) repopulateTest(t, testPosition, controlPosition);
  }
  setIsolationRowPosition(testID: string, rowIndex: number, wheelIndex: number, position: number): void {
    const t = this.isolationTests.find((x) => x.id === testID);
    if (!t || rowIndex >= t.rows.length || wheelIndex >= t.rows[rowIndex].wheelPositions.length) return;
    t.rows[rowIndex].wheelPositions[wheelIndex] = AngleNormalizer.normalizePosition(position, this.profile.numberRange);
    t.rows[rowIndex].lcpReading = null;
    t.rows[rowIndex].rcpReading = null;
  }
  // Copy the Test row's value for wheelIndex down every other row (clears those rows' readings).
  fillIsolationColumn(testID: string, wheelIndex: number): void {
    const t = this.isolationTests.find((x) => x.id === testID);
    if (!t || t.rows.length === 0) return;
    const value = t.rows[0].wheelPositions[wheelIndex];
    for (let i = 1; i < t.rows.length; i++) {
      if (t.rows[i].wheelPositions[wheelIndex] !== value) {
        t.rows[i].wheelPositions[wheelIndex] = value;
        t.rows[i].lcpReading = null;
        t.rows[i].rcpReading = null;
      }
    }
  }
  // Run every row instantly: park wheels at the row's positions, probe noiseless, store results.
  // Does not touch probeHistory; restores wheel/park state afterward.
  autoRunIsolationTest(id: string): void {
    const t = this.isolationTests.find((x) => x.id === id);
    if (!t) return;
    const savedParked = new Map(this.parkedWheelPositions);
    const savedPositions = this.wheels.map((w) => w.currentPosition);

    for (const row of t.rows) {
      row.wheelPositions.forEach((pos, i) => this.parkWheel(i, pos));
      const r = probe(this.wheels, this.profile);
      row.lcpReading = r.lcp;
      row.rcpReading = r.rcp;
    }

    this.parkedWheelPositions = savedParked;
    for (let i = 0; i < this.wheels.length; i++) {
      this.wheels[i].currentPosition = savedParked.get(i) ?? savedPositions[i];
    }
    this.positionEngine.restoreFromState(
      this.dialPosition,
      this.wheels.map((w) => w.currentPosition),
    );
    this.updateWheelConfiguration();
  }

  eraseProbeHistory(): void {
    this.session.probeHistory = [];
  }

  // --- Private ---
  private syncWheelPositions(): void {
    for (let i = 0; i < this.wheels.length; i++) {
      this.wheels[i].currentPosition = this.parkedWheelPositions.get(i) ?? this.positionEngine.positions[i];
    }
  }

  private movingWheelIndices(): number[] {
    return this.wheels.map((_, i) => i).filter((i) => !this.parkedWheelPositions.has(i));
  }

  private updateWheelConfiguration(): void {
    const parkedCount = this.parkedWheelPositions.size;
    const total = this.wheels.length;
    if (parkedCount === 0) {
      this.wheelConfiguration = { kind: 'allMoving' };
    } else if (parkedCount === total - 1) {
      const movingIndex = this.wheels.findIndex((_, i) => !this.parkedWheelPositions.has(i));
      this.wheelConfiguration = { kind: 'isolated', movingIndex: movingIndex < 0 ? 0 : movingIndex };
    } else {
      const index = [...this.parkedWheelPositions.keys()].sort((a, b) => a - b)[0] ?? 0;
      this.wheelConfiguration = { kind: 'oneParked', index };
    }
  }

  private checkContactAreaCrossing(range: number, delta: number): void {
    // Use the actual noiseless RCP/LCP as the trigger edges (they converge inward as gates align).
    const cp = probe(this.wheels, this.profile);
    const isIn = this.dialPosition >= cp.lcp && this.dialPosition <= cp.rcp;
    if (
      this.wasInContactArea &&
      !isIn &&
      this.smoothedVelocity < this.velocityThreshold &&
      this.positionEngine.coupledIndices.size === 0
    ) {
      const noiseScale = this.velocityThreshold > 0 ? Math.min(1.0, this.smoothedVelocity / this.velocityThreshold) : 1.0;
      this.ledFlashCounter += 1;
      this.manualSweepCount += 1;
      const contact: ContactSide = delta > 0 ? 'rcp' : 'lcp';
      this.recordReading(contact, noiseScale, null, true);
    }
    this.wasInContactArea = isIn;
  }

  private probeCurrentPositions(noiseScale: number): ContactPointReading {
    if (!this.measurementNoiseEnabled) return probe(this.wheels, this.profile);
    const amp = this.profile.measurementNoise * noiseScale;
    const rcpNoise = this.noiseRNG.nextDoubleIn(-amp, amp);
    const lcpNoise = this.noiseRNG.nextDoubleIn(-amp, amp);
    return probe(this.wheels, this.profile, rcpNoise, lcpNoise);
  }

  private recordReading(contact: ContactSide, noiseScale: number, wheelIndexOverride: number | null = null, _fromSweep = false): void {
    const reading = this.probeCurrentPositions(noiseScale);
    const trueReading = probe(this.wheels, this.profile);
    this.currentReading = reading;

    const wheelIdx = Math.min(wheelIndexOverride ?? this.selectedWheelIndex, this.wheels.length - 1);
    const rawPos = this.wheels[wheelIdx].currentPosition;
    const snappedPos = Math.round(rawPos / SNAP_GRANULARITY) * SNAP_GRANULARITY;

    // .both splits into two independent per-channel records so RCP and LCP each converge.
    const sides: ContactSide[] = contact === 'both' ? ['rcp', 'lcp'] : [contact];
    for (const side of sides) {
      this.session.probeHistory.push({
        id: crypto.randomUUID(),
        wheelIndex: wheelIdx,
        wheelPosition: snappedPos,
        rcp: reading.rcp,
        lcp: reading.lcp,
        width: reading.width,
        configuration: this.wheelConfiguration,
        timestamp: Date.now(),
        measuredContact: side,
      });
      const trueValue = side === 'lcp' ? trueReading.lcp : trueReading.rcp;
      this.pruneReadings(wheelIdx, snappedPos, side, trueValue);
      this.lifetimeProbeCount += 1;
    }
  }

  // Keep only the reading closest to the true value per (wheel, position, side) cell.
  private pruneReadings(wheelIdx: number, snappedPos: number, contact: ContactSide, trueValue: number): void {
    const value = (r: ProbeReading) => (contact === 'lcp' ? r.lcp : r.rcp);
    let bestID: string | null = null;
    let bestDistance = Infinity;
    let matchCount = 0;
    for (const r of this.session.probeHistory) {
      if (r.wheelIndex === wheelIdx && r.wheelPosition === snappedPos && r.measuredContact === contact) {
        matchCount += 1;
        const dist = Math.abs(value(r) - trueValue);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestID = r.id;
        }
      }
    }
    if (matchCount <= 1 || bestID === null) return;
    this.session.probeHistory = this.session.probeHistory.filter(
      (r) =>
        !(r.wheelIndex === wheelIdx && r.wheelPosition === snappedPos && r.measuredContact === contact && r.id !== bestID),
    );
  }

  // True when every wheel sits within its gate tolerance of its true gate position.
  private gatesAligned(range: number): boolean {
    const p = this.profile;
    return this.wheels.every(
      (w) => AngleNormalizer.circularDistance(w.currentPosition, w.gatePosition, range) <= p.gateWidth / 2.0,
    );
  }

  // Inside the configured contact area (same reference frame checkSolvePhase uses to decide
  // whether a sweep "crossed" it — the physically-derived probe() lcp/rcp is a related but
  // distinct notion and can disagree with this window depending on sensitivity tuning).
  // Boundary-inclusive with a small epsilon: rotation is chunked into contactAreaWidth/2
  // sub-steps, so landing exactly on the edge (half a step from center) is the expected case,
  // not a rare coincidence — a strict `<=` can reject it by a sub-ulp float error and wedge
  // the dial at the edge forever.
  private isInsideContactArea(pos: number, range: number): boolean {
    const p = this.profile;
    return AngleNormalizer.circularDistance(pos, p.contactAreaCenter, range) <= p.contactAreaWidth / 2.0 + 1e-9;
  }

  // Would this clockwise step take the dial from inside the contact area to outside it? Only
  // meaningful while already inside — used to soft-stop the dial right at the edge instead of
  // letting it swing straight back out post-solve.
  private wouldExitContactAreaClockwise(stepDelta: number, range: number): boolean {
    if (!this.isInsideContactArea(this.dialPosition, range)) return false;
    const newPos = AngleNormalizer.normalizePosition(this.dialPosition + stepDelta, range);
    return !this.isInsideContactArea(newPos, range);
  }

  // The lock opens when the dial sweeps clockwise (delta < 0) across the contact-area center
  // while every wheel is within its gate tolerance — the tactile "dial it in and it opens".
  private checkSolvePhase(delta: number, range: number): void {
    if (this.solvePhase === 'solved') return;
    if (delta >= 0) return; // only a clockwise (decreasing) sweep opens it
    if (!this.gatesAligned(range)) return;

    const p = this.profile;
    // Did this step cross the contact-area center? Compare center-relative signed offsets
    // before and after the step; a sign change (or landing on it) with a small gap = a crossing.
    const prev = AngleNormalizer.normalizePosition(this.dialPosition - delta, range);
    const before = signedOffset(prev, p.contactAreaCenter, range);
    const after = signedOffset(this.dialPosition, p.contactAreaCenter, range);
    const crossed =
      before === 0 || after === 0 || (Math.sign(before) !== Math.sign(after) && Math.abs(before) < range / 4);

    if (crossed) {
      this.solvePhase = 'solved';
      this.session.solvedAt = Date.now();
    }
  }
}

// Signed shortest-arc offset of `pos` from `ref`, in (−range/2, range/2].
function signedOffset(pos: number, ref: number, range: number): number {
  let d = (pos - ref) % range;
  if (d < -range / 2) d += range;
  else if (d > range / 2) d -= range;
  return d;
}
