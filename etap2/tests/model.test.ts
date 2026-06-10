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
    expect(a.intro).toEqual({});
    expect(a.closing).toEqual({});
    expect(a.closingFlags).toEqual({});
    expect(a.signalChecks).toEqual({});
    expect(a.decision).toBeNull();
    expect(a.negotiation.oczekiwania).toBe('');
    expect(a.useE).toBe(false);
    expect(a.blockTimes).toEqual({});
    expect(SCHEMA_VERSION).toBe(3);
    expect(typeof a.createdAt).toBe('string');
  });

  it('createEmptyAssessment zachowuje opcjonalne pola Traffit', () => {
    const a = createEmptyAssessment('id-1', {
      nameOrId: 'Kowalski Jan', date: '2026-06-09', stage1Result: '', stage1Note: '',
      traffitId: 4242, recruitmentId: 63, recruitmentName: 'C# SQL 05-2026',
    });
    expect(a.candidate.traffitId).toBe(4242);
    expect(a.candidate.recruitmentId).toBe(63);
    expect(a.candidate.recruitmentName).toBe('C# SQL 05-2026');
  });
});
