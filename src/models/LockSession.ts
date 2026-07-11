// Session state, probe readings, and configuration enums. Port of Models/LockSession.swift.
import type { LockProfile } from './LockProfile';
import type { Combination } from './Combination';

export type ContactSide = 'rcp' | 'lcp' | 'both';

// Which wheels were moving vs. parked when a probe was taken.
export type WheelConfiguration =
  | { kind: 'allMoving' }
  | { kind: 'oneParked'; index: number }
  | { kind: 'isolated'; movingIndex: number };

export interface ProbeReading {
  readonly id: string;
  readonly wheelIndex: number;
  readonly wheelPosition: number;
  readonly rcp: number;
  readonly lcp: number;
  readonly width: number;
  readonly configuration: WheelConfiguration;
  readonly timestamp: number; // epoch ms
  readonly measuredContact: ContactSide;
}

export interface LockSession {
  readonly id: string;
  readonly profile: LockProfile;
  combination: Combination;
  probeHistory: ProbeReading[];
  solvedAt: number | null; // epoch ms
}

export function isSolved(session: LockSession): boolean {
  return session.solvedAt !== null;
}
