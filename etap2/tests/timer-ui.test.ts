import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyAssessment } from '../src/domain/model';
import { session } from '../src/state';
import { tickActiveBlock, togglePause, nudgeOffset, maybePhaseBanner } from '../src/ui/timer-ui';

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

describe('togglePause', () => {
  beforeEach(() => {
    session.current = createEmptyAssessment('t-pause', {
      nameOrId: 'Y', date: '2026-01-01', stage1Result: '', stage1Note: '',
    });
    session.cur = 0;
    session.screen = 'assess';
  });

  it('przelacza paused z false na true i z powrotem', () => {
    expect(session.current!.timer.paused).toBe(false);
    togglePause();
    expect(session.current!.timer.paused).toBe(true);
    togglePause();
    expect(session.current!.timer.paused).toBe(false);
  });

  it('no-op gdy session.current null', () => {
    session.current = null;
    expect(() => togglePause()).not.toThrow();
  });
});

describe('nudgeOffset', () => {
  beforeEach(() => {
    session.current = createEmptyAssessment('t-nudge', {
      nameOrId: 'Z', date: '2026-01-01', stage1Result: '', stage1Note: '',
    });
    session.current.timer.elapsedSec = 100;
    session.cur = 0;
    session.screen = 'assess';
  });

  it('+60 zwieksza elapsedSec o 60 i offsetSec o 60', () => {
    nudgeOffset(60);
    expect(session.current!.timer.elapsedSec).toBe(160);
    expect(session.current!.timer.offsetSec).toBe(60);
  });

  it('-60 zmniejsza elapsedSec o 60', () => {
    nudgeOffset(-60);
    expect(session.current!.timer.elapsedSec).toBe(40);
    expect(session.current!.timer.offsetSec).toBe(-60);
  });

  it('clamp: -300 przy elapsedSec=100 → elapsedSec=0, offsetSec=-100', () => {
    nudgeOffset(-300);
    expect(session.current!.timer.elapsedSec).toBe(0);
    expect(session.current!.timer.offsetSec).toBe(-100);
  });

  it('no-op gdy session.current null', () => {
    session.current = null;
    expect(() => nudgeOffset(60)).not.toThrow();
  });
});

describe('maybePhaseBanner (sygnal 45 min)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="phase-banner" hidden></div>';
    session.current = createEmptyAssessment('t-phase', {
      nameOrId: 'P', date: '2026-01-01', stage1Result: '', stage1Note: '',
    });
    session.cur = 0;
    session.screen = 'assess';
  });

  it('createEmptyAssessment ustawia phase45Notified na false', () => {
    expect(session.current!.timer.phase45Notified).toBe(false);
  });

  it('przy elapsedSec = 45*60 i flagi false pokazuje baner i ustawia flage', () => {
    session.current!.timer.elapsedSec = 45 * 60;
    maybePhaseBanner();
    const el = document.getElementById('phase-banner')!;
    expect(el.hidden).toBe(false);
    expect(el.textContent).toBe('⏱ Czas przejść do pytań kandydata i negocjacji.');
    expect(session.current!.timer.phase45Notified).toBe(true);
  });

  it('drugie wywolanie nie zmienia tekstu ani flagi (idempotencja)', () => {
    session.current!.timer.elapsedSec = 45 * 60;
    maybePhaseBanner();
    const el = document.getElementById('phase-banner')!;
    const firstText = el.textContent;
    session.current!.timer.elapsedSec = 46 * 60;
    maybePhaseBanner();
    expect(el.textContent).toBe(firstText);
    expect(el.hidden).toBe(false);
    expect(session.current!.timer.phase45Notified).toBe(true);
  });

  it('przy elapsedSec = 30*60 baner pozostaje hidden i flaga nie zmienia sie', () => {
    session.current!.timer.elapsedSec = 30 * 60;
    maybePhaseBanner();
    const el = document.getElementById('phase-banner')!;
    expect(el.hidden).toBe(true);
    expect(session.current!.timer.phase45Notified).toBe(false);
  });
});
