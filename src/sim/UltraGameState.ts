// Pure engine for the Ultra tier — port of the analytical logic in
// Models/UltraSessionState.swift + Views/UltraManipulationView.swift (state parts only).
// No Svelte runes; the reactive wrapper (UltraGameStore) republishes these outputs.
//
// The player sees a fence-height graph for the selected wheel, isolates each wheel, reads
// its gate (the low point), sets each wheel onto its gate, and the lock auto-opens when
// every wheel is within gateWidth/2 of its gate. Raw array order (W1 = wheels[0]).
import type { LockProfile } from '../models/LockProfile';
import type { Combination } from '../models/Combination';
import type { Wheel } from '../models/Wheel';
import { makeWheels } from './WheelFactory';
import { UltraProbeEngine } from './UltraProbeEngine';
import { AngleNormalizer } from './AngleNormalizer';
import { difficultyRating } from '../models/difficulty';

export class UltraGameState {
  readonly profile: LockProfile;
  readonly combination: Combination;
  readonly wheels: Wheel[];
  wheelPositions: number[];
  setFlags: boolean[];
  selectedIndices: Set<number>;
  primarySelected = 0;
  solved = false;
  staticYLow = -0.05;
  staticYHigh = 1.1;
  readonly difficultyRating: number;

  constructor(profile: LockProfile, combination: Combination) {
    this.profile = profile;
    this.combination = combination;
    this.wheels = makeWheels(profile, combination);
    const n = this.wheels.length;
    this.wheelPositions = new Array(n).fill(0);
    this.setFlags = new Array(n).fill(false);
    this.selectedIndices = new Set([0]);
    // wheels[i].currentPosition already 0 from makeWheels — kept in lockstep henceforth.
    const fgCount = this.wheels.reduce((s, w) => s + w.falseGates.length, 0);
    this.difficultyRating = difficultyRating(profile, fgCount);
    this.computeStaticYBounds();
  }

  get numberRange(): number {
    return this.profile.numberRange;
  }
  get wheelCount(): number {
    return this.wheels.length;
  }
  // True gate positions, raw array order (W1 = wheels[0] = cam-adjacent).
  get gatePositions(): number[] {
    return this.combination.gatePositions;
  }

  // Sweep every wheel individually (others held at their current positions) to find the
  // lock-wide signal ceiling. Upper = globalMax × 1.05; lower = −0.05.
  computeStaticYBounds(): void {
    let globalMax = -Infinity;
    for (let i = 0; i < this.wheels.length; i++) {
      const data = UltraProbeEngine.sweep(new Set([i]), this.wheels, this.profile);
      for (const v of data) if (v > globalMax) globalMax = v;
    }
    this.staticYHigh = globalMax > -Infinity ? globalMax * 1.05 : 1.1;
    this.staticYLow = -0.05;
  }

  // Single-selection: focus wheel `i` (also the primary/marker wheel).
  select(i: number): void {
    if (i < 0 || i >= this.wheels.length) return;
    this.selectedIndices = new Set([i]);
    this.primarySelected = i;
  }

  // Fence-height curve for the currently selected wheel(s) across the whole dial.
  sweepSelected(): number[] {
    if (this.selectedIndices.size === 0) return [];
    return UltraProbeEngine.sweep(this.selectedIndices, this.wheels, this.profile);
  }

  // Which wheel determines the fence at `markerPosition` (selected wheels moved there).
  fenceIndex(markerPosition: number): number {
    return UltraProbeEngine.fenceIndex(this.selectedIndices, markerPosition, this.wheels, this.profile);
  }

  // Round + wrap into [0, numberRange-1], write to every selected wheel (positions AND the
  // engine-read currentPosition), then auto-solve if all gates are aligned.
  setPositionForSelection(value: number): void {
    const snapped = AngleNormalizer.normalizePosition(Math.round(value), this.numberRange);
    let changed = false;
    for (const i of this.selectedIndices) {
      if (i >= this.wheelPositions.length) continue;
      if (this.wheelPositions[i] !== snapped) {
        this.wheelPositions[i] = snapped;
        this.wheels[i].currentPosition = snapped;
        changed = true;
      }
    }
    if (changed && !this.solved && this.isAligned()) {
      this.solved = true;
    }
  }

  // Toggle the SET flag on the primary wheel. SET is a player bookmark; it does not
  // affect the sweep (the engine ignores it) — mirrors Swift.
  toggleSet(): void {
    const i = this.primarySelected;
    if (i < 0 || i >= this.setFlags.length) return;
    this.setFlags[i] = !this.setFlags[i];
  }

  // A wheel is "flat" (no usable signal) when its individual sweep range is < 0.5% of the
  // static Y span. Depends only on wheelPositions. Returns true = flat (dim it).
  detectFlatWheels(): boolean[] {
    const ySpan = Math.max(1e-9, this.staticYHigh - this.staticYLow);
    return this.wheels.map((_, i) => {
      const data = UltraProbeEngine.sweep(new Set([i]), this.wheels, this.profile);
      let mn = Infinity;
      let mx = -Infinity;
      for (const v of data) {
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
      const range = mx - mn;
      return range / ySpan < 0.005;
    });
  }

  // Every wheel within gateWidth/2 of its gate (boundary inclusive).
  isAligned(): boolean {
    const range = this.numberRange;
    const halfWidth = this.profile.gateWidth / 2.0;
    const gates = this.gatePositions;
    for (let i = 0; i < gates.length; i++) {
      if (i >= this.wheelPositions.length) continue;
      if (AngleNormalizer.circularDistance(this.wheelPositions[i], gates[i], range) > halfWidth) {
        return false;
      }
    }
    return true;
  }
}
