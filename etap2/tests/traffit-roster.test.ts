import { describe, it, expect } from 'vitest';
import { selectableCandidates, bestNameMatch, type TraffitCandidate } from '../src/domain/traffit-roster';
import { createEmptyAssessment } from '../src/domain/model';

const c = (employeeId: number, recruitmentId: number, fullName = 'X Y'): TraffitCandidate =>
  ({ employeeId, recruitmentId, recruitmentName: `R${recruitmentId}`, fullName, email: null });

describe('selectableCandidates', () => {
  it('ukrywa pary (traffitId, recruitmentId) już w rosterze, sortuje po employeeId', () => {
    const all = [c(30, 63), c(10, 63), c(10, 62), c(20, 63)];
    const a = createEmptyAssessment('a1', {
      nameOrId: 'X', date: '', stage1Result: '', stage1Note: '', traffitId: 10, recruitmentId: 63,
    });
    const res = selectableCandidates(all, [a]);
    expect(res.map((x) => `${x.employeeId}/${x.recruitmentId}`)).toEqual(['10/62', '20/63', '30/63']);
  });

  it('ta sama osoba w innej rekrutacji nadal się pokazuje', () => {
    const all = [c(10, 62), c(10, 63)];
    const a = createEmptyAssessment('a1', {
      nameOrId: 'X', date: '', stage1Result: '', stage1Note: '', traffitId: 10, recruitmentId: 63,
    });
    expect(selectableCandidates(all, [a]).map((x) => x.recruitmentId)).toEqual([62]);
  });
});

describe('bestNameMatch', () => {
  it('dopasowuje po nazwisku i imieniu ignorując wielkość liter i diakrytyki', () => {
    const all = [c(1, 63, 'Nowak Anna'), c(2, 63, 'Kowalski Łukasz')];
    expect(bestNameMatch(all, 'łukasz kowalski')?.employeeId).toBe(2);
  });

  it('zwraca null gdy brak wspólnych tokenów', () => {
    expect(bestNameMatch([c(1, 63, 'Nowak Anna')], 'Zaradny Piotr')).toBeNull();
  });
});
