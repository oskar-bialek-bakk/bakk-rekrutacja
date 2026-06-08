import type { Weights } from './model';

// Jedyne źródło prawdy dla wag. W Fazie 3 nadpisywalne w ekranie ustawień.
export const DEFAULT_WEIGHTS: Weights = { A: 15, B: 30, C: 25, D: 30, E: 0 };
