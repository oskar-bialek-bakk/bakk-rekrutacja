import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface CosmosItem {
  id: string;
  partitionKey: string;
  data: Record<string, unknown>;
}

const store: CosmosItem[] = [];

const itemMock = (id: string, pk: string) => ({
  read: vi.fn(async () => {
    const found = store.find((x) => x.id === id && x.partitionKey === pk);
    if (!found) {
      const err: Error & { code?: number } = new Error('NotFound');
      err.code = 404;
      throw err;
    }
    return { resource: found.data };
  }),
  delete: vi.fn(async () => {
    const idx = store.findIndex((x) => x.id === id && x.partitionKey === pk);
    if (idx < 0) {
      const err: Error & { code?: number } = new Error('NotFound');
      err.code = 404;
      throw err;
    }
    store.splice(idx, 1);
    return {};
  }),
});

const queryMock = (sql: string | { query: string; parameters?: Array<{ name: string; value: unknown }> }) => ({
  fetchAll: vi.fn(async () => {
    const q = typeof sql === 'string' ? sql : sql.query;
    const params = typeof sql === 'string' ? [] : sql.parameters ?? [];
    const upnParam = params.find((p) => p.name === '@upn')?.value as string | undefined;
    const idParam = params.find((p) => p.name === '@id')?.value as string | undefined;

    let resources = store.map((x) => x.data);
    if (q.includes('c.userPrincipalName = @upn') && upnParam !== undefined) {
      resources = resources.filter((r) => (r as { userPrincipalName?: string }).userPrincipalName === upnParam);
    }
    if (q.includes('c.id = @id') && idParam !== undefined) {
      resources = resources.filter((r) => (r as { id?: string }).id === idParam);
    }
    if (q.includes('c.userPrincipalName != @upn') && upnParam !== undefined) {
      resources = resources.filter((r) => (r as { userPrincipalName?: string }).userPrincipalName !== upnParam);
    }
    return { resources };
  }),
});

const containerMock = {
  item: (id: string, pk: string) => itemMock(id, pk),
  items: {
    query: queryMock,
    upsert: vi.fn(async (doc: Record<string, unknown>) => {
      const pk = (doc as { userPrincipalName: string }).userPrincipalName;
      const idx = store.findIndex((x) => x.id === (doc.id as string) && x.partitionKey === pk);
      if (idx >= 0) store[idx] = { id: doc.id as string, partitionKey: pk, data: doc };
      else store.push({ id: doc.id as string, partitionKey: pk, data: doc });
      return { resource: doc };
    }),
    create: vi.fn(async (doc: Record<string, unknown>) => {
      store.push({ id: doc.id as string, partitionKey: (doc as { scope?: string }).scope ?? 'global', data: doc });
      return { resource: doc };
    }),
  },
};

vi.mock('../src/lib/cosmos.js', () => ({
  assessmentsContainer: () => containerMock,
  variantUsageContainer: () => containerMock,
  settingsContainer: () => containerMock,
  pingCosmos: async () => undefined,
  _resetCosmosClient: () => undefined,
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  store.length = 0;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
});

function fakeReq(opts: {
  upn?: string;
  oid?: string;
  query?: Record<string, string>;
  params?: Record<string, string>;
  body?: unknown;
}) {
  const headers = new Map<string, string>();
  if (opts.upn) headers.set('x-ms-client-principal-name', opts.upn);
  if (opts.oid) headers.set('x-ms-client-principal-id', opts.oid);
  const q = new Map(Object.entries(opts.query ?? {}));
  return {
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    query: { get: (k: string) => q.get(k) ?? null },
    params: opts.params ?? {},
    json: async () => opts.body,
  };
}

const ctx = { error: vi.fn() } as never;

function sampleAssessment(id: string): Record<string, unknown> {
  return {
    id,
    schemaVersion: 2,
    candidate: { nameOrId: 'Jan', date: '2026-06-08', stage1Result: '', stage1Note: '' },
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

describe('assessments CRUD', () => {
  it('list scope=mine zwraca tylko docs ownera', async () => {
    store.push({ id: 'a1', partitionKey: 'alice@bakk.com', data: { ...sampleAssessment('a1'), userPrincipalName: 'alice@bakk.com' } });
    store.push({ id: 'b1', partitionKey: 'bob@bakk.com', data: { ...sampleAssessment('b1'), userPrincipalName: 'bob@bakk.com' } });

    const { assessmentsList } = await import('../src/functions/assessments-list.js');
    const res = await assessmentsList(fakeReq({ upn: 'alice@bakk.com', oid: 'oid-a' }) as never, ctx);
    expect(res.status).toBe(200);
    expect((res.jsonBody as { scope: string; assessments: unknown[] }).assessments).toHaveLength(1);
    expect((res.jsonBody as { scope: string }).scope).toBe('mine');
  });

  it('list scope=team zwraca wszystko', async () => {
    store.push({ id: 'a1', partitionKey: 'alice@bakk.com', data: { ...sampleAssessment('a1'), userPrincipalName: 'alice@bakk.com' } });
    store.push({ id: 'b1', partitionKey: 'bob@bakk.com', data: { ...sampleAssessment('b1'), userPrincipalName: 'bob@bakk.com' } });

    const { assessmentsList } = await import('../src/functions/assessments-list.js');
    const res = await assessmentsList(fakeReq({ upn: 'alice@bakk.com', oid: 'oid-a', query: { scope: 'team' } }) as never, ctx);
    expect((res.jsonBody as { assessments: unknown[] }).assessments).toHaveLength(2);
  });

  it('list bez auth zwraca 401', async () => {
    const { assessmentsList } = await import('../src/functions/assessments-list.js');
    const res = await assessmentsList(fakeReq({}) as never, ctx);
    expect(res.status).toBe(401);
  });

  it('upsert tworzy doc dla zalogowanego usera i wstrzykuje upn', async () => {
    const { assessmentsUpsert } = await import('../src/functions/assessments-upsert.js');
    const body = sampleAssessment('a1');
    const res = await assessmentsUpsert(
      fakeReq({ upn: 'alice@bakk.com', oid: 'oid-a', params: { id: 'a1' }, body }) as never,
      ctx
    );
    expect(res.status).toBe(200);
    expect((res.jsonBody as { userPrincipalName: string }).userPrincipalName).toBe('alice@bakk.com');
    expect(store).toHaveLength(1);
  });

  it('upsert nie pozwala nadpisac cudzego docu (cross-partition kolizja)', async () => {
    store.push({ id: 'a1', partitionKey: 'bob@bakk.com', data: { ...sampleAssessment('a1'), userPrincipalName: 'bob@bakk.com' } });
    const { assessmentsUpsert } = await import('../src/functions/assessments-upsert.js');
    const res = await assessmentsUpsert(
      fakeReq({ upn: 'alice@bakk.com', oid: 'oid-a', params: { id: 'a1' }, body: sampleAssessment('a1') }) as never,
      ctx
    );
    expect(res.status).toBe(403);
  });

  it('upsert odrzuca 400 gdy id w body != URL', async () => {
    const { assessmentsUpsert } = await import('../src/functions/assessments-upsert.js');
    const res = await assessmentsUpsert(
      fakeReq({ upn: 'alice@bakk.com', oid: 'oid-a', params: { id: 'a1' }, body: sampleAssessment('different') }) as never,
      ctx
    );
    expect(res.status).toBe(400);
  });

  it('delete usuwa wlasny doc, zwraca 204', async () => {
    store.push({ id: 'a1', partitionKey: 'alice@bakk.com', data: { ...sampleAssessment('a1'), userPrincipalName: 'alice@bakk.com' } });
    const { assessmentsDelete } = await import('../src/functions/assessments-delete.js');
    const res = await assessmentsDelete(
      fakeReq({ upn: 'alice@bakk.com', oid: 'oid-a', params: { id: 'a1' } }) as never,
      ctx
    );
    expect(res.status).toBe(204);
    expect(store).toHaveLength(0);
  });

  it('delete cudzego docu zwraca 404 (nie istnieje w jego partition)', async () => {
    store.push({ id: 'a1', partitionKey: 'bob@bakk.com', data: { ...sampleAssessment('a1'), userPrincipalName: 'bob@bakk.com' } });
    const { assessmentsDelete } = await import('../src/functions/assessments-delete.js');
    const res = await assessmentsDelete(
      fakeReq({ upn: 'alice@bakk.com', oid: 'oid-a', params: { id: 'a1' } }) as never,
      ctx
    );
    expect(res.status).toBe(404);
  });

  it('get scope=mine zwraca doc gdy istnieje w partition usera', async () => {
    store.push({ id: 'a1', partitionKey: 'alice@bakk.com', data: { ...sampleAssessment('a1'), userPrincipalName: 'alice@bakk.com' } });
    const { assessmentsGet } = await import('../src/functions/assessments-get.js');
    const res = await assessmentsGet(
      fakeReq({ upn: 'alice@bakk.com', oid: 'oid-a', params: { id: 'a1' } }) as never,
      ctx
    );
    expect(res.status).toBe(200);
    expect((res.jsonBody as { id: string }).id).toBe('a1');
  });

  it('get scope=team znajduje doc innego usera', async () => {
    store.push({ id: 'b1', partitionKey: 'bob@bakk.com', data: { ...sampleAssessment('b1'), userPrincipalName: 'bob@bakk.com' } });
    const { assessmentsGet } = await import('../src/functions/assessments-get.js');
    const res = await assessmentsGet(
      fakeReq({ upn: 'alice@bakk.com', oid: 'oid-a', params: { id: 'b1' }, query: { scope: 'team' } }) as never,
      ctx
    );
    expect(res.status).toBe(200);
  });
});
