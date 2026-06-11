import { describe, expect, it } from 'vitest';
import { clearDraft, readDraft, writeDraft, type AssessmentDraft } from '../src/persistence/draft';
import { createEmptyAssessment, type Assessment } from '../src/domain/model';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string): string | null { return this.store.get(k) ?? null; }
  setItem(k: string, v: string): void { this.store.set(k, v); }
  removeItem(k: string): void { this.store.delete(k); }
  has(k: string): boolean { return this.store.has(k); }
}

function sample(id = 'd1'): Assessment {
  const a = createEmptyAssessment(id, { nameOrId: 'Kandydat X', date: '2026-06-11', stage1Result: '', stage1Note: '' });
  a.notes.A = 'notatka z bloku A';
  a.decisionNote = 'wstępna decyzja';
  return a;
}

describe('draft persistence', () => {
  it('returns null when no draft stored', () => {
    expect(readDraft(new MemoryStorage())).toBeNull();
  });

  it('round-trips an in-progress assessment with its savedAt', () => {
    const s = new MemoryStorage();
    const a = sample();
    writeDraft(a, s, '2026-06-11T15:00:00.000Z');
    const draft = readDraft(s);
    expect(draft).not.toBeNull();
    expect(draft!.assessment.id).toBe('d1');
    expect(draft!.assessment.notes.A).toBe('notatka z bloku A');
    expect(draft!.assessment.decisionNote).toBe('wstępna decyzja');
    expect(draft!.savedAt).toBe('2026-06-11T15:00:00.000Z');
  });

  it('migrates older draft shapes on read (no new fields stored)', () => {
    const s = new MemoryStorage();
    // Stary kształt bez intro/closing/signalChecks — migrateAssessment ma dolać defaulty.
    s.setItem('etap2.draft', JSON.stringify({
      assessment: {
        id: 'old1', schemaVersion: 2,
        candidate: { nameOrId: 'Y', date: '2026-06-08', stage1Result: '', stage1Note: '' },
        selectedVariants: {}, deepenAsked: {}, marks: {}, flags: {}, notes: {},
        decision: null, decisionNote: '', askedQuestions: {},
        negotiation: { oczekiwania: '', widelki: '', formaUmowy: '', dostepnosc: '', uwagi: '' },
        timer: { elapsedSec: 0, paused: false, offsetSec: 0 },
        blockTimes: {}, useE: false, useAChart: false,
        createdAt: '2026-06-08T00:00:00Z', updatedAt: '2026-06-08T00:00:00Z',
      },
      savedAt: '2026-06-08T01:00:00Z',
    }));
    const draft = readDraft(s) as AssessmentDraft;
    expect(draft.assessment.id).toBe('old1');
    expect(draft.assessment.intro).toEqual({});
    expect(draft.assessment.closing).toEqual({});
    expect(draft.assessment.signalChecks).toEqual({});
  });

  it('returns null for a draft without an id', () => {
    const s = new MemoryStorage();
    s.setItem('etap2.draft', JSON.stringify({ assessment: { id: '' }, savedAt: 'x' }));
    expect(readDraft(s)).toBeNull();
  });

  it('tolerates corrupted JSON', () => {
    const s = new MemoryStorage();
    s.setItem('etap2.draft', 'not json');
    expect(readDraft(s)).toBeNull();
  });

  it('clears the draft', () => {
    const s = new MemoryStorage();
    writeDraft(sample(), s);
    expect(s.has('etap2.draft')).toBe(true);
    clearDraft(s);
    expect(s.has('etap2.draft')).toBe(false);
  });
});
