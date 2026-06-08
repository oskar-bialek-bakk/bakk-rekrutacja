import { session } from '../state';

let intervalId: number | null = null;
let startMs = 0;

export function startTimer(): void {
  startMs = Date.now();
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

function tick(): void {
  if (!session.current) return;
  const s = Math.floor((Date.now() - startMs) / 1000) + session.current.timer.offsetSec;
  session.current.timer.elapsedSec = s;
  const el = document.getElementById('elapsed');
  if (el) el.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const t = document.getElementById('timer');
  if (t) { t.classList.toggle('warn', s >= 45 * 60 && s < 55 * 60); t.classList.toggle('over', s >= 55 * 60); }
}

export function elapsedStr(): string {
  const s = session.current?.timer.elapsedSec ?? 0;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
