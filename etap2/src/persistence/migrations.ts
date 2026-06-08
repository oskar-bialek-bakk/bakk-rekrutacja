import type { Assessment, Candidate, Negotiation, TimerState } from '../domain/model';
import { SCHEMA_VERSION } from '../domain/model';

function ensureCandidate(c: unknown): Candidate {
  const obj = (c ?? {}) as Partial<Candidate>;
  return {
    nameOrId: obj.nameOrId ?? '',
    date: obj.date ?? '',
    stage1Result: obj.stage1Result ?? '',
    stage1Note: obj.stage1Note ?? '',
  };
}

function ensureNegotiation(n: unknown): Negotiation {
  const obj = (n ?? {}) as Partial<Negotiation>;
  return {
    oczekiwania: obj.oczekiwania ?? '',
    widelki: obj.widelki ?? '',
    formaUmowy: obj.formaUmowy ?? '',
    dostepnosc: obj.dostepnosc ?? '',
    uwagi: obj.uwagi ?? '',
  };
}

function ensureTimer(t: unknown): TimerState {
  const obj = (t ?? {}) as Partial<TimerState>;
  return {
    elapsedSec: typeof obj.elapsedSec === 'number' ? obj.elapsedSec : 0,
    paused: typeof obj.paused === 'boolean' ? obj.paused : false,
    offsetSec: typeof obj.offsetSec === 'number' ? obj.offsetSec : 0,
  };
}

export function migrateAssessment(raw: unknown): Assessment {
  const r = (raw ?? {}) as Partial<Assessment> & Record<string, unknown>;
  const now = new Date().toISOString();
  return {
    id: typeof r.id === 'string' ? r.id : '',
    schemaVersion: SCHEMA_VERSION,
    candidate: ensureCandidate(r.candidate),
    selectedVariants: (r.selectedVariants ?? {}) as Assessment['selectedVariants'],
    deepenAsked: (r.deepenAsked ?? {}) as Assessment['deepenAsked'],
    marks: (r.marks ?? {}) as Assessment['marks'],
    flags: (r.flags ?? {}) as Assessment['flags'],
    notes: (r.notes ?? {}) as Assessment['notes'],
    decision: (r.decision ?? null) as Assessment['decision'],
    decisionNote: typeof r.decisionNote === 'string' ? r.decisionNote : '',
    negotiation: ensureNegotiation(r.negotiation),
    timer: ensureTimer(r.timer),
    useE: typeof r.useE === 'boolean' ? r.useE : false,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : now,
  };
}
