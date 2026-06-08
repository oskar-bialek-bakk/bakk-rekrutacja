import { describe, it, expect } from 'vitest';
import { blockState } from '../src/domain/block-state';
import { createEmptyAssessment } from '../src/domain/model';
import type { Assessment, BlockId } from '../src/domain/model';

function fresh(): Assessment {
  return createEmptyAssessment('id-1', {
    nameOrId: 'X',
    date: '2026-06-08',
    stage1Result: '',
    stage1Note: '',
  });
}

describe('blockState', () => {
  it('done gdy ocena ustawiona (wygrywa nad visited i partial input)', () => {
    const a = fresh();
    a.marks.A = 3;
    a.notes.A = 'jakaś notatka';
    a.deepenAsked.A = true;
    const visited = new Set<BlockId>(['A']);
    expect(blockState(a, 'A', visited)).toBe('done');
  });

  it('todo gdy nietknięty i nieodwiedzony', () => {
    const a = fresh();
    expect(blockState(a, 'A', new Set<BlockId>())).toBe('todo');
  });

  it('inProgress gdy odwiedzony, ale bez oceny i bez wpisów', () => {
    const a = fresh();
    expect(blockState(a, 'A', new Set<BlockId>(['A']))).toBe('inProgress');
  });

  it('inProgress z notatki (nieodwiedzony, bez oceny)', () => {
    const a = fresh();
    a.notes.A = 'konkretna obserwacja';
    expect(blockState(a, 'A', new Set<BlockId>())).toBe('inProgress');
  });

  it('inProgress z czerwonej flagi (nieodwiedzony, bez oceny)', () => {
    const a = fresh();
    a.flags.A = { red: true, green: false };
    expect(blockState(a, 'A', new Set<BlockId>())).toBe('inProgress');
  });

  it('inProgress z zielonej flagi (nieodwiedzony, bez oceny)', () => {
    const a = fresh();
    a.flags.A = { red: false, green: true };
    expect(blockState(a, 'A', new Set<BlockId>())).toBe('inProgress');
  });

  it('inProgress z deepenAsked (nieodwiedzony, bez oceny)', () => {
    const a = fresh();
    a.deepenAsked.A = true;
    expect(blockState(a, 'A', new Set<BlockId>())).toBe('inProgress');
  });

  it('inProgress z zadanego pytania (nieodwiedzony, bez oceny)', () => {
    const a = fresh();
    a.askedQuestions.A = { 0: false, 1: true };
    expect(blockState(a, 'A', new Set<BlockId>())).toBe('inProgress');
  });

  it('notatka z samych białych znaków nie liczy się jako partial input (zostaje todo)', () => {
    const a = fresh();
    a.notes.A = '   \n \t ';
    expect(blockState(a, 'A', new Set<BlockId>())).toBe('todo');
  });

  it('askedQuestions z samymi false nie liczy się jako partial input (zostaje todo)', () => {
    const a = fresh();
    a.askedQuestions.A = { 0: false, 1: false };
    expect(blockState(a, 'A', new Set<BlockId>())).toBe('todo');
  });

  it('flaga z red i green false nie liczy się jako partial input (zostaje todo)', () => {
    const a = fresh();
    a.flags.A = { red: false, green: false };
    expect(blockState(a, 'A', new Set<BlockId>())).toBe('todo');
  });

  it('nie mutuje assessment ani zbioru visited', () => {
    const a = fresh();
    a.notes.A = 'x';
    const aSnapshot = JSON.stringify(a);
    const visited = new Set<BlockId>(['B']);
    const visitedSnapshot = [...visited];
    blockState(a, 'A', visited);
    expect(JSON.stringify(a)).toEqual(aSnapshot);
    expect([...visited]).toEqual(visitedSnapshot);
  });
});
