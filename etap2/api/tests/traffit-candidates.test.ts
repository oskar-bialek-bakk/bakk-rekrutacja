import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const listBkCandidates = vi.fn();
const readConfig = vi.fn();

vi.mock('../src/lib/traffit-client.js', () => ({
  readConfig: () => readConfig(),
  createTraffitClient: () => ({ listBkCandidates }),
  TraffitNotConfiguredError: class extends Error { constructor() { super('not configured'); this.name = 'TraffitNotConfiguredError'; } },
  TraffitSessionExpiredError: class extends Error { status = 502; },
  TraffitLoginError: class extends Error {},
}));

const ctx = { error: vi.fn(), warn: vi.fn() } as never;

function fakeReq(opts: { upn?: string; oid?: string }) {
  const h = new Map<string, string>();
  if (opts.upn) h.set('x-ms-client-principal-name', opts.upn);
  if (opts.oid) h.set('x-ms-client-principal-id', opts.oid);
  return { headers: { get: (k: string) => h.get(k.toLowerCase()) ?? null } };
}

beforeEach(() => { listBkCandidates.mockReset(); readConfig.mockReset(); });
afterEach(() => { vi.clearAllMocks(); });

describe('traffitCandidates', () => {
  it('200 zwraca listę kandydatów', async () => {
    readConfig.mockReturnValue({ baseUrl: 'https://t', username: 'u', password: 'p' });
    listBkCandidates.mockResolvedValue([
      { employeeId: 30, recruitmentId: 63, recruitmentName: 'R', fullName: 'Nowak Anna', email: null },
    ]);
    const { traffitCandidates } = await import('../src/functions/traffit-candidates.js');
    const res = await traffitCandidates(fakeReq({ upn: 'a@bakk.com', oid: 'o' }) as never, ctx);
    expect(res.status).toBe(200);
    expect((res.jsonBody as { candidates: unknown[] }).candidates).toHaveLength(1);
  });

  it('501 gdy Traffit nieskonfigurowany', async () => {
    readConfig.mockReturnValue(null);
    const { traffitCandidates } = await import('../src/functions/traffit-candidates.js');
    const res = await traffitCandidates(fakeReq({ upn: 'a@bakk.com', oid: 'o' }) as never, ctx);
    expect(res.status).toBe(501);
  });

  it('401 gdy brak usera', async () => {
    readConfig.mockReturnValue({ baseUrl: 'https://t', username: 'u', password: 'p' });
    const { traffitCandidates } = await import('../src/functions/traffit-candidates.js');
    const res = await traffitCandidates(fakeReq({}) as never, ctx);
    expect(res.status).toBe(401);
  });
});
