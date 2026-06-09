import { describe, expect, it } from 'vitest';
import { clearLocalSnapshot, readLocalSnapshot } from '../src/persistence/local-snapshot';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string): string | null { return this.store.get(k) ?? null; }
  setItem(k: string, v: string): void { this.store.set(k, v); }
  removeItem(k: string): void { this.store.delete(k); }
  has(k: string): boolean { return this.store.has(k); }
}

describe('readLocalSnapshot', () => {
  it('returns null when storage is empty', () => {
    expect(readLocalSnapshot(new MemoryStorage())).toBeNull();
  });

  it('returns null when only empty maps stored', () => {
    const s = new MemoryStorage();
    s.setItem('etap2.assessments', '{}');
    s.setItem('etap2.variantUsage', '{}');
    expect(readLocalSnapshot(s)).toBeNull();
  });

  it('reads assessments map + variant usage', () => {
    const s = new MemoryStorage();
    s.setItem('etap2.assessments', JSON.stringify({
      a1: {
        id: 'a1', schemaVersion: 2,
        candidate: { nameOrId: 'X', date: '2026-06-08', stage1Result: '', stage1Note: '' },
        selectedVariants: {}, deepenAsked: {}, marks: {}, flags: {}, notes: {},
        decision: null, decisionNote: '', askedQuestions: {},
        negotiation: { oczekiwania: '', widelki: '', formaUmowy: '', dostepnosc: '', uwagi: '' },
        timer: { elapsedSec: 0, paused: false, offsetSec: 0 },
        blockTimes: {}, useE: false, useAChart: false,
        createdAt: '2026-06-08T00:00:00Z', updatedAt: '2026-06-08T00:00:00Z',
      },
    }));
    s.setItem('etap2.variantUsage', JSON.stringify({ A: { 0: 3, 2: 1 } }));
    s.setItem('etap2.settings', JSON.stringify({
      weights: { A: 0.2, B: 0.2, C: 0.25, D: 0.35, E: 0 },
      showScoreLive: false,
      includeEInScore: false,
    }));
    const snap = readLocalSnapshot(s);
    expect(snap).not.toBeNull();
    expect(snap!.assessments).toHaveLength(1);
    expect(snap!.counts.assessments).toBe(1);
    expect(snap!.counts.variantUsage).toBe(4);
    expect(snap!.counts.settings).toBe(1);
  });

  it('clears keys', () => {
    const s = new MemoryStorage();
    s.setItem('etap2.assessments', '{"a":1}');
    s.setItem('etap2.variantUsage', '{}');
    s.setItem('etap2.settings', '{}');
    clearLocalSnapshot(s);
    expect(s.has('etap2.assessments')).toBe(false);
    expect(s.has('etap2.variantUsage')).toBe(false);
    expect(s.has('etap2.settings')).toBe(false);
  });

  it('tolerates corrupted JSON', () => {
    const s = new MemoryStorage();
    s.setItem('etap2.assessments', 'not json');
    expect(readLocalSnapshot(s)).toBeNull();
  });
});
