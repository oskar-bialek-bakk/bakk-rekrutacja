import type { Assessment } from '../domain/model';
import { migrateAssessment } from './migrations';

/**
 * Siatka bezpieczeństwa przed utratą wypełnianej oceny. Trzyma JEDNĄ ocenę
 * „w toku" (tę z session.current) w localStorage, niezależnie od wybranego
 * repozytorium (LocalStore / AzureStore). Zapis do localStorage jest
 * synchroniczny i nie wymaga tokenu, więc przeżywa redirect na logowanie,
 * przeładowanie strony, zamknięcie karty i crash — czyli scenariusze, w których
 * stan trzymany tylko w pamięci (session.current) przepadał.
 */
const K_DRAFT = 'etap2.draft';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AssessmentDraft {
  assessment: Assessment;
  /** ISO czasu ostatniego zrzutu draftu (zegar klienta). */
  savedAt: string;
}

export function writeDraft(
  a: Assessment,
  storage: StorageLike = localStorage,
  now: string = new Date().toISOString(),
): void {
  try {
    storage.setItem(K_DRAFT, JSON.stringify({ assessment: a, savedAt: now }));
  } catch {
    // localStorage niedostępny / pełny — draft jest best-effort, nie wywracaj aplikacji.
  }
}

export function readDraft(storage: StorageLike = localStorage): AssessmentDraft | null {
  let raw: string | null;
  try {
    raw = storage.getItem(K_DRAFT);
  } catch {
    return null;
  }
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw) as { assessment?: unknown; savedAt?: unknown };
    if (!parsed || typeof parsed !== 'object' || !parsed.assessment) return null;
    const assessment = migrateAssessment(parsed.assessment as Assessment);
    // Draft bez id jest bezużyteczny (nie da się go dopasować ani zapisać).
    if (!assessment.id) return null;
    const savedAt = typeof parsed.savedAt === 'string' ? parsed.savedAt : assessment.updatedAt;
    return { assessment, savedAt };
  } catch {
    return null;
  }
}

export function clearDraft(storage: StorageLike = localStorage): void {
  try {
    storage.removeItem(K_DRAFT);
  } catch {
    // ignore
  }
}
