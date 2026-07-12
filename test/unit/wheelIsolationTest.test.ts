import { describe, it, expect } from 'vitest';
import {
  buildTest,
  repopulateTest,
  rowWidth,
  testWheelCount,
  winnerRowIndex,
} from '../../src/models/WheelIsolationTest';

// Fill a row's readings so rowWidth() returns `width` (lcp fixed at 0).
function setWidth(row: { lcpReading: number | null; rcpReading: number | null }, width: number) {
  row.lcpReading = 0;
  row.rcpReading = width;
}

describe('WheelIsolationTest', () => {
  it('builds Test + Control + one row per wheel', () => {
    const t = buildTest(3, 0, 50);
    expect(testWheelCount(t)).toBe(3);
    expect(t.rows.map((r) => r.label)).toEqual(['Test', 'Control', 'W1', 'W2', 'W3']);
    // W1 (display) = internal index 2 held at control; others at test.
    expect(t.rows[2].wheelPositions).toEqual([0, 0, 50]); // W1 → internal idx 2 @ control
    expect(t.rows[4].wheelPositions).toEqual([50, 0, 0]); // W3 → internal idx 0 @ control
  });

  it('winner = the wheel row whose width jumps most over the Test baseline', () => {
    const t = buildTest(3, 0, 50);
    setWidth(t.rows[0], 5); // Test baseline width 5
    setWidth(t.rows[1], 5); // Control
    setWidth(t.rows[2], 5); // W1 — no jump
    setWidth(t.rows[3], 9); // W2 — biggest jump → winner
    setWidth(t.rows[4], 6); // W3 — small jump
    expect(winnerRowIndex(t)).toBe(3);
  });

  it('no winner until every row is read', () => {
    const t = buildTest(3, 0, 50);
    setWidth(t.rows[0], 5);
    expect(winnerRowIndex(t)).toBeNull();
  });

  it('ties are inconclusive (no unique winner)', () => {
    const t = buildTest(3, 0, 50);
    setWidth(t.rows[0], 5);
    setWidth(t.rows[1], 5);
    setWidth(t.rows[2], 8);
    setWidth(t.rows[3], 8); // tie with W1
    setWidth(t.rows[4], 5);
    expect(winnerRowIndex(t)).toBeNull();
  });

  it('repopulate resets rows and clears readings', () => {
    const t = buildTest(3, 0, 50);
    setWidth(t.rows[0], 5);
    repopulateTest(t, 10, 60);
    expect(t.testPosition).toBe(10);
    expect(t.rows[0].wheelPositions).toEqual([10, 10, 10]);
    expect(rowWidth(t.rows[0])).toBeNull();
  });
});
