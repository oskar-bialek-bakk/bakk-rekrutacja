import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStore } from '../src/persistence/local-store';
import { createEmptyAssessment } from '../src/domain/model';

beforeEach(() => localStorage.clear());

function sample(id: string) {
  return createEmptyAssessment(id, { nameOrId: 'X', date: '2026-06-08', stage1Result: '', stage1Note: '' });
}

describe('LocalStore', () => {
  it('round-trip: save → get → findAll', async () => {
    const store = new LocalStore();
    await store.save(sample('a'));
    await store.save(sample('b'));
    expect((await store.get('a'))!.id).toBe('a');
    expect((await store.findAll()).map((x) => x.id).sort()).toEqual(['a', 'b']);
  });

  it('delete usuwa rekord', async () => {
    const store = new LocalStore();
    await store.save(sample('a'));
    await store.delete('a');
    expect(await store.get('a')).toBeNull();
  });

  it('uszkodzony storage nie wywala findAll', async () => {
    localStorage.setItem('etap2.assessments', '{ to nie jest json');
    const store = new LocalStore();
    expect(await store.findAll()).toEqual([]);
  });

  it('VariantUsage round-trip', async () => {
    const store = new LocalStore();
    await store.saveVariantUsage({ A: { 0: 2 } });
    expect((await store.getVariantUsage()).A![0]).toBe(2);
  });

  it('Settings round-trip', async () => {
    const store = new LocalStore();
    await store.saveSettings({ weights: { A: 1, B: 1, C: 1, D: 1, E: 0 }, showScoreLive: true, includeEInScore: false });
    expect((await store.getSettings())!.showScoreLive).toBe(true);
  });
});
