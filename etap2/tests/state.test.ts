import { describe, it, expect, beforeEach } from 'vitest';
import { getSettings, reloadSettings } from '../src/state';
import { DEFAULT_SETTINGS } from '../src/domain/settings';

beforeEach(() => localStorage.clear());

describe('state.reloadSettings', () => {
  it('po reload z localStorage uaktualnia eksportowane settings', async () => {
    const stored = {
      weights: { A: 40, B: 20, C: 20, D: 20, E: 0 },
      showScoreLive: true,
      includeEInScore: true,
    };
    localStorage.setItem('etap2.settings', JSON.stringify(stored));
    await reloadSettings();
    const s = getSettings();
    expect(s.weights.A).toBe(40);
    expect(s.showScoreLive).toBe(true);
    expect(s.includeEInScore).toBe(true);
  });

  it('przy pustym storage zwraca DEFAULT_SETTINGS', async () => {
    localStorage.clear();
    await reloadSettings();
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
