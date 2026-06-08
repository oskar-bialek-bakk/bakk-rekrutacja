import { describe, it, expect } from 'vitest';
import { computeScore } from '../src/domain/scoring';
import { DEFAULT_WEIGHTS } from '../src/domain/weights.config';

describe('computeScore', () => {
  it('wszystkie A-D = 5 → 100, kompletne', () => {
    const r = computeScore({ A: 5, B: 5, C: 5, D: 5 }, DEFAULT_WEIGHTS);
    expect(r.score).toBe(100);
    expect(r.complete).toBe(true);
    expect(r.scoredCount).toBe(4);
  });

  it('wszystkie A-D = 1 → 20', () => {
    const r = computeScore({ A: 1, B: 1, C: 1, D: 1 }, DEFAULT_WEIGHTS);
    expect(r.score).toBe(20);
  });

  it('nieoceniony blok NIE zaniża wyniku (naprawa buga POC)', () => {
    const r = computeScore({ A: 5, B: 5 }, DEFAULT_WEIGHTS);
    expect(r.score).toBe(100);
    expect(r.complete).toBe(false);
    expect(r.scoredCount).toBe(2);
    expect(r.totalWeightedBlocks).toBe(4);
  });

  it('blok E (waga 0) jest ignorowany domyślnie', () => {
    const r = computeScore({ A: 5, B: 5, C: 5, D: 5, E: 1 }, DEFAULT_WEIGHTS);
    expect(r.score).toBe(100);
    expect(r.profile.E).toBeUndefined();
  });

  it('brak ocen → 0, scoredCount 0', () => {
    const r = computeScore({}, DEFAULT_WEIGHTS);
    expect(r.score).toBe(0);
    expect(r.scoredCount).toBe(0);
  });

  it('zmiana wag zmienia wynik', () => {
    const w = { A: 100, B: 0, C: 0, D: 0, E: 0 };
    const r = computeScore({ A: 3, B: 5, C: 5, D: 5 }, w);
    expect(r.score).toBe(60);
  });

  it('profil zwraca poziom per oceniony blok', () => {
    const r = computeScore({ A: 4, B: 2 }, DEFAULT_WEIGHTS);
    expect(r.profile).toEqual({ A: 4, B: 2 });
  });
});
