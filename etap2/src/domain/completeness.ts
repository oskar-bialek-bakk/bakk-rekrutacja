import type { BlockId } from './model';

/**
 * Zwraca aktywne bloki (w kolejności wejścia), które nie mają notatki
 * albo mają notatkę złożoną wyłącznie z białych znaków.
 * Nie mutuje argumentów.
 */
export function blocksMissingNotes(
  notes: Partial<Record<BlockId, string>>,
  activeBlockIds: readonly BlockId[],
): BlockId[] {
  return activeBlockIds.filter((id) => (notes[id] ?? '').trim() === '');
}
