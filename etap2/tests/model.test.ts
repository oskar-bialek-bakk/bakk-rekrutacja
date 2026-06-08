import { describe, it, expect } from 'vitest';
import { createEmptyAssessment, SCHEMA_VERSION } from '../src/domain/model';

describe('createEmptyAssessment', () => {
  it('tworzy pusty rekord z poprawnym schematem i pustymi mapami', () => {
    const a = createEmptyAssessment('id-1', { nameOrId: 'A. Kowalski', date: '2026-06-08', stage1Result: '78%', stage1Note: 'mocny SQL' });
    expect(a.id).toBe('id-1');
    expect(a.schemaVersion).toBe(SCHEMA_VERSION);
    expect(a.candidate.nameOrId).toBe('A. Kowalski');
    expect(a.marks).toEqual({});
    expect(a.flags).toEqual({});
    expect(a.notes).toEqual({});
    expect(a.askedQuestions).toEqual({});
    expect(a.decision).toBeNull();
    expect(a.negotiation.oczekiwania).toBe('');
    expect(a.useE).toBe(false);
    expect(typeof a.createdAt).toBe('string');
  });
});
