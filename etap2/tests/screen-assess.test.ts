import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyAssessment } from '../src/domain/model';
import { renderAssess } from '../src/ui/screen-assess';
import { repo, session, reloadSettings } from '../src/state';
import { DEFAULT_SETTINGS } from '../src/domain/settings';

async function setShowLive(value: boolean): Promise<void> {
  await repo.saveSettings({
    weights: { ...DEFAULT_SETTINGS.weights },
    showScoreLive: value,
    includeEInScore: false,
  });
  await reloadSettings();
}

function mount(): HTMLElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  renderAssess(host);
  return host;
}

describe('renderAssess - live score widget', () => {
  beforeEach(async () => {
    localStorage.clear();
    document.body.innerHTML = '';
    session.current = createEmptyAssessment('a1', {
      nameOrId: 'K', date: '2026-01-01', stage1Result: '', stage1Note: '',
    });
    session.cur = 0;
    session.screen = 'assess';
    session.visited = new Set();
    session.editing = false;
    session.detailId = null;
    session.current.useE = false;
    await reloadSettings();
  });

  it('domyslnie (showScoreLive=false) pokazuje .hidden-note, brak .live-score', () => {
    const host = mount();
    expect(host.querySelector('.hidden-note')).not.toBeNull();
    expect(host.querySelector('.live-score')).toBeNull();
    expect(host.querySelector('.step-score')).toBeNull();
  });

  it('po wlaczeniu showScoreLive=true pokazuje .live-score z aktualnym wynikiem', async () => {
    session.current!.marks.A = 4;
    session.current!.marks.B = 3;
    await setShowLive(true);
    const host = mount();
    const live = host.querySelector<HTMLElement>('.live-score');
    expect(live).not.toBeNull();
    expect(host.querySelector('.hidden-note')).toBeNull();
    expect(live!.textContent).toContain('Wynik na żywo');
    // DEFAULT_WEIGHTS A=15 B=30: num=15*4+30*3=150, den=15*5+30*5=225 -> 67
    expect(live!.textContent).toContain('67');
    expect(live!.textContent).toContain('2/4');
    expect(live!.getAttribute('aria-live')).toBe('polite');
  });

  it('per-block badge .step-score widoczny dla ocenionych blokow gdy showScoreLive=true', async () => {
    session.current!.marks.A = 5;
    session.current!.marks.C = 2;
    await setShowLive(true);
    const host = mount();
    const steps = Array.from(host.querySelectorAll<HTMLElement>('.step'));
    const scoresPerStep = steps.map((s) => s.querySelector<HTMLElement>('.step-score')?.textContent ?? null);
    // BLOCKS order with useE=false: A, B, C, D
    expect(scoresPerStep[0]).toBe('5/5');
    expect(scoresPerStep[1]).toBeNull();
    expect(scoresPerStep[2]).toBe('2/5');
    expect(scoresPerStep[3]).toBeNull();
  });

  it('per-block badge nie pojawia sie gdy showScoreLive=false (nawet z marks)', async () => {
    session.current!.marks.A = 4;
    await setShowLive(false);
    const host = mount();
    expect(host.querySelector('.step-score')).toBeNull();
  });
});
