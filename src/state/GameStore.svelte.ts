// Reactive Svelte 5 wrapper around the plain, testable GameState engine.
// The engine mutates in place; after each action we re-publish its outputs into $state
// fields so the UI reacts. This keeps GameState unit-testable (no runes) per the plan.
import { GameState, type SolvePhase } from '../sim/GameState';
import type { LockProfile } from '../models/LockProfile';
import type { Combination } from '../models/Combination';
import type { ProbeReading } from '../models/LockSession';
import type { ContactPointReading } from '../sim/ContactPointCalculator';
import { SolveScoreCalculator, type SolveScoreResult } from '../sim/SolveScoring';

export class GameStore {
  private game: GameState;

  dialPosition = $state(0);
  solvePhase = $state<SolvePhase>('manipulating');
  boltTravelProgress = $state(0);
  currentReading = $state<ContactPointReading | null>(null);
  probeHistory = $state<ProbeReading[]>([]);
  wheelPositions = $state<number[]>([]);
  ledFlashCounter = $state(0);
  autoReadingEnabled = $state(false);
  measurementNoiseEnabled = $state(true);
  solveScore = $state<SolveScoreResult | null>(null);
  efficiency = $state(0);
  selectedWheelIndex = $state(0);

  readonly profile: LockProfile;
  readonly difficultyRating: number;

  constructor(profile: LockProfile, combination: Combination) {
    this.game = new GameState(profile, combination);
    this.profile = profile;
    this.difficultyRating = this.game.difficultyRating;
    this.sync();
  }

  get numberRange() {
    return this.profile.numberRange;
  }
  get wheelCount(): number {
    return this.profile.wheelCount;
  }
  // Debug aid until the contact graph lands — the true gate positions.
  get gatePositions(): number[] {
    return this.game.session.combination.gatePositions;
  }
  get manualSweepCount(): number {
    return this.game.manualSweepCount;
  }
  get lifetimeProbeCount(): number {
    return this.game.lifetimeProbeCount;
  }

  private sync() {
    this.dialPosition = this.game.dialPosition;
    this.solvePhase = this.game.solvePhase;
    this.boltTravelProgress = this.game.boltTravelProgress;
    this.currentReading = this.game.currentReading;
    this.probeHistory = [...this.game.session.probeHistory];
    this.wheelPositions = this.game.wheels.map((w) => w.currentPosition);
    this.ledFlashCounter = this.game.ledFlashCounter;
    this.selectedWheelIndex = this.game.selectedWheelIndex;
    // Compute the solve score once, the moment the lock opens.
    if (this.game.solvePhase === 'solved' && this.solveScore === null) {
      this.efficiency = this.game.lifetimeProbeCount / (this.profile.wheelCount * this.profile.numberRange);
      this.solveScore = SolveScoreCalculator.compute(this.difficultyRating, this.efficiency, this.game.manualSweepCount);
    }
  }

  rotate(delta: number) {
    this.game.rotate(delta);
    this.sync();
  }
  probeNow() {
    this.game.probeNow();
    this.sync();
  }
  sweepAll(start = 0, step = 2, stop: number | null = null) {
    this.game.sweepAll(start, step, stop);
    this.sync();
  }
  autoProbe(locked: Map<number, number>, start = 0, step = 2, stop: number | null = null) {
    this.game.autoProbe(locked, start, step, stop);
    this.sync();
  }
  erase() {
    this.game.eraseProbeHistory();
    this.sync();
  }
  // Debug aid: park every wheel on its gate so the solve loop can be exercised by hand.
  debugAlignToGates() {
    this.game.session.combination.gatePositions.forEach((g, i) => this.game.parkWheel(i, g));
    this.sync();
  }
  setAutoReading(on: boolean) {
    this.game.autoReadingEnabled = on;
    this.autoReadingEnabled = on;
  }
  setMeasurementNoise(on: boolean) {
    this.game.measurementNoiseEnabled = on;
    this.measurementNoiseEnabled = on;
  }
}
