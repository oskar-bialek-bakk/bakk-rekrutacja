import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface CosmosItem { id: string; partitionKey: string; data: Record<string, unknown>; }
const store: CosmosItem[] = [];

const itemMock = (id: string, pk: string) => ({
  read: vi.fn(async () => {
    const found = store.find((x) => x.id === id && x.partitionKey === pk);
    if (!found) {
      // Cosmos SDK rzuca błąd z code=404 dla nieistniejącego point-read.
      const err: Error & { code?: number } = new Error('NotFound');
      err.code = 404;
      throw err;
    }
    return { resource: found.data };
  }),
});

const containerMock = { item: (id: string, pk: string) => itemMock(id, pk) };

vi.mock('../src/lib/cosmos.js', () => ({
  assessmentsContainer: () => containerMock,
  variantUsageContainer: () => containerMock,
  settingsContainer: () => containerMock,
  pingCosmos: async () => undefined,
  _resetCosmosClient: () => undefined,
}));

const pushAssessmentNote = vi.fn();
const readConfig = vi.fn();

vi.mock('../src/lib/traffit-client.js', () => ({
  readConfig: () => readConfig(),
  createTraffitClient: () => ({ pushAssessmentNote }),
  TraffitNotConfiguredError: class extends Error { constructor() { super('not configured'); this.name = 'TraffitNotConfiguredError'; } },
  TraffitSessionExpiredError: class extends Error { constructor(m = 'expired') { super(m); this.name = 'TraffitSessionExpiredError'; } },
  TraffitLoginError: class extends Error { constructor(m = 'login') { super(m); this.name = 'TraffitLoginError'; } },
}));

const ctx = { error: vi.fn(), warn: vi.fn() } as never;

function fakeReq(opts: { upn?: string; oid?: string; body?: unknown }) {
  const h = new Map<string, string>();
  if (opts.upn) h.set('x-ms-client-principal-name', opts.upn);
  if (opts.oid) h.set('x-ms-client-principal-id', opts.oid);
  return {
    headers: { get: (k: string) => h.get(k.toLowerCase()) ?? null },
    json: async () => opts.body,
  };
}

beforeEach(() => { store.length = 0; pushAssessmentNote.mockReset(); readConfig.mockReset(); });
afterEach(() => { vi.clearAllMocks(); });

const body = { assessmentId: 'a1', employeeId: 30, html: '<p>ocena</p>' };

describe('traffitPush', () => {
  it('zwraca 404 (NIE 500) gdy ocena nie istnieje w partycji usera', async () => {
    readConfig.mockReturnValue({ baseUrl: 'https://t', username: 'u', password: 'p' });
    const { traffitPush } = await import('../src/functions/traffit-push.js');
    const res = await traffitPush(fakeReq({ upn: 'alice@bakk.com', oid: 'o', body }) as never, ctx);
    expect(res.status).toBe(404);
    expect((res.jsonBody as { error: string }).error).toBe('Assessment not found in user partition');
    expect(pushAssessmentNote).not.toHaveBeenCalled();
  });

  it('pushuje notatkę gdy ocena istnieje w partycji usera', async () => {
    readConfig.mockReturnValue({ baseUrl: 'https://t', username: 'u', password: 'p' });
    store.push({ id: 'a1', partitionKey: 'alice@bakk.com', data: { id: 'a1', userPrincipalName: 'alice@bakk.com' } });
    pushAssessmentNote.mockResolvedValue({ noteId: 99, action: 'created' });
    const { traffitPush } = await import('../src/functions/traffit-push.js');
    const res = await traffitPush(fakeReq({ upn: 'alice@bakk.com', oid: 'o', body }) as never, ctx);
    expect(res.status).toBe(200);
    expect((res.jsonBody as { noteId: number }).noteId).toBe(99);
    expect(pushAssessmentNote).toHaveBeenCalledWith({ employeeId: 30, assessmentId: 'a1', html: '<p>ocena</p>' });
  });

  it('501 gdy Traffit nieskonfigurowany', async () => {
    readConfig.mockReturnValue(null);
    const { traffitPush } = await import('../src/functions/traffit-push.js');
    const res = await traffitPush(fakeReq({ upn: 'alice@bakk.com', oid: 'o', body }) as never, ctx);
    expect(res.status).toBe(501);
  });

  it('401 gdy brak usera', async () => {
    readConfig.mockReturnValue({ baseUrl: 'https://t', username: 'u', password: 'p' });
    const { traffitPush } = await import('../src/functions/traffit-push.js');
    const res = await traffitPush(fakeReq({ body }) as never, ctx);
    expect(res.status).toBe(401);
  });
});
