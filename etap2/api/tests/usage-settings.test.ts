import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface StoreDoc { id: string; pk: string; data: Record<string, unknown> }
const store: StoreDoc[] = [];

const patchOps: Array<{ op: string; path: string; value: number }> = [];

const variantUsageContainerMock = {
  item: (id: string, pk: string) => ({
    read: vi.fn(async () => {
      const found = store.find((x) => x.id === id && x.pk === pk);
      if (!found) {
        const err: Error & { code?: number } = new Error('NotFound');
        err.code = 404;
        throw err;
      }
      return { resource: found.data };
    }),
    patch: vi.fn(async (ops: Array<{ op: string; path: string; value: number }>) => {
      const found = store.find((x) => x.id === id && x.pk === pk);
      if (!found) {
        const err: Error & { code?: number } = new Error('NotFound');
        err.code = 404;
        throw err;
      }
      patchOps.push(...ops);
      for (const op of ops) {
        if (op.op === 'incr') {
          const segments = op.path.split('/').filter(Boolean);
          let target: Record<string, unknown> = found.data;
          for (let i = 0; i < segments.length - 1; i++) {
            const key = segments[i];
            target = target[key] as Record<string, unknown>;
          }
          const last = segments[segments.length - 1];
          const arr = target as unknown as number[];
          const idx = Number(last);
          if (Array.isArray(arr) && Number.isInteger(idx)) {
            if (idx < 0 || idx >= arr.length) {
              const err: Error & { code?: number } = new Error('Out of range');
              err.code = 412;
              throw err;
            }
            arr[idx] += op.value;
          }
        }
      }
      return { resource: found.data };
    }),
  }),
  items: {
    upsert: vi.fn(),
    create: vi.fn(async (doc: Record<string, unknown>) => {
      const pk = (doc as { scope?: string }).scope ?? 'global';
      const id = doc.id as string;
      if (store.find((x) => x.id === id && x.pk === pk)) {
        const err: Error & { code?: number } = new Error('Conflict');
        err.code = 409;
        throw err;
      }
      store.push({ id, pk, data: doc });
      return { resource: doc };
    }),
  },
};

const settingsContainerMock = {
  item: (id: string, pk: string) => ({
    read: vi.fn(async () => {
      const found = store.find((x) => x.id === id && x.pk === pk);
      if (!found) {
        const err: Error & { code?: number } = new Error('NotFound');
        err.code = 404;
        throw err;
      }
      return { resource: found.data };
    }),
  }),
  items: {
    upsert: vi.fn(async (doc: Record<string, unknown>) => {
      const pk = (doc as { userPrincipalName: string }).userPrincipalName;
      const idx = store.findIndex((x) => x.id === (doc.id as string) && x.pk === pk);
      if (idx >= 0) store[idx] = { id: doc.id as string, pk, data: doc };
      else store.push({ id: doc.id as string, pk, data: doc });
      return { resource: doc };
    }),
  },
};

vi.mock('../src/lib/cosmos.js', () => ({
  variantUsageContainer: () => variantUsageContainerMock,
  settingsContainer: () => settingsContainerMock,
  assessmentsContainer: () => settingsContainerMock,
  pingCosmos: async () => undefined,
  _resetCosmosClient: () => undefined,
}));

function fakeReq(opts: { upn?: string; oid?: string; body?: unknown }) {
  const headers = new Map<string, string>();
  if (opts.upn) headers.set('x-ms-client-principal-name', opts.upn);
  if (opts.oid) headers.set('x-ms-client-principal-id', opts.oid);
  return {
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    query: { get: () => null },
    params: {},
    json: async () => opts.body,
  };
}

const ctx = { error: vi.fn() } as never;

beforeEach(() => {
  store.length = 0;
  patchOps.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('variant-usage', () => {
  it('GET zwraca doc gdy zaseedowany', async () => {
    store.push({
      id: 'global',
      pk: 'global',
      data: {
        id: 'global',
        scope: 'global',
        counts: { A: [0, 0, 0, 0], B: [0, 0, 0], C: [0, 0, 0, 0, 0], D: [0, 0, 0] },
      },
    });
    const { variantUsageGet } = await import('../src/functions/variant-usage-get.js');
    const res = await variantUsageGet(fakeReq({ upn: 'alice@bakk.com', oid: 'oid-a' }) as never, ctx);
    expect(res.status).toBe(200);
    expect((res.jsonBody as { id: string }).id).toBe('global');
  });

  it('GET lazy-seed global gdy nie istnieje, zwraca 200 z zerowymi countsami', async () => {
    const { variantUsageGet } = await import('../src/functions/variant-usage-get.js');
    const res = await variantUsageGet(fakeReq({ upn: 'alice@bakk.com', oid: 'oid-a' }) as never, ctx);
    expect(res.status).toBe(200);
    const body = res.jsonBody as { id: string; counts: { A: number[] } };
    expect(body.id).toBe('global');
    expect(body.counts.A).toEqual([0, 0, 0, 0]);
  });

  it('POST increment dorzuca patch incr na C[2]', async () => {
    store.push({
      id: 'global',
      pk: 'global',
      data: {
        id: 'global',
        scope: 'global',
        counts: { A: [0, 0, 0, 0], B: [0, 0, 0], C: [0, 0, 0, 0, 0], D: [0, 0, 0] },
      },
    });
    const { variantUsageIncrement } = await import('../src/functions/variant-usage-increment.js');
    const res = await variantUsageIncrement(
      fakeReq({ upn: 'alice@bakk.com', oid: 'oid-a', body: { block: 'C', variantIdx: 2 } }) as never,
      ctx
    );
    expect(res.status).toBe(200);
    expect(patchOps).toEqual([{ op: 'incr', path: '/counts/C/2', value: 1 }]);
    expect(((res.jsonBody as { counts: { C: number[] } }).counts.C)[2]).toBe(1);
  });

  it('POST increment z body invalid -> 400', async () => {
    const { variantUsageIncrement } = await import('../src/functions/variant-usage-increment.js');
    const res = await variantUsageIncrement(
      fakeReq({ upn: 'alice@bakk.com', oid: 'oid-a', body: { block: 'X', variantIdx: -1 } }) as never,
      ctx
    );
    expect(res.status).toBe(400);
  });

  it('POST increment bez auth -> 401', async () => {
    const { variantUsageIncrement } = await import('../src/functions/variant-usage-increment.js');
    const res = await variantUsageIncrement(
      fakeReq({ body: { block: 'A', variantIdx: 0 } }) as never,
      ctx
    );
    expect(res.status).toBe(401);
  });
});

describe('settings', () => {
  const validSettings = {
    weights: { A: 0.2, B: 0.2, C: 0.25, D: 0.35, E: 0 },
    showScoreLive: false,
    includeEInScore: false,
  };

  it('GET zwraca null gdy brak per upn', async () => {
    const { settingsGet } = await import('../src/functions/settings-get.js');
    const res = await settingsGet(fakeReq({ upn: 'alice@bakk.com', oid: 'oid-a' }) as never, ctx);
    expect(res.status).toBe(200);
    expect(res.jsonBody).toBeNull();
  });

  it('PUT upsertuje + GET pozniej zwraca', async () => {
    const { settingsPut } = await import('../src/functions/settings-put.js');
    const putRes = await settingsPut(
      fakeReq({ upn: 'alice@bakk.com', oid: 'oid-a', body: validSettings }) as never,
      ctx
    );
    expect(putRes.status).toBe(200);
    expect((putRes.jsonBody as { userPrincipalName: string }).userPrincipalName).toBe('alice@bakk.com');

    const { settingsGet } = await import('../src/functions/settings-get.js');
    const getRes = await settingsGet(fakeReq({ upn: 'alice@bakk.com', oid: 'oid-a' }) as never, ctx);
    expect((getRes.jsonBody as { weights: { A: number } }).weights.A).toBe(0.2);
  });

  it('PUT z payload nie pasujacym do schemy -> 400', async () => {
    const { settingsPut } = await import('../src/functions/settings-put.js');
    const res = await settingsPut(
      fakeReq({ upn: 'alice@bakk.com', oid: 'oid-a', body: { weights: 'broken' } }) as never,
      ctx
    );
    expect(res.status).toBe(400);
  });

  it('PUT bez auth -> 401', async () => {
    const { settingsPut } = await import('../src/functions/settings-put.js');
    const res = await settingsPut(
      fakeReq({ body: validSettings }) as never,
      ctx
    );
    expect(res.status).toBe(401);
  });
});
