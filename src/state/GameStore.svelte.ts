// Reactive Svelte 5 wrapper around the plain, testable GameState engine.
// The engine mutates in place; after each action we re-publish its outputs into $state
// fields so the UI reacts. This keeps GameState unit-testable (no runes) per the plan.
import { GameState, type SolvePhase } from '../sim/GameState';
import type { LockProfile } from '../models/LockProfile';
import type { Combination } from '../models/Combination';
import type { ProbeReading } from '../models/LockSession';
import type { ContactPointReading } from '../sim/ContactPointCalculator';
import type { WheelIsolationTest } from '../models/WheelIsolationTest';
import { SolveScoreCalculator, type SolveScoreResult } from '../sim/SolveScoring';

export class GameStore {
  private game: GameState;

  dialPosition = $state(0);
  solvePhase = $state<SolvePhase>('manipulating');
  currentReading = $state<ContactPointReading | null>(null);
  probeHistory = $state<ProbeReading[]>([]);
  wheelPositions = $state<number[]>([]);
  ledFlashCounter = $state(0);
  solveScore = $state<SolveScoreResult | null>(null);
  efficiency = $state(0);
  selectedWheelIndex = $state(0);
  isolationTests = $state<WheelIsolationTest[]>([]);
  // Player annotations, one per internal wheel index (0 = cam-adjacent). Free-text candidate
  // (often one number, sometimes several like "10, 23") + notes. Session-only for now.
  wheelNotes = $state<{ candidate: string; notes: string }[]>([]);
  // Shared Auto-Probe lock config, one per internal wheel index. The test wheel is
  // selectedWheelIndex (left free/charted); others may be locked at a chosen position.
  autoProbeLocks = $state<{ locked: boolean; pos: number }[]>([]);

  readonly profile: LockProfile;
  readonly difficultyRating: number;

  constructor(profile: LockProfile, combination: Combination) {
    this.game = new GameState(profile, combination);
    this.profile = profile;
    this.difficultyRating = this.game.difficultyRating;
    this.wheelNotes = Array.from({ length: profile.wheelCount }, () => ({ candidate: '', notes: '' }));
    this.autoProbeLocks = Array.from({ length: profile.wheelCount }, () => ({ locked: false, pos: 0 }));
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
    this.currentReading = this.game.currentReading;
    this.probeHistory = [...this.game.session.probeHistory];
    this.wheelPositions = this.game.wheels.map((w) => w.currentPosition);
    this.ledFlashCounter = this.game.ledFlashCounter;
    this.selectedWheelIndex = this.game.selectedWheelIndex;
    // Deep-ish clone so Svelte reacts to row/reading mutations inside the tests.
    this.isolationTests = this.game.isolationTests.map((t) => ({
      ...t,
      rows: t.rows.map((r) => ({ ...r, wheelPositions: [...r.wheelPositions] })),
    }));
    // Compute the solve score once, the moment the lock opens.
    if (this.game.solvePhase === 'solved' && this.solveScore === null) {
      this.efficiency = this.game.lifetimeProbeCount / (this.profile.wheelCount * this.profile.numberRange);
      this.solveScore = SolveScoreCalculator.compute(this.difficultyRating, this.efficiency, this.game.manualSweepCount);
    }
  }

  rotate(delta: number, velocity = 0) {
    this.game.rotate(delta, velocity);
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
  autoProbe(locked: Map<number, number>, start = 0, step = 2, stop: number | null = null, recordingWheelIndex: number | null = null) {
    this.game.autoProbe(locked, start, step, stop, recordingWheelIndex);
    this.sync();
  }
  setSelectedWheel(index: number) {
    this.game.selectedWheelIndex = index;
    this.selectedWheelIndex = index;
  }
  // --- Isolation tests ---
  addIsolationTest(testPosition: number, controlPosition: number) {
    this.game.addIsolationTest(testPosition, controlPosition);
    this.sync();
  }
  removeIsolationTest(id: string) {
    this.game.removeIsolationTest(id);
    this.sync();
  }
  repopulateIsolationTest(id: string, tp: number, cp: number) {
    this.game.repopulateIsolationTest(id, tp, cp);
    this.sync();
  }
  setIsolationRowPosition(testID: string, rowIndex: number, wheelIndex: number, position: number) {
    this.game.setIsolationRowPosition(testID, rowIndex, wheelIndex, position);
    this.sync();
  }
  fillIsolationColumn(testID: string, wheelIndex: number) {
    this.game.fillIsolationColumn(testID, wheelIndex);
    this.sync();
  }
  autoRunIsolationTest(id: string) {
    this.game.autoRunIsolationTest(id);
    this.sync();
  }
  setCandidate(wheelIndex: number, value: string) {
    if (this.wheelNotes[wheelIndex]) this.wheelNotes[wheelIndex].candidate = value;
  }
  // Append a value to a wheel's candidate field (comma-separated), or set it if empty.
  appendCandidate(wheelIndex: number, value: string) {
    const note = this.wheelNotes[wheelIndex];
    if (!note) return;
    const existing = note.candidate.trim();
    note.candidate = existing === '' ? value : `${existing}, ${value}`;
  }
  setNote(wheelIndex: number, value: string) {
    if (this.wheelNotes[wheelIndex]) this.wheelNotes[wheelIndex].notes = value;
  }
  // "Lock to Candidates": configure the Auto-Probe panel so the currently selected wheel is
  // the free/test wheel and every OTHER wheel with a candidate is locked at that number (first
  // value if several are listed). The user then runs auto-probe to chart the selected wheel
  // with the known wheels held at their deduced gates.
  lockToCandidates() {
    this.autoProbeLocks = this.wheelNotes.map((note, i) => {
      if (i === this.selectedWheelIndex) return { locked: false, pos: 0 };
      const m = note.candidate.match(/-?\d+(?:\.\d+)?/);
      return m ? { locked: true, pos: Number(m[0]) } : { locked: false, pos: 0 };
    });
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
}
