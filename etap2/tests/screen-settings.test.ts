import { describe, it, expect, beforeEach } from 'vitest';
import { renderSettings } from '../src/ui/screen-settings';
import { reloadSettings } from '../src/state';
import { DEFAULT_SETTINGS } from '../src/domain/settings';
import type { Settings } from '../src/domain/model';

const K_SETTINGS = 'etap2.settings';

async function mount(): Promise<HTMLElement> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  await renderSettings(host);
  return host;
}

function setWeights(host: HTMLElement, w: { A: number; B: number; C: number; D: number; E?: number }): void {
  const set = (id: string, v: number) => {
    const el = host.querySelector<HTMLInputElement>(id)!;
    el.value = String(v);
    el.dispatchEvent(new Event('input'));
  };
  set('#weight-a', w.A);
  set('#weight-b', w.B);
  set('#weight-c', w.C);
  set('#weight-d', w.D);
  if (w.E !== undefined) set('#weight-e', w.E);
}

describe('renderSettings', () => {
  beforeEach(async () => {
    localStorage.clear();
    document.body.innerHTML = '';
    await reloadSettings();
  });

  it('renderuje pola wag A-E i checkboxy z domyslnymi wartosciami', async () => {
    const host = await mount();
    expect(host.querySelector<HTMLInputElement>('#weight-a')!.value).toBe(String(DEFAULT_SETTINGS.weights.A));
    expect(host.querySelector<HTMLInputElement>('#weight-b')!.value).toBe(String(DEFAULT_SETTINGS.weights.B));
    expect(host.querySelector<HTMLInputElement>('#weight-c')!.value).toBe(String(DEFAULT_SETTINGS.weights.C));
    expect(host.querySelector<HTMLInputElement>('#weight-d')!.value).toBe(String(DEFAULT_SETTINGS.weights.D));
    expect(host.querySelector<HTMLInputElement>('#weight-e')!.value).toBe(String(DEFAULT_SETTINGS.weights.E));
    expect(host.querySelector<HTMLInputElement>('#opt-include-e')!.checked).toBe(DEFAULT_SETTINGS.includeEInScore);
    expect(host.querySelector<HTMLInputElement>('#opt-show-live')!.checked).toBe(DEFAULT_SETTINGS.showScoreLive);
  });

  it('zapis przy sumie A-D = 100 zapisuje do localStorage', async () => {
    const host = await mount();
    setWeights(host, { A: 50, B: 50, C: 0, D: 0 });
    host.querySelector<HTMLButtonElement>('#settings-save')!.click();
    await new Promise((r) => setTimeout(r, 0));
    const raw = localStorage.getItem(K_SETTINGS);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as Settings;
    expect(stored.weights.A).toBe(50);
    expect(stored.weights.B).toBe(50);
    expect(stored.weights.C).toBe(0);
    expect(stored.weights.D).toBe(0);
  });

  it('zapis przy sumie A-D != 100 pokazuje błąd i nie zapisuje', async () => {
    const host = await mount();
    setWeights(host, { A: 50, B: 40, C: 0, D: 0 });
    host.querySelector<HTMLButtonElement>('#settings-save')!.click();
    await new Promise((r) => setTimeout(r, 0));
    const errorEl = host.querySelector<HTMLDivElement>('#settings-error')!;
    expect(errorEl.hidden).toBe(false);
    expect(errorEl.textContent).toContain('90');
    expect(localStorage.getItem(K_SETTINGS)).toBeNull();
  });

  it('reset przepisuje DEFAULT_SETTINGS do pól', async () => {
    const host = await mount();
    setWeights(host, { A: 10, B: 10, C: 10, D: 10, E: 99 });
    host.querySelector<HTMLInputElement>('#opt-include-e')!.checked = true;
    host.querySelector<HTMLInputElement>('#opt-show-live')!.checked = true;
    host.querySelector<HTMLButtonElement>('#settings-reset')!.click();
    expect(host.querySelector<HTMLInputElement>('#weight-a')!.value).toBe(String(DEFAULT_SETTINGS.weights.A));
    expect(host.querySelector<HTMLInputElement>('#weight-b')!.value).toBe(String(DEFAULT_SETTINGS.weights.B));
    expect(host.querySelector<HTMLInputElement>('#weight-c')!.value).toBe(String(DEFAULT_SETTINGS.weights.C));
    expect(host.querySelector<HTMLInputElement>('#weight-d')!.value).toBe(String(DEFAULT_SETTINGS.weights.D));
    expect(host.querySelector<HTMLInputElement>('#weight-e')!.value).toBe(String(DEFAULT_SETTINGS.weights.E));
    expect(host.querySelector<HTMLInputElement>('#opt-include-e')!.checked).toBe(DEFAULT_SETTINGS.includeEInScore);
    expect(host.querySelector<HTMLInputElement>('#opt-show-live')!.checked).toBe(DEFAULT_SETTINGS.showScoreLive);
  });

  it('toggle includeE i showScoreLive jest zachowany po zapisie', async () => {
    const host = await mount();
    setWeights(host, { A: 25, B: 25, C: 25, D: 25 });
    host.querySelector<HTMLInputElement>('#opt-include-e')!.checked = true;
    host.querySelector<HTMLInputElement>('#opt-show-live')!.checked = true;
    host.querySelector<HTMLButtonElement>('#settings-save')!.click();
    await new Promise((r) => setTimeout(r, 0));
    const stored = JSON.parse(localStorage.getItem(K_SETTINGS)!) as Settings;
    expect(stored.includeEInScore).toBe(true);
    expect(stored.showScoreLive).toBe(true);
  });

  it('licznik sumy ma klase ok przy 100 i err przy innej wartosci', async () => {
    const host = await mount();
    setWeights(host, { A: 25, B: 25, C: 25, D: 25 });
    const wrap = host.querySelector<HTMLDivElement>('#weights-sum-wrap')!;
    expect(wrap.classList.contains('ok')).toBe(true);
    setWeights(host, { A: 25, B: 25, C: 25, D: 20 });
    expect(wrap.classList.contains('err')).toBe(true);
  });
});
