import type { Assessment, BlockId } from './model';

export type BlockState = 'done' | 'inProgress' | 'todo';

function hasPartialInput(
  assessment: Pick<Assessment, 'notes' | 'flags' | 'deepenAsked' | 'askedQuestions'>,
  blockId: BlockId,
): boolean {
  if ((assessment.notes[blockId] ?? '').trim() !== '') return true;
  const fl = assessment.flags[blockId];
  if (fl?.red || fl?.green) return true;
  if (assessment.deepenAsked[blockId] === true) return true;
  const asked = assessment.askedQuestions[blockId];
  if (asked && Object.values(asked).some(Boolean)) return true;
  return false;
}

export function blockState(
  assessment: Pick<Assessment, 'marks' | 'notes' | 'flags' | 'deepenAsked' | 'askedQuestions'>,
  blockId: BlockId,
  visited: ReadonlySet<BlockId>,
): BlockState {
  if (assessment.marks[blockId] != null) return 'done';
  if (visited.has(blockId) || hasPartialInput(assessment, blockId)) return 'inProgress';
  return 'todo';
}
