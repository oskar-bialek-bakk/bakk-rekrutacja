import type { Assessment } from '../domain/model';
import { migrateAssessment } from '../persistence/migrations';

export function serializeAssessment(a: Assessment): string {
  return JSON.stringify(a, null, 2);
}

export function serializeAll(list: Assessment[]): string {
  return JSON.stringify(list, null, 2);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasValidId(entry: unknown): boolean {
  return isPlainObject(entry) && typeof entry.id === 'string' && entry.id.length > 0;
}

export function parseImport(text: string): Assessment[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Nieprawidłowy plik JSON (nie udalo sie sparsowac).');
  }

  let entries: unknown[];
  if (Array.isArray(parsed)) {
    entries = parsed;
  } else if (isPlainObject(parsed)) {
    entries = [parsed];
  } else {
    throw new Error('Nieprawidłowy format importu: oczekiwano oceny lub listy ocen.');
  }

  for (const entry of entries) {
    if (!hasValidId(entry)) {
      throw new Error('Nieprawidłowy rekord w imporcie: brak poprawnego pola id.');
    }
  }

  return entries.map((entry) => migrateAssessment(entry));
}
