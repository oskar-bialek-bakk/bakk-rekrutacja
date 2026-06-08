import { session } from '../state';
import { parseTargetSec, tickBlock, warnLevel, pauseTimer, resumeTimer, adjustOffset } from '../domain/timer';
import { activeBlocks } from './screen-assess';
import { BLOCKS } from '../content/blocks';

let intervalId: number | null = null;
let lastWallMs = 0;

export function startTimer(): void {
  lastWallMs = Date.now();
  const clock = document.getElementById('clock');
  if (clock) clock.style.visibility = 'visible';
  if (intervalId != null) clearInterval(intervalId);
  intervalId = window.setInterval(tick, 1000);
  bindTimerControls();
  syncPauseDom();
  tick();
}

export function stopTimer(): void {
  if (intervalId != null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  const clock = document.getElementById('clock');
  if (clock) clock.style.visibility = 'hidden';
}

/**
 * Dolewa deltaSec do bloku aktywnego (session.cur w activeBlocks).
 * Defensywne: no-op gdy brak session.current, paused, lub delta ≤ 0.
 */
export function tickActiveBlock(deltaSec: number): void {
  const a = session.current;
  if (!a) return;
  if (a.timer.paused) return;
  if (!Number.isFinite(deltaSec) || deltaSec <= 0) return;
  const blocks = activeBlocks();
  const idx = Math.max(0, Math.min(session.cur, blocks.length - 1));
  const block = blocks[idx];
  if (!block) return;
  a.blockTimes = tickBlock(a.blockTimes, block.id, deltaSec);
}

function updateBlockChipDom(blockId: string): void {
  const a = session.current;
  if (!a) return;
  const chip = document.querySelector<HTMLElement>(`[data-block-time="${blockId}"]`);
  if (!chip) return;
  const spent = a.blockTimes[blockId as keyof typeof a.blockTimes]?.spentSec ?? 0;
  chip.textContent = `${String(Math.floor(spent / 60)).padStart(2, '0')}:${String(spent % 60).padStart(2, '0')}`;
  const step = chip.closest<HTMLElement>('.step');
  if (!step) return;
  const blockDef = BLOCKS.find((b) => b.id === blockId);
  if (!blockDef) return;
  const level = warnLevel(spent, parseTargetSec(blockDef.time));
  step.classList.toggle('warn', level === 'warn');
  step.classList.toggle('over', level === 'over');
}

function renderClock(s: number): void {
  const el = document.getElementById('elapsed');
  if (el) el.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const t = document.getElementById('timer');
  if (t) { t.classList.toggle('warn', s >= 45 * 60 && s < 55 * 60); t.classList.toggle('over', s >= 55 * 60); }
}

function tick(): void {
  if (!session.current) return;
  const now = Date.now();
  const wallDeltaSec = Math.floor((now - lastWallMs) / 1000);
  if (session.current.timer.paused) {
    lastWallMs = now;
    renderClock(session.current.timer.elapsedSec);
    return;
  }
  if (wallDeltaSec > 0) {
    lastWallMs += wallDeltaSec * 1000;
    session.current.timer.elapsedSec += wallDeltaSec;
    if (session.screen === 'assess') {
      const blocks = activeBlocks();
      const idx = Math.max(0, Math.min(session.cur, blocks.length - 1));
      const block = blocks[idx];
      if (block) {
        session.current.blockTimes = tickBlock(session.current.blockTimes, block.id, wallDeltaSec);
        updateBlockChipDom(block.id);
      }
    }
  }
  renderClock(session.current.timer.elapsedSec);
}

/**
 * Przelacza pauza/wznow zegara globalnego. Wstrzymuje tez per-blok (tick wie o paused).
 */
export function togglePause(): void {
  const a = session.current;
  if (!a) return;
  a.timer = a.timer.paused ? resumeTimer(a.timer) : pauseTimer(a.timer);
  if (!a.timer.paused) lastWallMs = Date.now();
  syncPauseDom();
}

/**
 * Recznie przewija zegar globalny o deltaSec (np. +60/-60). Aktualizuje natychmiast elapsedSec.
 */
export function nudgeOffset(deltaSec: number): void {
  const a = session.current;
  if (!a) return;
  const before = a.timer.offsetSec;
  a.timer = adjustOffset(a.timer, deltaSec);
  const effective = a.timer.offsetSec - before;
  a.timer.elapsedSec = Math.max(0, a.timer.elapsedSec + effective);
  renderClock(a.timer.elapsedSec);
}

function syncPauseDom(): void {
  const a = session.current;
  if (!a) return;
  const t = document.getElementById('timer');
  if (t) t.classList.toggle('paused', a.timer.paused);
  const btn = document.getElementById('btn-pause');
  if (btn) {
    btn.setAttribute('aria-pressed', a.timer.paused ? 'true' : 'false');
    btn.textContent = a.timer.paused ? '▶' : '⏸';
    btn.setAttribute('title', a.timer.paused ? 'Wznow odliczanie' : 'Pauza odliczania');
  }
}

let controlsBound = false;
function bindTimerControls(): void {
  if (controlsBound) return;
  const btnPause = document.getElementById('btn-pause');
  const btnPlus = document.getElementById('btn-nudge-plus');
  const btnMinus = document.getElementById('btn-nudge-minus');
  if (btnPause) btnPause.addEventListener('click', () => togglePause());
  if (btnPlus) btnPlus.addEventListener('click', () => nudgeOffset(60));
  if (btnMinus) btnMinus.addEventListener('click', () => nudgeOffset(-60));
  if (btnPause || btnPlus || btnMinus) controlsBound = true;
}

export function elapsedStr(): string {
  const s = session.current?.timer.elapsedSec ?? 0;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
