import type { BlockTimes } from './timer';

export type BlockId = 'A' | 'B' | 'C' | 'D' | 'E';
export type Mark = 1 | 2 | 3 | 4 | 5;
export type Decision = 'yes' | 'no' | 'wait';

export interface Candidate {
  nameOrId: string;
  date: string;
  stage1Result: string;
  stage1Note: string;
}

export interface Negotiation {
  oczekiwania: string;
  widelki: string;
  formaUmowy: string;
  dostepnosc: string;
  uwagi: string;
}

export interface TimerState { elapsedSec: number; paused: boolean; offsetSec: number; }
export interface Flags { red: boolean; green: boolean; }

export interface Assessment {
  id: string;
  schemaVersion: number;
  candidate: Candidate;
  selectedVariants: Partial<Record<BlockId, number>>;
  deepenAsked: Partial<Record<BlockId, boolean>>;
  marks: Partial<Record<BlockId, Mark>>;
  flags: Partial<Record<BlockId, Flags>>;
  notes: Partial<Record<BlockId, string>>;
  decision: Decision | null;
  decisionNote: string;
  askedQuestions: Partial<Record<BlockId, Record<number, boolean>>>;
  negotiation: Negotiation;
  timer: TimerState;
  blockTimes: BlockTimes;
  useE: boolean;
  createdAt: string;
  updatedAt: string;
}

export type VariantUsage = Partial<Record<BlockId, Record<number, number>>>;
export interface Weights { A: number; B: number; C: number; D: number; E: number; }
export interface Settings { weights: Weights; showScoreLive: boolean; includeEInScore: boolean; }

export const SCHEMA_VERSION = 2;

function emptyNegotiation(): Negotiation {
  return { oczekiwania: '', widelki: '', formaUmowy: '', dostepnosc: '', uwagi: '' };
}

export function createEmptyAssessment(id: string, candidate: Candidate): Assessment {
  const now = new Date().toISOString();
  return {
    id, schemaVersion: SCHEMA_VERSION, candidate,
    selectedVariants: {}, deepenAsked: {}, marks: {}, flags: {}, notes: {},
    decision: null, decisionNote: '', askedQuestions: {}, negotiation: emptyNegotiation(),
    timer: { elapsedSec: 0, paused: false, offsetSec: 0 },
    blockTimes: {},
    useE: false, createdAt: now, updatedAt: now,
  };
}
