import { session } from '../state';
import { parseTargetSec, tickBlock, warnLevel } from '../domain/timer';
import { activeBlocks } from './screen-assess';
import { BLOCKS } from '../content/blocks';

let intervalId: number | null = null;
let startMs = 0;
let prevElapsedSec = 0;

export function startTimer(): void {
  startMs = Date.now();
  prevElapsedSec = session.current?.timer.offsetSec ?? 0;
  const clock = document.getElementById('clock');
  if (clock) clock.style.visibility = 'visible';
  if (intervalId != null) clearInterval(intervalId);
  intervalId = window.setInterval(tick, 1000);
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
 * Wyeksportowane do testów i do użytku z tick().
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

function tick(): void {
  if (!session.current) return;
  const s = Math.floor((Date.now() - startMs) / 1000) + session.current.timer.offsetSec;
  const delta = s - prevElapsedSec;
  prevElapsedSec = s;
  session.current.timer.elapsedSec = s;
  const el = document.getElementById('elapsed');
  if (el) el.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const t = document.getElementById('timer');
  if (t) { t.classList.toggle('warn', s >= 45 * 60 && s < 55 * 60); t.classList.toggle('over', s >= 55 * 60); }
  if (delta > 0 && !session.current.timer.paused && session.screen === 'assess') {
    const blocks = activeBlocks();
    const idx = Math.max(0, Math.min(session.cur, blocks.length - 1));
    const block = blocks[idx];
    if (block) {
      session.current.blockTimes = tickBlock(session.current.blockTimes, block.id, delta);
      updateBlockChipDom(block.id);
    }
  }
}

export function elapsedStr(): string {
  const s = session.current?.timer.elapsedSec ?? 0;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
