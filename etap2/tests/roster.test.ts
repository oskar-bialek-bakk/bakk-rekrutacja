import { describe, it, expect } from 'vitest';
import {
  sortRows,
  filterByDecision,
  type RosterEntry,
} from '../src/domain/roster';

function entry(over: Partial<RosterEntry>): RosterEntry {
  return {
    nameOrId: 'X',
    date: '2026-01-01',
    decision: null,
    score: 0,
    ...over,
  };
}

describe('sortRows', () => {
  it('sortuje po wyniku rosnąco', () => {
    const rows = [entry({ score: 30 }), entry({ score: 10 }), entry({ score: 20 })];
    const out = sortRows(rows, 'score', 'asc');
    expect(out.map((r) => r.score)).toEqual([10, 20, 30]);
  });

  it('sortuje po wyniku malejąco', () => {
    const rows = [entry({ score: 30 }), entry({ score: 10 }), entry({ score: 20 })];
    const out = sortRows(rows, 'score', 'desc');
    expect(out.map((r) => r.score)).toEqual([30, 20, 10]);
  });

  it('sortuje po dacie rosnąco', () => {
    const rows = [
      entry({ date: '2026-03-01' }),
      entry({ date: '2026-01-01' }),
      entry({ date: '2026-02-01' }),
    ];
    const out = sortRows(rows, 'date', 'asc');
    expect(out.map((r) => r.date)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
  });

  it('sortuje po dacie malejąco', () => {
    const rows = [
      entry({ date: '2026-01-01' }),
      entry({ date: '2026-03-01' }),
      entry({ date: '2026-02-01' }),
    ];
    const out = sortRows(rows, 'date', 'desc');
    expect(out.map((r) => r.date)).toEqual(['2026-03-01', '2026-02-01', '2026-01-01']);
  });

  it('sortuje po nazwisku z polską kolacją (asc)', () => {
    const rows = [
      entry({ nameOrId: 'Żaneta' }),
      entry({ nameOrId: 'Anna' }),
      entry({ nameOrId: 'Łukasz' }),
    ];
    const out = sortRows(rows, 'name', 'asc');
    // pl: Anna < Łukasz (Ł po L, przed M) < Żaneta (Ż ostatnie)
    expect(out.map((r) => r.nameOrId)).toEqual(['Anna', 'Łukasz', 'Żaneta']);
  });

  it('sortuje po nazwisku z polską kolacją (desc)', () => {
    const rows = [
      entry({ nameOrId: 'Anna' }),
      entry({ nameOrId: 'Żaneta' }),
      entry({ nameOrId: 'Łukasz' }),
    ];
    const out = sortRows(rows, 'name', 'desc');
    expect(out.map((r) => r.nameOrId)).toEqual(['Żaneta', 'Łukasz', 'Anna']);
  });

  it('stabilny tie-break: równy wynik zachowuje pierwotną kolejność', () => {
    const rows = [
      entry({ nameOrId: 'pierwszy', score: 50 }),
      entry({ nameOrId: 'drugi', score: 50 }),
      entry({ nameOrId: 'trzeci', score: 50 }),
    ];
    const asc = sortRows(rows, 'score', 'asc');
    expect(asc.map((r) => r.nameOrId)).toEqual(['pierwszy', 'drugi', 'trzeci']);
    const desc = sortRows(rows, 'score', 'desc');
    expect(desc.map((r) => r.nameOrId)).toEqual(['pierwszy', 'drugi', 'trzeci']);
  });

  it('nie mutuje wejścia i zwraca nową tablicę', () => {
    const first = entry({ nameOrId: 'A', score: 10 });
    const rows = [first, entry({ nameOrId: 'B', score: 30 }), entry({ nameOrId: 'C', score: 20 })];
    const out = sortRows(rows, 'score', 'desc');
    expect(out).not.toBe(rows);
    expect(rows[0]).toBe(first);
    expect(rows.map((r) => r.score)).toEqual([10, 30, 20]);
  });
});

describe('filterByDecision', () => {
  const rows = [
    entry({ nameOrId: 'a', decision: 'yes' }),
    entry({ nameOrId: 'b', decision: 'no' }),
    entry({ nameOrId: 'c', decision: 'wait' }),
    entry({ nameOrId: 'd', decision: null }),
    entry({ nameOrId: 'e', decision: 'yes' }),
  ];

  it("'all' zwraca wszystkie wiersze jako nową tablicę", () => {
    const out = filterByDecision(rows, 'all');
    expect(out).toHaveLength(rows.length);
    expect(out).not.toBe(rows);
    expect(out.map((r) => r.nameOrId)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it("'yes' zwraca tylko zaakceptowane", () => {
    const out = filterByDecision(rows, 'yes');
    expect(out.map((r) => r.nameOrId)).toEqual(['a', 'e']);
  });

  it("'no' zwraca tylko odrzucone", () => {
    const out = filterByDecision(rows, 'no');
    expect(out.map((r) => r.nameOrId)).toEqual(['b']);
  });

  it("'wait' zwraca tylko oczekujące", () => {
    const out = filterByDecision(rows, 'wait');
    expect(out.map((r) => r.nameOrId)).toEqual(['c']);
  });

  it('filtrowanie po konkretnej decyzji wyklucza null', () => {
    const out = filterByDecision(rows, 'yes');
    expect(out.every((r) => r.decision === 'yes')).toBe(true);
  });

  it('nie mutuje wejścia', () => {
    const before = rows.map((r) => r.nameOrId);
    filterByDecision(rows, 'no');
    expect(rows.map((r) => r.nameOrId)).toEqual(before);
  });

  it('pusta tablica wejściowa zwraca []', () => {
    expect(filterByDecision([], 'all')).toEqual([]);
    expect(filterByDecision([], 'yes')).toEqual([]);
  });
});
