import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/auth/access-token', () => ({
  getAccessToken: vi.fn(async () => 'tok'),
  forceRefresh: vi.fn(),
}));

import { fetchTraffitCandidates } from '../src/persistence/traffit-candidates';
import { forceRefresh } from '../src/auth/access-token';

const fetchMock = vi.fn();
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('fetchTraffitCandidates', () => {
  it('zwraca listę kandydatów', async () => {
    fetchMock.mockResolvedValue(ok({ candidates: [
      { employeeId: 30, recruitmentId: 63, recruitmentName: 'R', fullName: 'Nowak Anna', email: null },
    ]}));
    const res = await fetchTraffitCandidates({ baseUrl: 'https://api' });
    expect(res).toHaveLength(1);
    expect(res[0].employeeId).toBe(30);
  });

  it('na 401 robi forceRefresh i ponawia', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(ok({ candidates: [] }));
    await fetchTraffitCandidates({ baseUrl: 'https://api' });
    expect(forceRefresh).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
