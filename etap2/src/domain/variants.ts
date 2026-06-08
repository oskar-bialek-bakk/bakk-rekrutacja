import type { BlockId, VariantUsage } from './model';

export function pickLeastUsed(usage: VariantUsage, block: BlockId, variantCount: number): number {
  const counts = usage[block] ?? {};
  let bestIdx = 0;
  let bestCount = Infinity;
  for (let i = 0; i < variantCount; i++) {
    const c = counts[i] ?? 0;
    if (c < bestCount) { bestCount = c; bestIdx = i; }
  }
  return bestIdx;
}

export function recordUsage(usage: VariantUsage, block: BlockId, variantIdx: number): VariantUsage {
  const block_counts = { ...(usage[block] ?? {}) };
  block_counts[variantIdx] = (block_counts[variantIdx] ?? 0) + 1;
  return { ...usage, [block]: block_counts };
}

export function recordSelectedVariants(
  usage: VariantUsage,
  selectedVariants: Partial<Record<BlockId, number>>,
  rotatingBlocks: BlockId[],
): VariantUsage {
  return rotatingBlocks.reduce((acc, block) => {
    const variantIdx = selectedVariants[block];
    if (variantIdx === undefined) return acc;
    return recordUsage(acc, block, variantIdx);
  }, usage);
}
