import { describe, it, expect } from 'vitest';
import { BLOCKS } from '../src/content/blocks';

describe('BLOCKS', () => {
  it('zawiera bloki A,B,C,D,E w tej kolejności', () => {
    expect(BLOCKS.map((b) => b.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
  it('bloki ważone A-D mają wagi 15/30/25/30, E ma 0', () => {
    const w = Object.fromEntries(BLOCKS.map((b) => [b.id, b.weight]));
    expect([w.A, w.B, w.C, w.D, w.E]).toEqual([15, 30, 25, 30, 0]);
  });
  it('każdy blok ma dokładnie 5 poziomów skali', () => {
    for (const b of BLOCKS) expect(b.scale).toHaveLength(5);
  });
  it('A, B, C mają po 3 warianty; każdy wariant ma label i read', () => {
    for (const id of ['A', 'B', 'C']) {
      const b = BLOCKS.find((x) => x.id === id)!;
      expect(b.variants.length).toBe(3);
      for (const v of b.variants) { expect(v.label).toBeTruthy(); expect(v.read).toBeTruthy(); }
    }
  });
  it('E jest oznaczony jako opcjonalny', () => {
    expect(BLOCKS.find((b) => b.id === 'E')!.optional).toBe(true);
  });
});
