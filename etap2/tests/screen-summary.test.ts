import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyAssessment } from '../src/domain/model';
import { repo, session, reloadSettings } from '../src/state';
import { renderSummary } from '../src/ui/screen-summary';

const K_SETTINGS = 'etap2.settings';

function setupAssessment(marks: { A: number; B: number; C: number; D: number }): void {
  session.current = createEmptyAssessment('s1', {
    nameOrId: 'Kandydat Testowy',
    date: '2026-06-08',
    stage1Result: '',
    stage1Note: '',
  });
  session.current.useE = false;
  session.current.marks.A = marks.A as 1 | 2 | 3 | 4 | 5;
  session.current.marks.B = marks.B as 1 | 2 | 3 | 4 | 5;
  session.current.marks.C = marks.C as 1 | 2 | 3 | 4 | 5;
  session.current.marks.D = marks.D as 1 | 2 | 3 | 4 | 5;
}

async function mount(): Promise<HTMLElement> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  renderSummary(host);
  return host;
}

describe('renderSummary - integracja ze settings.weights', () => {
  beforeEach(async () => {
    localStorage.clear();
    document.body.innerHTML = '';
    await reloadSettings();
    // Wyczyść persystencję ocen (LocalStore) aby zapis nie wpływał na inne testy.
    const all = await repo.findAll();
    for (const a of all) await repo.delete(a.id);
  });

  it('przy domyślnych settings liczy wynik z domyślnych wag (A=5,B=5,C=5,D=5 → 100)', async () => {
    setupAssessment({ A: 5, B: 5, C: 5, D: 5 });
    const host = await mount();
    const scoreEl = host.querySelector('.scorebig .val b');
    expect(scoreEl?.textContent).toBe('100');
  });

  it('po nadpisaniu settings.weights w localStorage liczy wynik z tych wag (A=100 → 60 przy A=3)', async () => {
    localStorage.setItem(
      K_SETTINGS,
      JSON.stringify({
        weights: { A: 100, B: 0, C: 0, D: 0, E: 0 },
        showScoreLive: false,
        includeEInScore: false,
      }),
    );
    await reloadSettings();
    setupAssessment({ A: 3, B: 5, C: 5, D: 5 });
    const host = await mount();
    const scoreEl = host.querySelector('.scorebig .val b');
    expect(scoreEl?.textContent).toBe('60');
  });
});
