import type { Assessment, BlockId } from './domain/model';
import { LocalStore } from './persistence/local-store';
import type { Repository } from './persistence/repository';

export const repo: Repository = new LocalStore();

export interface Session {
  current: Assessment | null;
  screen: 'start' | 'assess' | 'summary' | 'roster' | 'detail';
  cur: number;
  visited: Set<BlockId>;
  detailId: string | null;
  editing: boolean;
}

export const session: Session = { current: null, screen: 'start', cur: 0, visited: new Set(), detailId: null, editing: false };
