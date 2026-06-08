import type { Assessment, BlockId, Settings } from './domain/model';
import { AzureStore } from './persistence/azure-store';
import { LocalStore } from './persistence/local-store';
import type { Repository } from './persistence/repository';
import { DEFAULT_SETTINGS, loadSettings } from './domain/settings';

function createRepo(): Repository {
  const persistence = (import.meta as unknown as { env?: { VITE_PERSISTENCE?: string } }).env?.VITE_PERSISTENCE;
  if (persistence === 'azure') return new AzureStore();
  return new LocalStore();
}

export const repo: Repository = createRepo();

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
