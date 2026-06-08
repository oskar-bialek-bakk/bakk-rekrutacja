import type { Assessment, VariantUsage, Settings } from '../domain/model';
import type { Repository } from './repository';
import { migrateAssessment } from './migrations';

const K_ASSESS = 'etap2.assessments';
const K_USAGE = 'etap2.variantUsage';
const K_SETTINGS = 'etap2.settings';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    console.error(`etap2: uszkodzony wpis localStorage pod kluczem ${key}, używam wartości domyślnej`);
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export class LocalStore implements Repository {
  async findAll(): Promise<Assessment[]> {
    const map = readJSON<Record<string, any>>(K_ASSESS, {});
    return Object.values(map).map(migrateAssessment);
  }
  async get(id: string): Promise<Assessment | null> {
    const map = readJSON<Record<string, any>>(K_ASSESS, {});
    return map[id] ? migrateAssessment(map[id]) : null;
  }
  async save(a: Assessment): Promise<void> {
    const map = readJSON<Record<string, any>>(K_ASSESS, {});
    writeJSON(K_ASSESS, { ...map, [a.id]: { ...a, updatedAt: new Date().toISOString() } });
  }
  async delete(id: string): Promise<void> {
    const map = readJSON<Record<string, any>>(K_ASSESS, {});
    const { [id]: _omit, ...rest } = map;
    writeJSON(K_ASSESS, rest);
  }
  async getVariantUsage(): Promise<VariantUsage> { return readJSON<VariantUsage>(K_USAGE, {}); }
  async saveVariantUsage(u: VariantUsage): Promise<void> { writeJSON(K_USAGE, u); }
  async getSettings(): Promise<Settings | null> { return readJSON<Settings | null>(K_SETTINGS, null); }
  async saveSettings(s: Settings): Promise<void> { writeJSON(K_SETTINGS, s); }
}
