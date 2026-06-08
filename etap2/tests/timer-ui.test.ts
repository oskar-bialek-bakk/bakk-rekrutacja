import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyAssessment } from '../src/domain/model';
import { session } from '../src/state';
import { tickActiveBlock } from '../src/ui/timer-ui';

describe('tickActiveBlock', () => {
  beforeEach(() => {
    session.current = createEmptyAssessment('t1', {
      nameOrId: 'X', date: '2026-01-01', stage1Result: '', stage1Note: '',
    });
    session.cur = 0;
    session.screen = 'assess';
    session.current.useE = false;
  });

  it('dolewa delta do bloku aktywnego (cur=1 → B)', () => {
    session.cur = 1;
    tickActiveBlock(3);
    expect(session.current!.blockTimes.B?.spentSec).toBe(3);
    expect(session.current!.blockTimes.A).toBeUndefined();
  });

  it('akumuluje kolejne ticki', () => {
    session.cur = 0;
    tickActiveBlock(1);
    tickActiveBlock(2);
    expect(session.current!.blockTimes.A?.spentSec).toBe(3);
  });

  it('nie inkrementuje gdy timer.paused', () => {
    session.cur = 0;
    session.current!.timer.paused = true;
    tickActiveBlock(5);
    expect(session.current!.blockTimes.A).toBeUndefined();
  });

  it('nie inkrementuje gdy session.current jest null', () => {
    session.current = null;
    expect(() => tickActiveBlock(1)).not.toThrow();
  });

  it('nie inkrementuje gdy delta ≤ 0', () => {
    session.cur = 0;
    tickActiveBlock(0);
    tickActiveBlock(-5);
    expect(session.current!.blockTimes.A).toBeUndefined();
  });
});
