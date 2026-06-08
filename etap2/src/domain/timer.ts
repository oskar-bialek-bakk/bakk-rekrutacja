import type { BlockId, TimerState } from './model';

export interface BlockTime {
  spentSec: number;
}

export type BlockTimes = Partial<Record<BlockId, BlockTime>>;

export type WarnLevel = 'ok' | 'warn' | 'over';

/**
 * Parsuje string typu "5 min", "10 min", "30 s", "1 h" do liczby sekund.
 * Akceptuje też zakresy ("9-10 min", "9–10 min"); dla zakresu bierze górną granicę
 * (kandydat dostaje cały budżet, ostrzeżenia odpalają po jego przekroczeniu).
 * Zwraca null dla nieparsowalnych. Trimuje i ignoruje wielkość liter.
 */
export function parseTargetSec(time: string): number | null {
  if (typeof time !== 'string') return null;
  const normalized = time.trim().toLowerCase().replace(/[–—]/g, '-');
  const m = normalized.match(/^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*(s|min|m|h)$/);
  if (!m) return null;
  const upper = m[2] != null ? Number(m[2]) : Number(m[1]);
  if (!Number.isFinite(upper)) return null;
  const unit = m[3];
  switch (unit) {
    case 's': return Math.round(upper);
    case 'm':
    case 'min': return Math.round(upper * 60);
    case 'h': return Math.round(upper * 3600);
    default: return null;
  }
}

/**
 * 'ok' gdy spent < target; 'warn' gdy target ≤ spent < 1.2 * target; 'over' gdy spent ≥ 1.2 * target.
 * Gdy targetSec ≤ 0 lub null → zawsze 'ok'.
 */
export function warnLevel(spentSec: number, targetSec: number | null): WarnLevel {
  if (targetSec === null || targetSec <= 0) return 'ok';
  if (spentSec < targetSec) return 'ok';
  if (spentSec < 1.2 * targetSec) return 'warn';
  return 'over';
}

/**
 * Immutable: zwraca nowy BlockTimes z dolanym deltaSec (≥0) do wskazanego bloku.
 * Wejściowy obiekt nietknięty. Ujemne delty są ignorowane.
 */
export function tickBlock(times: BlockTimes, blockId: BlockId, deltaSec: number): BlockTimes {
  if (!Number.isFinite(deltaSec) || deltaSec <= 0) {
    return { ...times };
  }
  const current = times[blockId]?.spentSec ?? 0;
  return {
    ...times,
    [blockId]: { spentSec: current + deltaSec },
  };
}

/**
 * Sumarycznie spędzony czas we wszystkich blokach (sekundy).
 */
export function totalSpentSec(times: BlockTimes): number {
  let sum = 0;
  for (const key of Object.keys(times) as BlockId[]) {
    sum += times[key]?.spentSec ?? 0;
  }
  return sum;
}

/**
 * Immutable: zwraca nowy TimerState z paused=true.
 */
export function pauseTimer(t: TimerState): TimerState {
  return { ...t, paused: true };
}

/**
 * Immutable: zwraca nowy TimerState z paused=false.
 */
export function resumeTimer(t: TimerState): TimerState {
  return { ...t, paused: false };
}

/**
 * Immutable: koryguje offsetSec o deltaSec (moze byc ujemne).
 * Invariant: elapsedSec to wartosc wynikowa pokazywana na ekranie (zawiera juz offset).
 * Aby elapsedSec po korekcie nie spadlo ponizej 0, deltaSec jest clampowane do
 * dolnej granicy -elapsedSec. Przyklad: elapsedSec=10, deltaSec=-30 → effective=-10.
 */
export function adjustOffset(t: TimerState, deltaSec: number): TimerState {
  if (!Number.isFinite(deltaSec) || deltaSec === 0) return { ...t };
  const effective = deltaSec < 0 ? Math.max(deltaSec, -t.elapsedSec) : deltaSec;
  return { ...t, offsetSec: t.offsetSec + effective };
}
