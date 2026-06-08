import type { BlockId, Mark, Weights } from './model';

export interface ScoreResult {
  score: number;
  scoredCount: number;
  totalWeightedBlocks: number;
  profile: Partial<Record<BlockId, number>>;
  complete: boolean;
}

const WEIGHTED_BLOCKS: BlockId[] = ['A', 'B', 'C', 'D'];

export function computeScore(
  marks: Partial<Record<BlockId, Mark>>,
  weights: Weights,
  opts: { includeE?: boolean } = {},
): ScoreResult {
  const blocks: BlockId[] = opts.includeE ? [...WEIGHTED_BLOCKS, 'E'] : WEIGHTED_BLOCKS;
  let num = 0;
  let den = 0;
  let scoredCount = 0;
  const profile: Partial<Record<BlockId, number>> = {};

  for (const b of blocks) {
    const w = weights[b];
    if (w <= 0) continue;
    const m = marks[b];
    if (m == null) continue;
    num += m * w;
    den += 5 * w;
    profile[b] = m;
    scoredCount++;
  }

  const totalWeightedBlocks = blocks.filter((b) => weights[b] > 0).length;
  const score = den > 0 ? Math.round((num / den) * 100) : 0;
  return { score, scoredCount, totalWeightedBlocks, profile, complete: scoredCount === totalWeightedBlocks };
}
