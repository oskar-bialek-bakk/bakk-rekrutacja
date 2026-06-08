import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/auth/access-token', () => ({
  getAccessToken: vi.fn(async () => 'fake'),
  forceRefresh: vi.fn(),
}));

import { AzureStore } from '../src/persistence/azure-store';
import { LocalStore } from '../src/persistence/local-store';
import { renderMigrationBanner } from '../src/ui/migration-banner';

class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.get(k) ?? null; }
  setItem(k: string, v: string): void { this.map.set(k, v); }
  removeItem(k: string): void { this.map.delete(k); }
  has(k: string): boolean { return this.map.has(k); }
}

function seed(s: MemStorage): void {
  s.setItem('etap2.assessments', JSON.stringify({
    a1: {
      id: 'a1', schemaVersion: 2,
      candidate: { nameOrId: 'X', date: '2026-06-08', stage1Result: '', stage1Note: '' },
      selectedVariants: {}, deepenAsked: {}, marks: {}, flags: {}, notes: {},
      decision: null, decisionNote: '', askedQuestions: {},
      negotiation: { oczekiwania: '', widelki: '', formaUmowy: '', dostepnosc: '', uwagi: '' },
      timer: { elapsedSec: 0, paused: false, offsetSec: 0 },
      blockTimes: {}, useE: false, useAChart: false,
      createdAt: '2026-06-08T00:00:00Z', updatedAt: '2026-06-08T00:00:00Z',
    },
  }));
  s.setItem('etap2.variantUsage', JSON.stringify({ A: { 0: 2 } }));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('renderMigrationBanner', () => {
  it('returns false when repo is not AzureStore', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const result = renderMigrationBanner(host, {
      repo: new LocalStore(),
      reload: () => undefined,
      storage: new MemStorage(),
    });
    expect(result).toBe(false);
    expect(host.innerHTML).toBe('');
  });

  it('returns false when localStorage is empty', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const result = renderMigrationBanner(host, {
      repo: new AzureStore('https://api.test'),
      reload: () => undefined,
      storage: new MemStorage(),
    });
    expect(result).toBe(false);
  });

  it('renders banner + import button when AzureStore + data present', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const s = new MemStorage();
    seed(s);
    const result = renderMigrationBanner(host, {
      repo: new AzureStore('https://api.test'),
      reload: () => undefined,
      storage: s,
    });
    expect(result).toBe(true);
    expect(host.querySelector('#btn-migrate')).not.toBeNull();
  });

  it('importBulk runs on click, clears storage on confirm', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const s = new MemStorage();
    seed(s);

    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const store = new AzureStore('https://api.test');
    const reload = vi.fn();
    const confirmFn = vi.fn(() => true);

    renderMigrationBanner(host, { repo: store, reload, storage: s, confirmFn });

    const btn = host.querySelector('#btn-migrate') as HTMLButtonElement;
    btn.click();
    // Wait for async importBulk to finish (multiple awaits inside).
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 10));
      if (confirmFn.mock.calls.length > 0) break;
    }

    expect(fetchMock).toHaveBeenCalled();
    expect(confirmFn).toHaveBeenCalled();
    expect(s.has('etap2.assessments')).toBe(false);
    expect(reload).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
