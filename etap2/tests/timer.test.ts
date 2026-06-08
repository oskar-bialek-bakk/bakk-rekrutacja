import { describe, it, expect } from 'vitest';
import { parseTargetSec, warnLevel, tickBlock, totalSpentSec, pauseTimer, resumeTimer, adjustOffset } from '../src/domain/timer';
import type { BlockTimes } from '../src/domain/timer';
import type { TimerState } from '../src/domain/model';

describe('parseTargetSec', () => {
  it('parsuje minuty', () => {
    expect(parseTargetSec('5 min')).toBe(300);
    expect(parseTargetSec('10 min')).toBe(600);
  });
  it('parsuje sekundy', () => {
    expect(parseTargetSec('30 s')).toBe(30);
  });
  it('parsuje godziny', () => {
    expect(parseTargetSec('1 h')).toBe(3600);
  });
  it('akceptuje wielkosc liter i spacje', () => {
    expect(parseTargetSec('  5 MIN  ')).toBe(300);
    expect(parseTargetSec('2H')).toBe(7200);
  });
  it('zwraca null dla nieparsowalnych', () => {
    expect(parseTargetSec('abc')).toBeNull();
    expect(parseTargetSec('')).toBeNull();
  });
});

describe('warnLevel', () => {
  it("poniżej target → 'ok'", () => {
    expect(warnLevel(100, 300)).toBe('ok');
  });
  it("równo target → 'warn'", () => {
    expect(warnLevel(300, 300)).toBe('warn');
  });
  it("target+1s → 'warn'", () => {
    expect(warnLevel(301, 300)).toBe('warn');
  });
  it("1.2*target → 'over'", () => {
    expect(warnLevel(360, 300)).toBe('over');
  });
  it("targetSec=null → 'ok'", () => {
    expect(warnLevel(99999, null)).toBe('ok');
  });
  it("targetSec=0 → 'ok'", () => {
    expect(warnLevel(99999, 0)).toBe('ok');
  });
});

describe('tickBlock', () => {
  it('pusty obiekt + 10s dla A', () => {
    const next = tickBlock({}, 'A', 10);
    expect(next).toEqual({ A: { spentSec: 10 } });
  });
  it('dolewanie 5s → 15s', () => {
    const prev: BlockTimes = { A: { spentSec: 10 } };
    const next = tickBlock(prev, 'A', 5);
    expect(next.A?.spentSec).toBe(15);
  });
  it('immutability: wejście nietknięte', () => {
    const prev: BlockTimes = { A: { spentSec: 10 } };
    const next = tickBlock(prev, 'A', 5);
    expect(next).not.toBe(prev);
    expect(prev.A?.spentSec).toBe(10);
  });
  it('delta < 0 ignorowane (brak ujemnych)', () => {
    const prev: BlockTimes = { A: { spentSec: 10 } };
    const next = tickBlock(prev, 'A', -3);
    expect(next.A?.spentSec).toBe(10);
  });
});

describe('totalSpentSec', () => {
  it('pusty → 0', () => {
    expect(totalSpentSec({})).toBe(0);
  });
  it('{ A: 10, B: 20 } → 30', () => {
    expect(totalSpentSec({ A: { spentSec: 10 }, B: { spentSec: 20 } })).toBe(30);
  });
});

describe('pauseTimer / resumeTimer', () => {
  const base: TimerState = { elapsedSec: 42, paused: false, offsetSec: 0 };
  it('pauseTimer ustawia paused=true i nie mutuje wejscia', () => {
    const next = pauseTimer(base);
    expect(next.paused).toBe(true);
    expect(next).not.toBe(base);
    expect(base.paused).toBe(false);
    expect(next.elapsedSec).toBe(42);
    expect(next.offsetSec).toBe(0);
  });
  it('resumeTimer ustawia paused=false i nie mutuje wejscia', () => {
    const paused: TimerState = { elapsedSec: 42, paused: true, offsetSec: 0 };
    const next = resumeTimer(paused);
    expect(next.paused).toBe(false);
    expect(next).not.toBe(paused);
    expect(paused.paused).toBe(true);
  });
});

describe('adjustOffset', () => {
  it('+60 zwieksza offsetSec o 60', () => {
    const t: TimerState = { elapsedSec: 100, paused: false, offsetSec: 0 };
    const next = adjustOffset(t, 60);
    expect(next.offsetSec).toBe(60);
    expect(next).not.toBe(t);
    expect(t.offsetSec).toBe(0);
  });
  it('-60 zmniejsza offsetSec o 60 gdy elapsedSec wystarczajacy', () => {
    const t: TimerState = { elapsedSec: 100, paused: false, offsetSec: 30 };
    const next = adjustOffset(t, -60);
    expect(next.offsetSec).toBe(-30);
  });
  it('clamp: elapsedSec=10, offsetSec=0, delta=-30 → offsetSec=-10', () => {
    const t: TimerState = { elapsedSec: 10, paused: false, offsetSec: 0 };
    const next = adjustOffset(t, -30);
    expect(next.offsetSec).toBe(-10);
  });
  it('clamp: elapsedSec=0, delta=-60 → offsetSec niezmieniony', () => {
    const t: TimerState = { elapsedSec: 0, paused: false, offsetSec: 5 };
    const next = adjustOffset(t, -60);
    expect(next.offsetSec).toBe(5);
  });
  it('delta=0 zwraca kopie bez zmian', () => {
    const t: TimerState = { elapsedSec: 10, paused: false, offsetSec: 7 };
    const next = adjustOffset(t, 0);
    expect(next).not.toBe(t);
    expect(next.offsetSec).toBe(7);
  });
});
