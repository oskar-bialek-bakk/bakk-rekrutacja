import type { Assessment } from './model';

export interface TraffitCandidate {
  employeeId: number;
  recruitmentId: number;
  recruitmentName: string;
  fullName: string;
  email: string | null;
}

function pairKey(traffitId: number, recruitmentId: number): string {
  return `${traffitId}::${recruitmentId}`;
}

/** Ukrywa pary (traffitId, recruitmentId) już obecne w rosterze; sortuje po employeeId rosnąco. */
export function selectableCandidates(
  all: ReadonlyArray<TraffitCandidate>,
  assessments: ReadonlyArray<Assessment>,
): TraffitCandidate[] {
  const taken = new Set<string>();
  for (const a of assessments) {
    const { traffitId, recruitmentId } = a.candidate;
    if (typeof traffitId === 'number' && typeof recruitmentId === 'number') {
      taken.add(pairKey(traffitId, recruitmentId));
    }
  }
  return all
    .filter((c) => !taken.has(pairKey(c.employeeId, c.recruitmentId)))
    .slice()
    .sort((x, y) => x.employeeId - y.employeeId);
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Najlepsze dopasowanie po wspólnych tokenach (>=3 znaki). Wejście zakładamy posortowane po employeeId. */
export function bestNameMatch(
  all: ReadonlyArray<TraffitCandidate>,
  name: string,
): TraffitCandidate | null {
  const target = new Set(tokens(name));
  if (target.size === 0) return null;
  let best: TraffitCandidate | null = null;
  let bestScore = 0;
  for (const c of all) {
    let score = 0;
    for (const t of tokens(c.fullName)) {
      if (t.length >= 3 && target.has(t)) score++;
    }
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}
