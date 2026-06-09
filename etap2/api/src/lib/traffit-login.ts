/**
 * HTTP-based login flow do Traffit dla konta technicznego BAKK.
 *
 * Traffit uzywa Symfony Security z form login (`_username`/`_password` w
 * polach formularza). Pelne flow bez Chromium:
 *
 *   1. GET <baseUrl>/login (lub bazy) → wyciagnij CSRF token z HTML
 *      (input name="_csrf_token" value="...")
 *   2. POST <baseUrl>/login_check z body url-encoded:
 *        _username=<TRAFFIT_USERNAME>&_password=<TRAFFIT_PASSWORD>&_csrf_token=...
 *      Header: Content-Type: application/x-www-form-urlencoded
 *      Manual redirect handling: 302 = sukces, body html z bledem = porazka
 *   3. Wyciagnij Set-Cookie z response (PHPSESSID, traffit_user_id itp.)
 *   4. Cookie cache w pamieci modulu z TTL ~8h. Na 401/403 → wywal cache,
 *      zaloguj sie ponownie, retry.
 *
 * Wymaga app settings: TRAFFIT_BASE_URL + TRAFFIT_USERNAME + TRAFFIT_PASSWORD.
 * Konto techniczne BAKK Intrum w Traffit, nie pojedyncze konto rekrutera.
 */

const CSRF_INPUT_RE = /<input[^>]+name=["']_csrf_token["'][^>]+value=["']([^"']+)["']/i;
const CSRF_INPUT_RE_REVERSED = /<input[^>]+value=["']([^"']+)["'][^>]+name=["']_csrf_token["']/i;
const FORM_ACTION_RE = /<form[^>]+action=["']([^"']+)["'][^>]*>[^<]*<input[^>]+name=["']_username["']/i;

const DEFAULT_LOGIN_PATH = '/login';
const DEFAULT_LOGIN_CHECK_PATH = '/login_check';

const SESSION_TTL_MS = 7 * 60 * 60 * 1000;

export interface TraffitLoginConfig {
  baseUrl: string;
  username: string;
  password: string;
  loginPath?: string;
  loginCheckPath?: string;
}

export interface TraffitSession {
  cookie: string;
  expiresAt: number;
}

export class TraffitLoginError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'TraffitLoginError';
    this.status = status;
  }
}

let cache: TraffitSession | null = null;
let inflight: Promise<string> | null = null;

export function _resetCache(): void {
  cache = null;
  inflight = null;
}

function extractCsrf(html: string): string | null {
  const m = html.match(CSRF_INPUT_RE) ?? html.match(CSRF_INPUT_RE_REVERSED);
  return m ? m[1] : null;
}

function extractLoginAction(html: string, fallback: string): string {
  const m = html.match(FORM_ACTION_RE);
  return m ? m[1] : fallback;
}

function joinSetCookies(headerValues: string[]): string {
  // Set-Cookie zwykle jest multi-value - wez tylko name=value (przed pierwszym ';')
  // i DEDUPLIKUJ po nazwie - pozniejsza wartosc wygrywa (kluczowe gdy POST /login_check
  // regeneruje PHPSESSID po loginie: musimy uzyc NOWY, nie stary z GET /login).
  const byName = new Map<string, string>();
  for (const raw of headerValues) {
    const trimmed = raw?.split(';')[0]?.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq);
    byName.set(name, trimmed); // overwrite - later wins
  }
  return Array.from(byName.values()).join('; ');
}

function collectSetCookies(headers: Headers): string[] {
  // Headers.getSetCookie() jest w Node 24 / undici. Fallback do raw values.
  const h = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === 'function') return h.getSetCookie();
  const raw = headers.get('set-cookie');
  return raw ? raw.split(/,\s*(?=[^;]+=)/) : [];
}

async function performLogin(config: TraffitLoginConfig): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/$/, '');
  const loginPath = config.loginPath ?? DEFAULT_LOGIN_PATH;
  const loginCheckPath = config.loginCheckPath ?? DEFAULT_LOGIN_CHECK_PATH;

  // 1) GET login page - pobierz CSRF + opcjonalny initial Set-Cookie
  const getRes = await fetch(`${baseUrl}${loginPath}`, {
    method: 'GET',
    headers: { 'Accept': 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  });
  if (!getRes.ok && getRes.status !== 302) {
    throw new TraffitLoginError(`GET ${loginPath} failed: ${getRes.status}`, getRes.status);
  }
  const html = await getRes.text();
  const csrf = extractCsrf(html);
  const action = extractLoginAction(html, loginCheckPath);
  const initialCookies = collectSetCookies(getRes.headers);
  const sessionCookieBeforeLogin = joinSetCookies(initialCookies);

  // 2) POST login_check
  const body = new URLSearchParams();
  body.set('_username', config.username);
  body.set('_password', config.password);
  if (csrf) body.set('_csrf_token', csrf);

  const postUrl = action.startsWith('http') ? action : `${baseUrl}${action.startsWith('/') ? '' : '/'}${action}`;
  const postRes = await fetch(postUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html,application/xhtml+xml',
      ...(sessionCookieBeforeLogin ? { 'Cookie': sessionCookieBeforeLogin } : {}),
    },
    body: body.toString(),
    redirect: 'manual',
  });

  // Symfony Security: 302 na sukces (redirect do app), 200 z error html na bledne haslo
  if (postRes.status !== 302) {
    if (postRes.status === 200) {
      const errHtml = await postRes.text();
      const looksLikeError = /invalid credentials|bad credentials|Niepoprawn|nieprawidłow|błędne/i.test(errHtml);
      if (looksLikeError) {
        throw new TraffitLoginError('Login odrzucony: nieprawidlowe credentials konta technicznego.', 401);
      }
    }
    throw new TraffitLoginError(`POST ${loginCheckPath} oczekiwany 302, otrzymany ${postRes.status}`, postRes.status);
  }

  const sessionCookies = collectSetCookies(postRes.headers);
  const cookieHeader = joinSetCookies([...initialCookies, ...sessionCookies]);
  if (!cookieHeader) {
    throw new TraffitLoginError('Login zwrocil 302 ale bez Set-Cookie.', postRes.status);
  }

  return cookieHeader;
}

export function readLoginConfig(): TraffitLoginConfig | null {
  const baseUrl = process.env.TRAFFIT_BASE_URL;
  const username = process.env.TRAFFIT_USERNAME;
  const password = process.env.TRAFFIT_PASSWORD;
  if (!baseUrl || !username || !password) return null;
  return {
    baseUrl,
    username,
    password,
    loginPath: process.env.TRAFFIT_LOGIN_PATH,
    loginCheckPath: process.env.TRAFFIT_LOGIN_CHECK_PATH,
  };
}

/**
 * Returns active session cookie, performing login if cache is empty or expired.
 * Concurrent calls share the same login promise.
 */
export async function getSessionCookie(config: TraffitLoginConfig, now: () => number = Date.now): Promise<string> {
  if (cache && cache.expiresAt > now()) return cache.cookie;
  if (inflight) return inflight;
  inflight = performLogin(config)
    .then((cookie) => {
      cache = { cookie, expiresAt: now() + SESSION_TTL_MS };
      return cookie;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function invalidateSession(): void {
  cache = null;
}
