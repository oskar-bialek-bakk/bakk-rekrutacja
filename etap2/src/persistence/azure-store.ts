import type { Assessment, BlockId, Settings, VariantUsage } from '../domain/model';
import type { Repository } from './repository';
import { forceRefresh, getAccessToken } from '../auth/access-token';

type RotatingBlock = 'A' | 'B' | 'C' | 'D';
const ROTATING: RotatingBlock[] = ['A', 'B', 'C', 'D'];

interface BackendVariantUsage {
  id: string;
  scope: string;
  counts: Record<RotatingBlock, number[]>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

function backendToFrontUsage(backend: BackendVariantUsage): VariantUsage {
  const out: VariantUsage = {};
  for (const block of ROTATING) {
    const arr = backend.counts[block] ?? [];
    const record: Record<number, number> = {};
    arr.forEach((count, idx) => {
      if (count > 0) record[idx] = count;
    });
    if (Object.keys(record).length > 0) out[block] = record;
  }
  return out;
}

function diffIncrements(prev: VariantUsage, next: VariantUsage): Array<{ block: RotatingBlock; variantIdx: number }> {
  const result: Array<{ block: RotatingBlock; variantIdx: number }> = [];
  for (const block of ROTATING) {
    const prevBlock = prev[block] ?? {};
    const nextBlock = next[block] ?? {};
    const keys = new Set<string>([...Object.keys(prevBlock), ...Object.keys(nextBlock)]);
    for (const k of keys) {
      const idx = Number(k);
      const delta = (nextBlock[idx] ?? 0) - (prevBlock[idx] ?? 0);
      if (delta > 0) {
        for (let i = 0; i < delta; i++) result.push({ block, variantIdx: idx });
      }
    }
  }
  return result;
}

const DEFAULT_API_BASE = 'https://bakk-rekrutacja-api.azurewebsites.net';

export class AzureStore implements Repository {
  private readonly baseUrl: string;
  private lastUsage: VariantUsage = {};

  constructor(baseUrl?: string) {
    const envBase = (import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL;
    this.baseUrl = (baseUrl ?? envBase ?? DEFAULT_API_BASE).replace(/\/$/, '');
  }

  private async request<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
    const token = await getAccessToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && !retried) {
      forceRefresh();
      return this.request<T>(method, path, body, true);
    }
    if (res.status === 204) return undefined as T;
    const contentType = res.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json') ? await res.json() : undefined;
    if (!res.ok) {
      const errPayload = payload as { error?: string; details?: unknown } | undefined;
      throw new ApiError(res.status, errPayload?.error ?? `HTTP ${res.status}`, errPayload?.details);
    }
    return payload as T;
  }

  async findAll(): Promise<Assessment[]> {
    const data = await this.request<{ assessments: Assessment[] }>('GET', '/api/v1/assessments?scope=mine');
    return data.assessments;
  }

  async findAllTeam(): Promise<Assessment[]> {
    const data = await this.request<{ assessments: Assessment[] }>('GET', '/api/v1/assessments?scope=team');
    return data.assessments;
  }

  async get(id: string): Promise<Assessment | null> {
    try {
      return await this.request<Assessment>('GET', `/api/v1/assessments/${encodeURIComponent(id)}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }

  async save(a: Assessment): Promise<void> {
    await this.request<Assessment>('PUT', `/api/v1/assessments/${encodeURIComponent(a.id)}`, a);
  }

  async delete(id: string): Promise<void> {
    try {
      await this.request<void>('DELETE', `/api/v1/assessments/${encodeURIComponent(id)}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return;
      throw err;
    }
  }

  async getVariantUsage(): Promise<VariantUsage> {
    try {
      const backend = await this.request<BackendVariantUsage>('GET', '/api/v1/variant-usage');
      const front = backendToFrontUsage(backend);
      this.lastUsage = front;
      return front;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        this.lastUsage = {};
        return {};
      }
      throw err;
    }
  }

  async saveVariantUsage(u: VariantUsage): Promise<void> {
    const increments = diffIncrements(this.lastUsage, u);
    for (const inc of increments) {
      await this.request<unknown>('POST', '/api/v1/variant-usage/increment', inc);
    }
    this.lastUsage = u;
  }

  async getSettings(): Promise<Settings | null> {
    const stored = await this.request<{ weights: Settings['weights']; showScoreLive: boolean; includeEInScore: boolean } | null>(
      'GET',
      '/api/v1/settings',
    );
    if (!stored) return null;
    return {
      weights: stored.weights,
      showScoreLive: stored.showScoreLive,
      includeEInScore: stored.includeEInScore,
    };
  }

  async saveSettings(s: Settings): Promise<void> {
    await this.request<Settings>('PUT', '/api/v1/settings', s);
  }

  /** Imports localStorage data into Cloud (Task 7 migration UI). */
  async importBulk(payload: { assessments: Assessment[]; settings: Settings | null; variantUsage: VariantUsage }): Promise<{ assessments: number; settings: boolean; variantUsageIncrements: number }> {
    let count = 0;
    for (const a of payload.assessments) {
      await this.save(a);
      count++;
    }
    let saved = false;
    if (payload.settings) {
      await this.saveSettings(payload.settings);
      saved = true;
    }
    const incs = diffIncrements({}, payload.variantUsage);
    for (const inc of incs) {
      await this.request<unknown>('POST', '/api/v1/variant-usage/increment', inc);
    }
    this.lastUsage = payload.variantUsage;
    return { assessments: count, settings: saved, variantUsageIncrements: incs.length };
  }

  /** Exposed for tests and Task 7 migration screen. */
  _setLastUsage(u: VariantUsage): void { this.lastUsage = u; }

  static readonly rotatingBlocks: BlockId[] = [...ROTATING];
}
