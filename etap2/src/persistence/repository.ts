import type { Assessment, VariantUsage, Settings } from '../domain/model';

export interface Repository {
  findAll(): Promise<Assessment[]>;
  get(id: string): Promise<Assessment | null>;
  save(a: Assessment): Promise<void>;
  delete(id: string): Promise<void>;
  getVariantUsage(): Promise<VariantUsage>;
  saveVariantUsage(u: VariantUsage): Promise<void>;
  getSettings(): Promise<Settings | null>;
  saveSettings(s: Settings): Promise<void>;
}
