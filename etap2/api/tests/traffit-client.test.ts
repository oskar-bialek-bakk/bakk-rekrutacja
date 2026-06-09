import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock traffit-login zeby uniknac realnego GET/POST do Traffit i zwracac stale cookie.
vi.mock('../src/lib/traffit-login.js', () => ({
  getSessionCookie: vi.fn(async () => 'PHPSESSID=abc'),
  invalidateSession: vi.fn(),
  readLoginConfig: vi.fn(() => null),
  TraffitLoginError: class extends Error {},
  _resetCache: vi.fn(),
}));

import { TraffitSessionExpiredError, createTraffitClient } from '../src/lib/traffit-client.js';
import { getSessionCookie, invalidateSession } from '../src/lib/traffit-login.js';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  vi.mocked(getSessionCookie).mockResolvedValue('PHPSESSID=abc');
  vi.mocked(invalidateSession).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function resp(status: number, body: unknown, contentType = 'application/json'): Response {
  const noBody = status === 204 || status === 205 || status === 304;
  return new Response(noBody ? null : (typeof body === 'string' ? body : JSON.stringify(body)), {
    status,
    headers: { 'content-type': contentType },
  });
}

const config = { baseUrl: 'https://traffit.test', username: 'bot', password: 'pwd' };

describe('TraffitClient', () => {
  it('findExistingNoteId zwraca null gdy brak markeru', async () => {
    fetchMock.mockImplementation(async () => resp(200, [
      { type: { sys_name: 'note' }, note_id: 1, content: 'inna notatka' },
    ]));
    const c = createTraffitClient(config);
    expect(await c.findExistingNoteId(42, 'a1')).toBeNull();
  });

  it('findExistingNoteId znajduje noteId po markerze bakk-etap2:{id}', async () => {
    fetchMock.mockImplementation(async () => resp(200, [
      { type: { sys_name: 'note' }, note_id: 7, content: '<!-- bakk-etap2:a1 -->\n<p>cos</p>' },
    ]));
    const c = createTraffitClient(config);
    expect(await c.findExistingNoteId(42, 'a1')).toBe(7);
  });

  it('createNote zwraca id z 201', async () => {
    fetchMock.mockImplementation(async () => resp(201, { id: 123 }));
    const c = createTraffitClient(config);
    expect(await c.createNote(42, '<p>html</p>')).toBe(123);
  });

  it('updateNote rzuca na 401 (session expired)', async () => {
    fetchMock.mockImplementation(async () => resp(401, {}));
    const c = createTraffitClient(config);
    await expect(c.updateNote(42, 7, '<p/>')).rejects.toBeInstanceOf(TraffitSessionExpiredError);
  });

  it('pushAssessmentNote updatuje gdy istnieje, tworzy gdy brak', async () => {
    // first call: activities (znajduje noteId 7), second call: PUT 204
    fetchMock
      .mockImplementationOnce(async () => resp(200, [
        { type: { sys_name: 'note' }, note_id: 7, content: '<!-- bakk-etap2:a1 -->' },
      ]))
      .mockImplementationOnce(async () => resp(204, ''));
    const c = createTraffitClient(config);
    const r = await c.pushAssessmentNote({ employeeId: 42, assessmentId: 'a1', html: '<p/>' });
    expect(r).toEqual({ noteId: 7, action: 'updated' });

    fetchMock.mockReset();
    fetchMock
      .mockImplementationOnce(async () => resp(200, []))
      .mockImplementationOnce(async () => resp(201, { id: 99 }));
    const r2 = await c.pushAssessmentNote({ employeeId: 42, assessmentId: 'a2', html: '<p/>' });
    expect(r2).toEqual({ noteId: 99, action: 'created' });
  });

  it('przekazuje Cookie header', async () => {
    fetchMock.mockImplementation(async () => resp(200, []));
    const c = createTraffitClient(config);
    await c.findExistingNoteId(42, 'a1');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Cookie).toBe('PHPSESSID=abc');
  });

  it('401 wywoluje invalidateSession + retry raz; sukces gdy drugi raz OK', async () => {
    fetchMock
      .mockImplementationOnce(async () => resp(401, {}))
      .mockImplementationOnce(async () => resp(200, []));
    const c = createTraffitClient(config);
    const r = await c.findExistingNoteId(42, 'a1');
    expect(r).toBeNull();
    expect(invalidateSession).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
