import type { Session } from './state';
import { session } from './state';
import { renderStart } from './ui/screen-start';
import { renderAssess } from './ui/screen-assess';
import { renderSummary } from './ui/screen-summary';
import { renderRoster } from './ui/screen-roster';

export function navigate(screen: Session['screen']): void {
  session.screen = screen;
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
  }
}
