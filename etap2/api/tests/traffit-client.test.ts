import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TraffitSessionExpiredError, createTraffitClient } from '../src/lib/traffit-client.js';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function resp(status: number, body: unknown, contentType = 'application/json'): Response {
  // Response constructor disallows body for 204/205/304 - use null body for those.
  const noBody = status === 204 || status === 205 || status === 304;
  return new Response(noBody ? null : (typeof body === 'string' ? body : JSON.stringify(body)), {
    status,
    headers: { 'content-type': contentType },
  });
}

const config = { baseUrl: 'https://traffit.test', sessionCookie: 'PHPSESSID=abc' };

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
});
