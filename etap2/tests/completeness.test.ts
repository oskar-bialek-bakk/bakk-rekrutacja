import { describe, it, expect } from 'vitest';
import { blocksMissingNotes } from '../src/domain/completeness';
import type { BlockId } from '../src/domain/model';

describe('blocksMissingNotes', () => {
  it('zwraca wszystkie aktywne bloki gdy notatki są puste', () => {
    const active: BlockId[] = ['A', 'B', 'C', 'D'];
    expect(blocksMissingNotes({}, active)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('wyklucza blok z realną notatką, raportuje blok z samymi białymi znakami', () => {
    const active: BlockId[] = ['A', 'B', 'C'];
    const notes = { A: 'konkretna obserwacja', B: '   \n  \t ' };
    expect(blocksMissingNotes(notes, active)).toEqual(['B', 'C']);
  });

  it('bierze pod uwagę tylko aktywne bloki (ignoruje notatkę pod E gdy E nieaktywne)', () => {
    const active: BlockId[] = ['A', 'B', 'C', 'D'];
    const notes = { A: 'x', B: 'y', C: 'z', D: 'w', E: '' };
    expect(blocksMissingNotes(notes, active)).toEqual([]);
  });

  it('uwzględnia E gdy jest aktywne i brak notatki', () => {
    const active: BlockId[] = ['A', 'B', 'C', 'D', 'E'];
    const notes = { A: 'x', B: 'y', C: 'z', D: 'w' };
    expect(blocksMissingNotes(notes, active)).toEqual(['E']);
  });

  it('zachowuje kolejność z activeBlockIds', () => {
    const active: BlockId[] = ['D', 'C', 'B', 'A'];
    expect(blocksMissingNotes({}, active)).toEqual(['D', 'C', 'B', 'A']);
  });

  it('pusta lista activeBlockIds zwraca []', () => {
    expect(blocksMissingNotes({ A: 'x' }, [])).toEqual([]);
  });

  it('nie mutuje obiektu notes', () => {
    const notes = { A: 'x', B: '  ' };
    const snapshot = JSON.stringify(notes);
    blocksMissingNotes(notes, ['A', 'B', 'C']);
    expect(JSON.stringify(notes)).toEqual(snapshot);
  });
});
