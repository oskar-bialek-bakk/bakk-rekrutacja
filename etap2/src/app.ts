import type { Session } from './state';
import { session } from './state';
import { renderStart } from './ui/screen-start';
import { renderIntro } from './ui/screen-intro';
import { renderAssess } from './ui/screen-assess';
import { renderSummary } from './ui/screen-summary';
import { renderRoster } from './ui/screen-roster';
import { renderDetail } from './ui/screen-detail';
import { renderSettings } from './ui/screen-settings';

export function navigate(screen: Session['screen']): void {
  if (screen !== 'detail') session.detailId = null;
  session.screen = screen;
  render();
}

export function openDetail(id: string): void {
  session.detailId = id;
  session.screen = 'detail';
  render();
}

const LOADER_HTML = '<div class="app-loader" role="status" aria-live="polite"><div class="app-loader__spinner" aria-hidden="true"></div><div class="app-loader__text">Ładowanie…</div></div>';

function showLoaderThen(host: HTMLElement, asyncRender: (h: HTMLElement) => Promise<void>): void {
  host.innerHTML = LOADER_HTML;
  asyncRender(host).catch((err) => {
    const msg = err instanceof Error ? err.message : 'Nieznany błąd';
    host.innerHTML = `<div class="app-error">Błąd ładowania: ${msg}</div>`;
  });
}

export function render(): void {
  const host = document.getElementById('app')!;
  switch (session.screen) {
    case 'start': showLoaderThen(host, renderStart); break;
    case 'intro': host.innerHTML = ''; renderIntro(host); break;
    case 'assess': host.innerHTML = ''; renderAssess(host); break;
    case 'summary': host.innerHTML = ''; renderSummary(host); break;
    case 'roster': showLoaderThen(host, renderRoster); break;
    case 'detail': showLoaderThen(host, renderDetail); break;
    case 'settings': showLoaderThen(host, renderSettings); break;
  }
}
