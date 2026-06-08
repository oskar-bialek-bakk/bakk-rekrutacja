import type { Assessment, BlockId, Settings } from './domain/model';
import { LocalStore } from './persistence/local-store';
import type { Repository } from './persistence/repository';
import { DEFAULT_SETTINGS, loadSettings } from './domain/settings';

export const repo: Repository = new LocalStore();

export interface Session {
  current: Assessment | null;
  screen: 'start' | 'assess' | 'summary' | 'roster' | 'detail' | 'settings';
  cur: number;
  visited: Set<BlockId>;
  detailId: string | null;
  editing: boolean;
}

export const session: Session = { current: null, screen: 'start', cur: 0, visited: new Set(), detailId: null, editing: false };

export let settings: Settings = {
  weights: { ...DEFAULT_SETTINGS.weights },
  showScoreLive: DEFAULT_SETTINGS.showScoreLive,
  includeEInScore: DEFAULT_SETTINGS.includeEInScore,
};

export function getSettings(): Settings {
  return settings;
}

export async function reloadSettings(): Promise<void> {
  settings = await loadSettings(repo);
}
