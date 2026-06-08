import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings } from '../src/domain/settings';
import type { Repository } from '../src/persistence/repository';
import type { Settings, Assessment, VariantUsage } from '../src/domain/model';

function makeRepo(settings: Settings | null): Repository {
  return {
    findAll: async () => [],
    get: async () => null,
    save: async (_a: Assessment) => { void _a; },
    delete: async (_id: string) => { void _id; },
    getVariantUsage: async () => ({} as VariantUsage),
    saveVariantUsage: async (_u: VariantUsage) => { void _u; },
    getSettings: async () => settings,
    saveSettings: async (_s: Settings) => { void _s; },
  };
}

describe('DEFAULT_SETTINGS', () => {
  it('ma poprawne wagi 15/30/25/30/0 i flagi false', () => {
    expect(DEFAULT_SETTINGS.weights).toEqual({ A: 15, B: 30, C: 25, D: 30, E: 0 });
    expect(DEFAULT_SETTINGS.showScoreLive).toBe(false);
    expect(DEFAULT_SETTINGS.includeEInScore).toBe(false);
  });

  it('wagi A-D sumuja sie do 100', () => {
    const { A, B, C, D } = DEFAULT_SETTINGS.weights;
    expect(A + B + C + D).toBe(100);
  });
});

describe('loadSettings', () => {
  it('null z repo -> DEFAULT_SETTINGS (deep copy)', async () => {
    const result = await loadSettings(makeRepo(null));
    expect(result).toEqual(DEFAULT_SETTINGS);
    result.weights.A = 999;
    expect(DEFAULT_SETTINGS.weights.A).toBe(15);
  });

  it('pelne ustawienia z repo -> zwraca dokladnie te wartosci', async () => {
    const stored: Settings = {
      weights: { A: 50, B: 50, C: 0, D: 0, E: 0 },
      showScoreLive: true,
      includeEInScore: false,
    };
    const result = await loadSettings(makeRepo(stored));
    expect(result).toEqual(stored);
  });

  it('czesciowe ustawienia -> defensive merge z defaultami', async () => {
    const partial = { weights: { A: 20 } } as unknown as Settings;
    const result = await loadSettings(makeRepo(partial));
    expect(result.weights).toEqual({ A: 20, B: 30, C: 25, D: 30, E: 0 });
    expect(result.showScoreLive).toBe(false);
    expect(result.includeEInScore).toBe(false);
  });
});
