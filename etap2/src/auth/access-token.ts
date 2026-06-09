interface AuthMeEntry {
  access_token?: string;
  expires_on?: string;
  id_token?: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

let cache: CachedToken | null = null;
let inflight: Promise<string> | null = null;

function parseExpiry(raw?: string): number {
  const fallback = Date.now() + 60 * 60 * 1000;
  if (!raw) return fallback;
  // Easy Auth `/.auth/me` zwraca expires_on jako:
  //  - ISO date string (np. "2026-06-09T12:34:56.789Z")
  //  - unix epoch w sekundach jako string (np. "1781234567")
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
    return fallback;
  }
  const t = Date.parse(trimmed);
  return Number.isFinite(t) ? t : fallback;
}

async function fetchToken(): Promise<string> {
  const res = await fetch('/.auth/me', { credentials: 'include' });
  if (res.status === 401) {
    const next = encodeURIComponent(window.location.href);
    window.location.assign(`/.auth/login/aad?post_login_redirect_url=${next}`);
    throw new Error('Redirecting to login');
  }
  if (!res.ok) {
    throw new Error(`/.auth/me HTTP ${res.status}`);
  }
  const data = (await res.json()) as AuthMeEntry[] | { clientPrincipal?: unknown };
  const entries = Array.isArray(data) ? data : [];
  // Preferujemy id_token bo gwarantowana audience = clientId BAKK Int Apps (5d588d76-...).
  // access_token bez explicit `loginParameters` w Easy Auth idzie domyślnie z audience = Graph,
  // którego Function App nie akceptuje (allowedAudiences = [5d588d76-..., api://5d588d76-...]).
  const entry = entries.find((e) => typeof e.id_token === 'string' && e.id_token.length > 0)
              ?? entries.find((e) => typeof e.access_token === 'string' && e.access_token.length > 0);
  const token = entry?.id_token ?? entry?.access_token;
  if (!token) {
    throw new Error('Brak id_token/access_token w /.auth/me. Sprawdz Easy Auth na App Service.');
  }
  const expiresAt = parseExpiry(entry?.expires_on);
  cache = { token, expiresAt };
  return token;
}

export async function getAccessToken(): Promise<string> {
  if (cache && cache.expiresAt - Date.now() > REFRESH_BUFFER_MS) {
    return cache.token;
  }
  if (inflight) return inflight;
  inflight = fetchToken().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function forceRefresh(): void {
  cache = null;
  inflight = null;
}
