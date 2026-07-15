// Reactive Svelte 5 wrapper around the plain, testable UltraGameState engine. Mirrors
// GameStore: the engine mutates in place; after each action we re-publish outputs into
// $state fields so the UI reacts. Keeps UltraGameState unit-testable (no runes).
import { UltraGameState } from '../sim/UltraGameState';
import type { LockProfile } from '../models/LockProfile';
import type { Combination } from '../models/Combination';

export class UltraGameStore {
  private game: UltraGameState;

  wheelPositions = $state<number[]>([]);
  setFlags = $state<boolean[]>([]);
  primarySelected = $state(0);
  solved = $state(false);
  flatWheels = $state<boolean[]>([]);
  sweepData = $state<number[]>([]);
  // The wheelCount × 500 payload, computed once the moment the lock first opens.
  solveScore = $state<number | null>(null);

  readonly profile: LockProfile;
  readonly difficultyRating: number;
  readonly staticYLow: number;
  readonly staticYHigh: number;

  constructor(profile: LockProfile, combination: Combination) {
    this.game = new UltraGameState(profile, combination);
    this.profile = profile;
    this.difficultyRating = this.game.difficultyRating;
    this.staticYLow = this.game.staticYLow;
    this.staticYHigh = this.game.staticYHigh;
    this.sync();
  }

  get numberRange(): number {
    return this.profile.numberRange;
  }
  get wheelCount(): number {
    return this.game.wheelCount;
  }
  get gatePositions(): number[] {
    return this.game.gatePositions;
  }

  private sync(): void {
    this.wheelPositions = [...this.game.wheelPositions];
    this.setFlags = [...this.game.setFlags];
    this.primarySelected = this.game.primarySelected;
    this.solved = this.game.solved;
    this.sweepData = this.game.sweepSelected();
    this.flatWheels = this.game.detectFlatWheels();
    if (this.game.solved && this.solveScore === null) {
      this.solveScore = this.game.wheelCount * 500;
    }
  }

  // The fence-determining wheel index at `markerPosition` (not reactive — call on demand).
  fenceIndex(markerPosition: number): number {
    return this.game.fenceIndex(markerPosition);
  }

  select(i: number): void {
    this.game.select(i);
    this.sync();
  }
  setPosition(v: number): void {
    this.game.setPositionForSelection(v);
    this.sync();
  }
  // ±1 step relative to the primary wheel's current position (wraps in the engine).
  nudge(delta: number): void {
    const cur = this.game.wheelPositions[this.game.primarySelected] ?? 0;
    this.game.setPositionForSelection(cur + delta);
    this.sync();
  }
  toggleSet(): void {
    this.game.toggleSet();
    this.sync();
  }
}
