import type { Session } from './state';
import { session } from './state';
import { renderStart } from './ui/screen-start';
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

export function render(): void {
  const host = document.getElementById('app')!;
  host.innerHTML = '';
  switch (session.screen) {
    case 'start': void renderStart(host); break;
    case 'assess': renderAssess(host); break;
    case 'summary': renderSummary(host); break;
    case 'roster': void renderRoster(host); break;
    case 'detail': void renderDetail(host); break;
    case 'settings': void renderSettings(host); break;
  }
}
