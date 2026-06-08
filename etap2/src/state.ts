import type { Assessment, BlockId } from './domain/model';
import { LocalStore } from './persistence/local-store';
import type { Repository } from './persistence/repository';

export const repo: Repository = new LocalStore();

export interface Session {
  current: Assessment | null;
  screen: 'start' | 'assess' | 'summary' | 'roster';
  cur: number;
  visited: Set<BlockId>;
}

export const session: Session = { current: null, screen: 'start', cur: 0, visited: new Set() };
