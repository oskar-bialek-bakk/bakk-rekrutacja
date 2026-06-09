import { forceRefresh, getAccessToken } from '../auth/access-token';

const DEFAULT_API_BASE = 'https://bakk-rekrutacja-api.azurewebsites.net';

export class TraffitPushError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'TraffitPushError';
    this.status = status;
  }
}

export interface TraffitPushResult {
  noteId: number;
  action: 'created' | 'updated';
}

export async function pushToTraffit(input: {
  assessmentId: string;
  employeeId: number;
  html: string;
  baseUrl?: string;
}): Promise<TraffitPushResult> {
  const baseUrl = (input.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, '');

  async function once(retried: boolean): Promise<TraffitPushResult> {
    const token = await getAccessToken();
    const res = await fetch(`${baseUrl}/api/v1/traffit/push`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assessmentId: input.assessmentId,
        employeeId: input.employeeId,
        html: input.html,
      }),
    });
    if (res.status === 401 && !retried) {
      forceRefresh();
      return once(true);
    }
    const ct = res.headers.get('content-type') ?? '';
    const payload = ct.includes('application/json') ? await res.json() : undefined;
    if (!res.ok) {
      const msg = (payload as { error?: string } | undefined)?.error ?? `HTTP ${res.status}`;
      throw new TraffitPushError(res.status, msg);
    }
    return payload as TraffitPushResult;
  }

  return once(false);
}
