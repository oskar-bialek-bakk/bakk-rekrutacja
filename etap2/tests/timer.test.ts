import { describe, it, expect } from 'vitest';
import { parseTargetSec, warnLevel, tickBlock, totalSpentSec } from '../src/domain/timer';
import type { BlockTimes } from '../src/domain/timer';

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
