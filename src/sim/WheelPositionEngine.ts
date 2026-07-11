// Drive-pin / fly-gap state machine tracking wheel positions.
// Port of Simulation/WheelPositionEngine.swift.
import { AngleNormalizer } from './AngleNormalizer';

const PIN_WIDTH_DEGREES = 0.1;

export class WheelPositionEngine {
  positions: number[];
  coupledIndices = new Set<number>(); // wheels that moved during the last rotate()
  readonly gapSize: number; // full circle minus pin width, in dial increments

  private pinGap: number[];
  private readonly numberRange: number;
  private readonly wheelCount: number;

  constructor(wheelCount: number, numberRange: number, startingPositions?: number[]) {
    this.wheelCount = wheelCount;
    this.numberRange = numberRange;
    const pinWidthIncrements = (PIN_WIDTH_DEGREES / 360.0) * numberRange;
    this.gapSize = numberRange - pinWidthIncrements;
    this.positions = startingPositions ? [...startingPositions] : new Array(wheelCount).fill(0.0);
    if (startingPositions) {
      const nr = numberRange;
      this.pinGap = Array.from({ length: wheelCount }, (_, i) => {
        const driverPos = i === 0 ? 0.0 : startingPositions[i - 1];
        return (((startingPositions[i] - driverPos + nr) % nr) / nr) * (nr - pinWidthIncrements);
      });
    } else {
      this.pinGap = new Array(wheelCount).fill(this.gapSize);
    }
  }

  // Advance the dial by dialDelta increments. Positive = CCW (left), negative = CW (right).
  rotate(dialDelta: number): void {
    if (dialDelta === 0) return;
    let driverDelta = dialDelta;
    this.coupledIndices = new Set<number>();

    for (let i = 0; i < this.wheelCount; i++) {
      if (driverDelta === 0) break;

      // CCW driver (positive) decreases pinGap; CW driver (negative) increases it.
      this.pinGap[i] -= driverDelta;

      let wheelDelta: number;
      if (this.pinGap[i] < 0) {
        wheelDelta = -this.pinGap[i];
        this.pinGap[i] = 0;
      } else if (this.pinGap[i] > this.gapSize) {
        wheelDelta = -(this.pinGap[i] - this.gapSize);
        this.pinGap[i] = this.gapSize;
      } else {
        wheelDelta = 0;
      }

      if (wheelDelta !== 0) {
        this.positions[i] = AngleNormalizer.normalizePosition(
          this.positions[i] + wheelDelta,
          this.numberRange,
        );
        this.coupledIndices.add(i);
      }

      driverDelta = wheelDelta; // wheel i's movement drives wheel i+1
    }
  }

  // Reset to positions and restore home pin-gap state (used after sweepAll).
  reset(newPositions: number[]): void {
    this.positions = [...newPositions];
    this.pinGap = new Array(this.wheelCount).fill(this.gapSize);
  }

  // Restore positions and derive pin-gap state from dial/wheel geometry (resume path).
  restoreFromState(dialPosition: number, wheelPositions: number[]): void {
    this.positions = [...wheelPositions];
    const pinWidthIncrements = (PIN_WIDTH_DEGREES / 360.0) * this.numberRange;
    this.pinGap = Array.from({ length: this.wheelCount }, (_, i) => {
      const driverPos = i === 0 ? dialPosition : wheelPositions[i - 1];
      return (
        (((wheelPositions[i] - driverPos + this.numberRange) % this.numberRange) / this.numberRange) *
        (this.numberRange - pinWidthIncrements)
      );
    });
  }
}
