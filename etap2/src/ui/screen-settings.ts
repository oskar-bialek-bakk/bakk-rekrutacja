import type { BlockId, Settings, Weights } from '../domain/model';
import { DEFAULT_SETTINGS } from '../domain/settings';
import { repo, settings, reloadSettings } from '../state';
import { navigate } from '../app';

const WEIGHT_KEYS: ReadonlyArray<BlockId> = ['A', 'B', 'C', 'D', 'E'];

function parseWeight(value: string): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

function readWeights(host: HTMLElement): Weights {
  const result: Weights = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const k of WEIGHT_KEYS) {
    const input = host.querySelector<HTMLInputElement>(`#weight-${k.toLowerCase()}`);
    if (input) result[k] = parseWeight(input.value);
  }
  return result;
}

function writeWeights(host: HTMLElement, w: Weights): void {
  for (const k of WEIGHT_KEYS) {
    const input = host.querySelector<HTMLInputElement>(`#weight-${k.toLowerCase()}`);
    if (input) input.value = String(w[k]);
  }
}

function updateSumDisplay(host: HTMLElement): void {
  const w = readWeights(host);
  const sum = w.A + w.B + w.C + w.D;
  const el = host.querySelector<HTMLSpanElement>('#weights-sum');
  if (!el) return;
  el.textContent = String(sum);
  const wrap = host.querySelector<HTMLDivElement>('#weights-sum-wrap');
  if (wrap) {
    wrap.classList.remove('ok', 'err');
    wrap.classList.add(sum === 100 ? 'ok' : 'err');
  }
}

export async function renderSettings(host: HTMLElement): Promise<void> {
  const s: Settings = settings;
  const weightField = (id: BlockId, label: string) => `
    <label class="weight-cell">
      <span class="weight-cell-label">${label}</span>
      <input type="number" id="weight-${id.toLowerCase()}" min="0" max="100" step="1" value="${s.weights[id]}" inputmode="numeric">
    </label>`;

  host.innerHTML = `
    <div class="card">
      <div class="card-head"><h2>Ustawienia</h2></div>
      <div class="card-body">
        <section class="settings-grid">
          <h3>Wagi bloków (A-D muszą sumować się do 100)</h3>
          <div class="weights-row">
            ${weightField('A', 'A')}
            ${weightField('B', 'B')}
            ${weightField('C', 'C')}
            ${weightField('D', 'D')}
            ${weightField('E', 'E (dodatkowo)')}
          </div>
          <div class="weights-sum-wrap" id="weights-sum-wrap">
            Suma A-D: <span id="weights-sum">0</span> / 100
          </div>
          <div id="settings-error" class="settings-error" role="alert" hidden></div>

          <h3>Opcje wyniku</h3>
          <label class="settings-toggle">
            <input type="checkbox" id="opt-include-e"${s.includeEInScore ? ' checked' : ''}>
            <span>Wlicz blok E do wyniku końcowego</span>
          </label>
          <label class="settings-toggle">
            <input type="checkbox" id="opt-show-live"${s.showScoreLive ? ' checked' : ''}>
            <span>Pokaż punkty na żywo w ocenie</span>
          </label>
        </section>

        <div id="settings-toast" class="toast-ok" role="status" aria-live="polite" hidden></div>

        <div class="settings-actions">
          <button type="button" class="btn primary" id="settings-save">Zapisz</button>
          <button type="button" class="btn ghost" id="settings-reset">Reset do domyślnych</button>
          <button type="button" class="btn ghost" id="settings-back">&larr; Wróć</button>
        </div>
      </div>
    </div>`;

  updateSumDisplay(host);

  WEIGHT_KEYS.forEach((k) => {
    const input = host.querySelector<HTMLInputElement>(`#weight-${k.toLowerCase()}`);
    input?.addEventListener('input', () => updateSumDisplay(host));
  });

  const errorEl = host.querySelector<HTMLDivElement>('#settings-error');
  const toastEl = host.querySelector<HTMLDivElement>('#settings-toast');

  const showError = (msg: string) => {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.hidden = false;
  };
  const clearError = () => {
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.hidden = true;
  };
  const showToast = (msg: string) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
  };

  host.querySelector<HTMLButtonElement>('#settings-save')!.onclick = async () => {
    clearError();
    const weights = readWeights(host);
    const sumABCD = weights.A + weights.B + weights.C + weights.D;
    if (sumABCD !== 100) {
      showError(`Suma wag A-D musi wynosić 100. Aktualnie: ${sumABCD}.`);
      return;
    }
    const includeE = host.querySelector<HTMLInputElement>('#opt-include-e')?.checked ?? false;
    const showLive = host.querySelector<HTMLInputElement>('#opt-show-live')?.checked ?? false;
    const next: Settings = {
      weights,
      includeEInScore: includeE,
      showScoreLive: showLive,
    };
    try {
      await repo.saveSettings(next);
      await reloadSettings();
      showToast('Zapisano.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'nieznany błąd.';
      showError(`Błąd zapisu: ${message}`);
    }
  };

  host.querySelector<HTMLButtonElement>('#settings-reset')!.onclick = () => {
    clearError();
    writeWeights(host, DEFAULT_SETTINGS.weights);
    const inc = host.querySelector<HTMLInputElement>('#opt-include-e');
    if (inc) inc.checked = DEFAULT_SETTINGS.includeEInScore;
    const live = host.querySelector<HTMLInputElement>('#opt-show-live');
    if (live) live.checked = DEFAULT_SETTINGS.showScoreLive;
    updateSumDisplay(host);
    if (toastEl) {
      toastEl.hidden = true;
      toastEl.textContent = '';
    }
  };

  host.querySelector<HTMLButtonElement>('#settings-back')!.onclick = () => {
    navigate('roster');
  };
}
