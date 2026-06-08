import type { Settings } from './model';
import type { Repository } from '../persistence/repository';
import { DEFAULT_WEIGHTS } from './weights.config';

export const DEFAULT_SETTINGS: Settings = {
  weights: { ...DEFAULT_WEIGHTS },
  showScoreLive: false,
  includeEInScore: false,
};

function freshDefaults(): Settings {
  return {
    weights: { ...DEFAULT_SETTINGS.weights },
    showScoreLive: DEFAULT_SETTINGS.showScoreLive,
    includeEInScore: DEFAULT_SETTINGS.includeEInScore,
  };
}

/**
 * Laduje ustawienia z repo, scalajac z defaultami (defensive merge).
 * Brakujace pola wypelnia z DEFAULT_SETTINGS. Niepoprawne wartosci (np. ujemne wagi)
 * NIE sa tu walidowane: walidacja po stronie UI/zapisu.
 */
export async function loadSettings(repo: Repository): Promise<Settings> {
  const s = await repo.getSettings();
  if (s === null) {
    return freshDefaults();
  }
  return {
    weights: { ...DEFAULT_SETTINGS.weights, ...(s.weights ?? {}) },
    showScoreLive: s.showScoreLive ?? DEFAULT_SETTINGS.showScoreLive,
    includeEInScore: s.includeEInScore ?? DEFAULT_SETTINGS.includeEInScore,
  };
}
