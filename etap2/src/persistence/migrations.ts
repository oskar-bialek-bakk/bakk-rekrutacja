import type { Assessment, Candidate, Flags, Negotiation, QnaAnswers, TimerState } from '../domain/model';
import { SCHEMA_VERSION } from '../domain/model';
import type { BlockTimes } from '../domain/timer';

function ensureBlockTimes(b: unknown): BlockTimes {
  if (!b || typeof b !== 'object') return {};
  const out: BlockTimes = {};
  for (const [key, val] of Object.entries(b as Record<string, unknown>)) {
    if (key !== 'A' && key !== 'B' && key !== 'C' && key !== 'D' && key !== 'E') continue;
    const v = val as { spentSec?: unknown } | null | undefined;
    const raw = typeof v?.spentSec === 'number' ? v.spentSec : 0;
    const spent = Number.isFinite(raw) ? Math.max(0, raw) : 0;
    out[key] = { spentSec: spent };
  }
  return out;
}

function ensureCandidate(c: unknown): Candidate {
  const obj = (c ?? {}) as Partial<Candidate>;
  const out: Candidate = {
    nameOrId: obj.nameOrId ?? '',
    date: obj.date ?? '',
    stage1Result: obj.stage1Result ?? '',
    stage1Note: obj.stage1Note ?? '',
  };
  if (typeof obj.traffitId === 'number') out.traffitId = obj.traffitId;
  if (typeof obj.recruitmentId === 'number') out.recruitmentId = obj.recruitmentId;
  if (typeof obj.recruitmentName === 'string') out.recruitmentName = obj.recruitmentName;
  return out;
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

function ensureQna(v: unknown): QnaAnswers {
  if (!v || typeof v !== 'object') return {};
  const out: QnaAnswers = {};
  for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'string') out[key] = val;
  }
  return out;
}

function ensureClosingFlags(v: unknown): Record<string, Flags> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, Flags> = {};
  for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
    const f = (val ?? {}) as Partial<Flags>;
    out[key] = { red: f.red === true, green: f.green === true };
  }
  return out;
}

function ensureSignalChecks(v: unknown): Record<string, Record<string, boolean>> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, Record<string, boolean>> = {};
  for (const [qid, sigs] of Object.entries(v as Record<string, unknown>)) {
    if (!sigs || typeof sigs !== 'object') continue;
    const inner: Record<string, boolean> = {};
    for (const [sid, on] of Object.entries(sigs as Record<string, unknown>)) {
      if (on === true) inner[sid] = true;
    }
    if (Object.keys(inner).length > 0) out[qid] = inner;
  }
  return out;
}

function ensureTimer(t: unknown): TimerState {
  const obj = (t ?? {}) as Partial<TimerState>;
  return {
    elapsedSec: typeof obj.elapsedSec === 'number' ? obj.elapsedSec : 0,
    paused: typeof obj.paused === 'boolean' ? obj.paused : false,
    offsetSec: typeof obj.offsetSec === 'number' ? obj.offsetSec : 0,
    phase45Notified: typeof obj.phase45Notified === 'boolean' ? obj.phase45Notified : false,
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
    askedQuestions: (r.askedQuestions ?? {}) as Assessment['askedQuestions'],
    intro: ensureQna(r.intro),
    closing: ensureQna(r.closing),
    closingFlags: ensureClosingFlags(r.closingFlags),
    signalChecks: ensureSignalChecks(r.signalChecks),
    negotiation: ensureNegotiation(r.negotiation),
    timer: ensureTimer(r.timer),
    blockTimes: ensureBlockTimes(r.blockTimes),
    useE: typeof r.useE === 'boolean' ? r.useE : false,
    useAChart: typeof r.useAChart === 'boolean' ? r.useAChart : false,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : now,
  };
}
