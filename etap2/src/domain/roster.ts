import type { Decision } from './model';

export type SortKey = 'score' | 'date' | 'name';
export type SortDir = 'asc' | 'desc';
export type DecisionFilter = Decision | 'all';

export interface RosterEntry {
  nameOrId: string;
  date: string; // ISO yyyy-mm-dd (lexicographically sortable)
  decision: Decision | null;
  score: number;
}

function compareByKey(a: RosterEntry, b: RosterEntry, key: SortKey): number {
  if (key === 'score') return a.score - b.score;
  if (key === 'date') return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  return a.nameOrId.localeCompare(b.nameOrId, 'pl');
}

export function sortRows<T extends RosterEntry>(
  rows: readonly T[],
  key: SortKey,
  dir: SortDir,
): T[] {
  const factor = dir === 'asc' ? 1 : -1;
  // Decorate with original index so ties resolve deterministically,
  // independent of the engine's sort stability.
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const primary = compareByKey(a.row, b.row, key);
      if (primary !== 0) return primary * factor;
      return a.index - b.index;
    })
    .map((decorated) => decorated.row);
}

export function filterByDecision<T extends Pick<RosterEntry, 'decision'>>(
  rows: readonly T[],
  filter: DecisionFilter,
): T[] {
  if (filter === 'all') return rows.slice();
  return rows.filter((row) => row.decision === filter);
}
