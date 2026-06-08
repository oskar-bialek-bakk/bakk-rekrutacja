import type { Assessment } from './domain/model';
import { LocalStore } from './persistence/local-store';
import type { Repository } from './persistence/repository';

export const repo: Repository = new LocalStore();

export interface Session {
  current: Assessment | null;
  screen: 'start' | 'assess' | 'summary' | 'roster';
  cur: number;
}

export const session: Session = { current: null, screen: 'start', cur: 0 };
