// Wheel-isolation test model. Port of Models/WheelIsolationTest.swift.
// A test holds a Test position (T) and Control position (C) and a set of rows:
//   [Test (all wheels @ T), Control (all @ C), W1..Wn (all @ T except one wheel @ C)].
// After every row is probed, the wheel row whose width increased most over the Test row's
// width is the gate candidate (winner) — that isolates which wheel's gate sits near T.
import type { LockProfile } from './LockProfile';

export interface IsolationRow {
  id: string;
  label: string;
  wheelPositions: number[]; // one per internal wheel index (cam-adjacent first)
  lcpReading: number | null;
  rcpReading: number | null;
}

export interface WheelIsolationTest {
  id: string;
  testPosition: number;
  controlPosition: number;
  rows: IsolationRow[];
}

export function rowWidth(r: IsolationRow): number | null {
  return r.lcpReading !== null && r.rcpReading !== null ? r.rcpReading - r.lcpReading : null;
}

export function testWheelCount(t: WheelIsolationTest): number {
  return Math.max(0, t.rows.length - 2);
}

// Display order: W1 = first digit dialed = internal index wheelCount-1, descending.
function makeRows(wheelCount: number, tp: number, cp: number): IsolationRow[] {
  const rows: IsolationRow[] = [];
  const row = (label: string, positions: number[]): IsolationRow => ({
    id: crypto.randomUUID(),
    label,
    wheelPositions: positions,
    lcpReading: null,
    rcpReading: null,
  });
  rows.push(row('Test', new Array(wheelCount).fill(tp)));
  rows.push(row('Control', new Array(wheelCount).fill(cp)));
  for (let displayIdx = 0; displayIdx < wheelCount; displayIdx++) {
    const internalIdx = wheelCount - 1 - displayIdx;
    const pos = new Array(wheelCount).fill(tp);
    pos[internalIdx] = cp;
    rows.push(row(`W${displayIdx + 1}`, pos));
  }
  return rows;
}

export function buildTest(wheelCount: number, tp: number, cp: number): WheelIsolationTest {
  return { id: crypto.randomUUID(), testPosition: tp, controlPosition: cp, rows: makeRows(wheelCount, tp, cp) };
}

export function repopulateTest(t: WheelIsolationTest, tp: number, cp: number): void {
  t.testPosition = tp;
  t.controlPosition = cp;
  t.rows = makeRows(testWheelCount(t), tp, cp);
}

// The wheel row (index ≥ 2) whose width increased the most over the Test row's width.
// null until every row is read, or if there's no unique positive winner.
export function winnerRowIndex(t: WheelIsolationTest): number | null {
  if (!t.rows.every((r) => rowWidth(r) !== null)) return null;
  const testWidth = rowWidth(t.rows[0]);
  if (testWidth === null) return null;
  let bestIdx: number | null = null;
  let bestIncrease = 0;
  for (let i = 2; i < t.rows.length; i++) {
    const increase = (rowWidth(t.rows[i]) ?? 0) - testWidth;
    if (increase > bestIncrease) {
      bestIncrease = increase;
      bestIdx = i;
    }
  }
  if (bestIdx === null || bestIncrease <= 0) return null;
  const ties = [];
  for (let i = 2; i < t.rows.length; i++) {
    if (Math.abs((rowWidth(t.rows[i]) ?? 0) - testWidth - bestIncrease) < 1e-9) ties.push(i);
  }
  return ties.length === 1 ? bestIdx : null;
}

// Default control position for a new test — mid-dial, matching the app's "0 / 50" defaults scaled.
export function defaultControl(profile: LockProfile): number {
  return Math.round(profile.numberRange / 2);
}
