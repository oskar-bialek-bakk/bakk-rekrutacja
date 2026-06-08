import { describe, it, expect } from 'vitest';
import { DEFAULT_WEIGHTS } from '../src/domain/weights.config';

describe('DEFAULT_WEIGHTS', () => {
  it('A+B+C+D = 100, E = 0', () => {
    const { A, B, C, D, E } = DEFAULT_WEIGHTS;
    expect(A + B + C + D).toBe(100);
    expect(E).toBe(0);
    expect([A, B, C, D]).toEqual([15, 30, 25, 30]);
  });
});
