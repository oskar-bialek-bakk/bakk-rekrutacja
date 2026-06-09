import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Assessment, Settings, VariantUsage } from '../src/domain/model';

vi.mock('../src/auth/access-token', () => ({
  getAccessToken: vi.fn(async () => 'fake-jwt'),
  forceRefresh: vi.fn(),
}));

import { AzureStore, ApiError } from '../src/persistence/azure-store';
import { forceRefresh, getAccessToken } from '../src/auth/access-token';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  vi.mocked(getAccessToken).mockResolvedValue('fake-jwt');
  vi.mocked(forceRefresh).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResp(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function emptyAssessment(id: string): Assessment {
  return {
    id,
    schemaVersion: 2,
    candidate: { nameOrId: 'X', date: '2026-06-08', stage1Result: '', stage1Note: '' },
    selectedVariants: {},
    deepenAsked: {},
    marks: {},
    flags: {},
    notes: {},
    decision: null,
    decisionNote: '',
    askedQuestions: {},
    negotiation: { oczekiwania: '', widelki: '', formaUmowy: '', dostepnosc: '', uwagi: '' },
    timer: { elapsedSec: 0, paused: false, offsetSec: 0 },
    blockTimes: {},
    useE: false,
    useAChart: false,
    createdAt: '2026-06-08T00:00:00Z',
    updatedAt: '2026-06-08T00:00:00Z',
  };
}

describe('AzureStore', () => {
  it('findAll wywoluje GET /api/v1/assessments?scope=mine z Bearer', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp(200, { assessments: [emptyAssessment('a1')] }));
    const store = new AzureStore('https://api.test');
    const result = await store.findAll();
    expect(result).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/api/v1/assessments?scope=mine',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer fake-jwt' }),
      }),
    );
  });

  it('save robi PUT z body Assessment', async () => {
    const a = emptyAssessment('a1');
    fetchMock.mockResolvedValueOnce(jsonResp(200, a));
    const store = new AzureStore('https://api.test');
    await store.save(a);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/api/v1/assessments/a1');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toMatchObject({ id: 'a1' });
  });

  it('delete tolerates 404 (zwraca void)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp(404, { error: 'Not found' }));
    const store = new AzureStore('https://api.test');
    await expect(store.delete('missing')).resolves.toBeUndefined();
  });

  it('delete propaguje inne bledy jako ApiError', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp(500, { error: 'boom' }));
    const store = new AzureStore('https://api.test');
    await expect(store.delete('a1')).rejects.toBeInstanceOf(ApiError);
  });

  it('401 wymusza forceRefresh + retry raz', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResp(401, { error: 'expired' }))
      .mockResolvedValueOnce(jsonResp(200, { assessments: [] }));
    const store = new AzureStore('https://api.test');
    await store.findAll();
    expect(forceRefresh).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('getVariantUsage mapuje backend counts -> front Record-shape (pomija zera)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp(200, {
      id: 'global',
      scope: 'global',
      counts: { A: [3, 0, 1, 0], B: [0, 0, 0], C: [0, 0, 0, 0, 0], D: [0, 0, 2] },
    }));
    const store = new AzureStore('https://api.test');
    const result = await store.getVariantUsage();
    expect(result).toEqual({ A: { 0: 3, 2: 1 }, D: { 2: 2 } });
  });

  it('getVariantUsage zwraca {} gdy 404', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp(404, { error: 'Not found' }));
    const store = new AzureStore('https://api.test');
    expect(await store.getVariantUsage()).toEqual({});
  });

  it('saveVariantUsage wysyla increment per delta vs cache', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp(200, {
      id: 'global',
      scope: 'global',
      counts: { A: [3, 0, 1, 0], B: [0, 0, 0], C: [0, 0, 0, 0, 0], D: [0, 0, 0] },
    }));
    const store = new AzureStore('https://api.test');
    await store.getVariantUsage(); // load + cache
    fetchMock.mockImplementation(async () => jsonResp(200, {}));
    const next: VariantUsage = { A: { 0: 4, 2: 1 }, D: { 1: 1 } };
    await store.saveVariantUsage(next);
    // expected increments: A[0] +1, D[1] +1
    const incPosts = fetchMock.mock.calls.filter(([url]) => String(url).includes('/variant-usage/increment'));
    const bodies = incPosts.map(([, init]) => JSON.parse(init.body));
    expect(bodies).toEqual(expect.arrayContaining([
      { block: 'A', variantIdx: 0 },
      { block: 'D', variantIdx: 1 },
    ]));
    expect(bodies).toHaveLength(2);
  });

  it('getSettings zwraca null gdy backend zwroci null', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp(200, null));
    const store = new AzureStore('https://api.test');
    expect(await store.getSettings()).toBeNull();
  });

  it('saveSettings wysyla PUT z payload', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp(200, { weights: {}, showScoreLive: false, includeEInScore: false }));
    const store = new AzureStore('https://api.test');
    const s: Settings = {
      weights: { A: 0.2, B: 0.2, C: 0.25, D: 0.35, E: 0 },
      showScoreLive: true,
      includeEInScore: false,
    };
    await store.saveSettings(s);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/api/v1/settings');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toMatchObject(s);
  });
});
