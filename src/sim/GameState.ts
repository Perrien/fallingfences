// Bridge between the simulation and the UI — port of Simulation/SafeSimulator.swift (MVP core).
// Plain class (unit-testable); the reactive Svelte wrapper is added with the UI. Isolation
// tests, auto-probe, candidates, and snapshot/restore are deferred to Phase 2.
import type { LockProfile } from '../models/LockProfile';
import type { Combination } from '../models/Combination';
import type { Wheel } from '../models/Wheel';
import type { LockSession, ProbeReading, ContactSide, WheelConfiguration } from '../models/LockSession';
import { makeWheels } from './WheelFactory';
import { probe, type ContactPointReading } from './ContactPointCalculator';
import { WheelPositionEngine } from './WheelPositionEngine';
import { SeededRNG } from './SeededRNG';
import { AngleNormalizer } from './AngleNormalizer';
import { difficultyRating } from '../models/difficulty';
import { randomSeed } from '../models/LockProfile';

// manipulating → noseDropped (gates aligned + dial in contact area) → solved (≈15° bolt travel).
export type SolvePhase = 'manipulating' | 'noseDropped' | 'solved';

const VELOCITY_SMOOTHING = 0.3;
const SNAP_GRANULARITY = 0.5;

export class GameState {
  session: LockSession;
  wheels: Wheel[];
  dialPosition = 0.0;
  currentReading: ContactPointReading | null = null;
  wheelConfiguration: WheelConfiguration = { kind: 'allMoving' };
  solvePhase: SolvePhase = 'manipulating';

  autoReadingEnabled = false;
  measurementNoiseEnabled = true;
  velocityThreshold = 0.75;
  selectedWheelIndex: number;
  ledFlashCounter = 0;
  manualSweepCount = 0;
  combinationRevealed = false;

  private positionEngine: WheelPositionEngine;
  private parkedWheelPositions = new Map<number, number>();
  private noiseRNG: SeededRNG;
  private wasInContactArea = false;
  private boltTravelAccumulated = 0.0;
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

  private get boltTravelThreshold(): number {
    return (15.0 / 360.0) * this.profile.numberRange;
  }

  get boltTravelProgress(): number {
    if (this.boltTravelThreshold <= 0) return 0;
    return Math.min(1.0, this.boltTravelAccumulated / this.boltTravelThreshold);
  }

  // --- Dial rotation. Positive = CCW (left), negative = CW (right). ---
  rotate(delta: number): void {
    if (this.solvePhase === 'solved' && delta < 0) return;
    this.smoothedVelocity =
      (1.0 - VELOCITY_SMOOTHING) * this.smoothedVelocity + VELOCITY_SMOOTHING * Math.abs(delta);
    const range = this.profile.numberRange;
    const maxStep = this.profile.contactAreaWidth / 2.0;
    const sign = delta > 0 ? 1.0 : -1.0;
    let remaining = Math.abs(delta);
    while (remaining > 0.0) {
      const stepMagnitude = Math.min(remaining, maxStep);
      this.applyRotationStep(stepMagnitude * sign, range);
      remaining -= stepMagnitude;
      if (this.solvePhase === 'solved' && sign < 0) break;
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

  revealCombination(): void {
    this.combinationRevealed = true;
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

  private checkSolvePhase(delta: number, range: number): void {
    const p = this.profile;
    const gatesAligned = this.wheels.every(
      (w) => AngleNormalizer.circularDistance(w.currentPosition, w.gatePosition, range) <= p.gateWidth / 2.0,
    );
    const inContactArea =
      AngleNormalizer.circularDistance(this.dialPosition, p.contactAreaCenter, range) <= p.contactAreaWidth / 2.0;

    switch (this.solvePhase) {
      case 'manipulating':
        if (gatesAligned && inContactArea) {
          this.solvePhase = 'noseDropped';
          this.boltTravelAccumulated = 0.0;
        }
        break;
      case 'noseDropped':
        if (!gatesAligned) {
          this.solvePhase = 'manipulating';
          this.boltTravelAccumulated = 0.0;
          return;
        }
        if (delta < 0) {
          this.boltTravelAccumulated += Math.abs(delta);
        } else {
          this.boltTravelAccumulated = Math.max(0, this.boltTravelAccumulated - delta);
        }
        if (this.boltTravelAccumulated >= this.boltTravelThreshold) {
          this.solvePhase = 'solved';
          this.session.solvedAt = Date.now();
        } else if (this.boltTravelAccumulated <= 0 && !inContactArea) {
          this.solvePhase = 'manipulating';
        }
        break;
      case 'solved':
        if (delta > 0) {
          this.solvePhase = 'noseDropped';
          this.boltTravelAccumulated = Math.max(0, this.boltTravelThreshold - delta);
        }
        break;
    }
  }
}
