import { describe, it, expect, beforeEach } from 'vitest';
import { session } from '../src/state';
import { flushDraft } from '../src/persistence/crash-guard';
import { readDraft } from '../src/persistence/draft';
import { createEmptyAssessment } from '../src/domain/model';

function newAssessment(id: string) {
  return createEmptyAssessment(id, { nameOrId: 'Kandydat', date: '2026-06-11', stage1Result: '', stage1Note: '' });
}

describe('flushDraft', () => {
  beforeEach(() => {
    localStorage.clear();
    session.current = null;
    session.screen = 'start';
  });

  it('zapisuje bieżącą ocenę na ekranie edycji (assess)', () => {
    session.current = newAssessment('cg1');
    session.screen = 'assess';
    flushDraft();
    expect(readDraft()?.assessment.id).toBe('cg1');
  });

  it('nie zapisuje poza ekranami edycji (np. roster)', () => {
    session.current = newAssessment('cg2');
    session.screen = 'roster';
    flushDraft();
    expect(readDraft()).toBeNull();
  });

  it('nie zapisuje gdy nie ma bieżącej oceny', () => {
    session.current = null;
    session.screen = 'assess';
    flushDraft();
    expect(readDraft()).toBeNull();
  });
});
