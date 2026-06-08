import type { Assessment, Settings, VariantUsage } from '../domain/model';
import { migrateAssessment } from './migrations';

const K_ASSESS = 'etap2.assessments';
const K_USAGE = 'etap2.variantUsage';
const K_SETTINGS = 'etap2.settings';

export interface LocalSnapshot {
  assessments: Assessment[];
  variantUsage: VariantUsage;
  settings: Settings | null;
  counts: { assessments: number; variantUsage: number; settings: number };
}

interface StorageLike {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

function safeReadJson<T>(storage: StorageLike, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function countUsage(usage: VariantUsage): number {
  let total = 0;
  for (const block of Object.values(usage)) {
    if (!block) continue;
    for (const v of Object.values(block)) total += v;
  }
  return total;
}

export function readLocalSnapshot(storage: StorageLike = localStorage): LocalSnapshot | null {
  const map = safeReadJson<Record<string, unknown>>(storage, K_ASSESS, {});
  const usage = safeReadJson<VariantUsage>(storage, K_USAGE, {});
  const settingsRaw = safeReadJson<Settings | null>(storage, K_SETTINGS, null);

  const assessmentEntries = Object.values(map);
  if (assessmentEntries.length === 0 && countUsage(usage) === 0 && settingsRaw === null) {
    return null;
  }

  const assessments = assessmentEntries.map((a) => migrateAssessment(a as Assessment));

  return {
    assessments,
    variantUsage: usage,
    settings: settingsRaw,
    counts: {
      assessments: assessments.length,
      variantUsage: countUsage(usage),
      settings: settingsRaw ? 1 : 0,
    },
  };
}

export function clearLocalSnapshot(storage: StorageLike = localStorage): void {
  storage.removeItem(K_ASSESS);
  storage.removeItem(K_USAGE);
  storage.removeItem(K_SETTINGS);
}
