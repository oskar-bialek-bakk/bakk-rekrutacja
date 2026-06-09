import { forceRefresh, getAccessToken } from '../auth/access-token';
import type { TraffitCandidate } from '../domain/traffit-roster';

const DEFAULT_API_BASE = 'https://bakk-rekrutacja-api.azurewebsites.net';

export class TraffitCandidatesError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'TraffitCandidatesError';
    this.status = status;
  }
}

export async function fetchTraffitCandidates(input?: { baseUrl?: string }): Promise<TraffitCandidate[]> {
  const baseUrl = (input?.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, '');

  async function once(retried: boolean): Promise<TraffitCandidate[]> {
    const token = await getAccessToken();
    const res = await fetch(`${baseUrl}/api/v1/traffit/candidates`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.status === 401 && !retried) {
      forceRefresh();
      return once(true);
    }
    const ct = res.headers.get('content-type') ?? '';
    const payload = ct.includes('application/json') ? await res.json() : undefined;
    if (!res.ok) {
      const msg = (payload as { error?: string } | undefined)?.error ?? `HTTP ${res.status}`;
      throw new TraffitCandidatesError(res.status, msg);
    }
    return (payload as { candidates?: TraffitCandidate[] } | undefined)?.candidates ?? [];
  }

  return once(false);
}
