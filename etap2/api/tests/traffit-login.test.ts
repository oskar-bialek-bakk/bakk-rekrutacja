import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TraffitLoginError,
  _resetCache,
  getSessionCookie,
  invalidateSession,
} from '../src/lib/traffit-login.js';

const fetchMock = vi.fn();

beforeEach(() => {
  _resetCache();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function htmlResp(status: number, body: string, cookies: string[] = []): Response {
  const headers = new Headers({ 'content-type': 'text/html' });
  for (const c of cookies) headers.append('set-cookie', c);
  const noBody = status === 204 || status === 205 || status === 304;
  return new Response(noBody ? null : body, { status, headers });
}

const config = { baseUrl: 'https://traffit.test', username: 'bakk-bot@bakk.com', password: 'sekret123' };

const LOGIN_HTML = `
  <html><body>
    <form action="/login_check" method="post">
      <input name="_username" type="email">
      <input name="_password" type="password">
      <input name="_csrf_token" value="csrf-abc-123">
      <button type="submit">Zaloguj</button>
    </form>
  </body></html>`;

describe('Traffit HTTP login', () => {
  it('GET login -> extract CSRF -> POST login_check -> 302 + Set-Cookie', async () => {
    fetchMock
      .mockImplementationOnce(async () => htmlResp(200, LOGIN_HTML, ['PHPSESSID=initial; Path=/; HttpOnly']))
      .mockImplementationOnce(async () => htmlResp(302, '', [
        'PHPSESSID=loggedin; Path=/; HttpOnly',
        'traffit_user_id=42; Path=/',
      ]));

    const cookie = await getSessionCookie(config);
    expect(cookie).toContain('PHPSESSID=loggedin');
    expect(cookie).toContain('traffit_user_id=42');

    const [, postInit] = fetchMock.mock.calls[1];
    const postBody = new URLSearchParams(postInit.body as string);
    expect(postBody.get('_username')).toBe('bakk-bot@bakk.com');
    expect(postBody.get('_password')).toBe('sekret123');
    expect(postBody.get('_csrf_token')).toBe('csrf-abc-123');
  });

  it('cache zwraca to samo cookie bez ponownego logowania', async () => {
    fetchMock
      .mockImplementationOnce(async () => htmlResp(200, LOGIN_HTML, ['PHPSESSID=initial']))
      .mockImplementationOnce(async () => htmlResp(302, '', ['PHPSESSID=loggedin']));

    const c1 = await getSessionCookie(config);
    const c2 = await getSessionCookie(config);
    expect(c1).toBe(c2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('invalidateSession wymusza nowy login na nastepnym getSessionCookie', async () => {
    fetchMock
      .mockImplementationOnce(async () => htmlResp(200, LOGIN_HTML, ['PHPSESSID=initial']))
      .mockImplementationOnce(async () => htmlResp(302, '', ['PHPSESSID=first']))
      .mockImplementationOnce(async () => htmlResp(200, LOGIN_HTML, ['PHPSESSID=initial2']))
      .mockImplementationOnce(async () => htmlResp(302, '', ['PHPSESSID=second']));

    const c1 = await getSessionCookie(config);
    expect(c1).toContain('PHPSESSID=first');
    invalidateSession();
    const c2 = await getSessionCookie(config);
    expect(c2).toContain('PHPSESSID=second');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('rzuca TraffitLoginError gdy POST zwroci 200 z error html', async () => {
    fetchMock
      .mockImplementationOnce(async () => htmlResp(200, LOGIN_HTML, ['PHPSESSID=initial']))
      .mockImplementationOnce(async () => htmlResp(200, '<p>Niepoprawne dane logowania</p>'));

    await expect(getSessionCookie(config)).rejects.toBeInstanceOf(TraffitLoginError);
  });

  it('rzuca TraffitLoginError gdy 302 ale brak Set-Cookie', async () => {
    fetchMock
      .mockImplementationOnce(async () => htmlResp(200, LOGIN_HTML))
      .mockImplementationOnce(async () => htmlResp(302, ''));

    await expect(getSessionCookie(config)).rejects.toThrow(/bez Set-Cookie/i);
  });

  it('concurrent calls share inflight login promise', async () => {
    let postCount = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/login')) return htmlResp(200, LOGIN_HTML, ['PHPSESSID=initial']);
      postCount++;
      return htmlResp(302, '', ['PHPSESSID=loggedin']);
    });
    const [a, b, c] = await Promise.all([
      getSessionCookie(config),
      getSessionCookie(config),
      getSessionCookie(config),
    ]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(postCount).toBe(1);
  });

  it('cache TTL wygasa', async () => {
    fetchMock
      .mockImplementationOnce(async () => htmlResp(200, LOGIN_HTML, ['PHPSESSID=initial']))
      .mockImplementationOnce(async () => htmlResp(302, '', ['PHPSESSID=first']))
      .mockImplementationOnce(async () => htmlResp(200, LOGIN_HTML, ['PHPSESSID=initial2']))
      .mockImplementationOnce(async () => htmlResp(302, '', ['PHPSESSID=second']));

    let now = 1_000_000_000_000;
    const c1 = await getSessionCookie(config, () => now);
    expect(c1).toContain('first');
    now += 8 * 60 * 60 * 1000; // 8h - przekracza TTL 7h
    const c2 = await getSessionCookie(config, () => now);
    expect(c2).toContain('second');
  });
});
