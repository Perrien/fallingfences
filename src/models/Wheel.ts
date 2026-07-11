// A single wheel in the lock — derived at runtime from LockProfile + Combination.
// Port of Models/Wheel.swift. Index convention: wheels[0] = closest to drive cam.
export interface FalseGate {
  readonly position: number;
  readonly depthRatio: number; // fraction of true gate depth
  readonly width: number;
}

export interface Wheel {
  readonly index: number;
  readonly gatePosition: number;
  readonly baseHeight: number;
  readonly noiseSamples: number[];
  readonly falseGates: FalseGate[];
  readonly ovalBumpPosition: number;
  readonly ovalFrequency: number;
  currentPosition: number; // mutable — updated by WheelPositionEngine (later phase)
}
