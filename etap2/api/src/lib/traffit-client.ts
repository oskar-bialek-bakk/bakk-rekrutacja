/**
 * Traffit REST client z auto-loginem konta technicznego.
 *
 * Login: HTTP form POST (Symfony Security) - omija potrzebe Chromium na Linux
 * Consumption. Konfiguracja: TRAFFIT_BASE_URL + TRAFFIT_USERNAME + TRAFFIT_PASSWORD
 * w app settings Function App. Session cookie cache'owany w pamieci modulu z
 * TTL ~7h, auto-relogin na 401/403.
 *
 * Endpointy:
 *   GET    /api/v2/employees/{id}/activities       - list activities (notes)
 *   POST   /api/v2/employees/{id}/notes            - 201 {id}
 *   PUT    /api/v2/employees/{id}/notes/{noteId}   - 204
 */

import {
  TraffitLoginConfig,
  TraffitLoginError,
  getSessionCookie,
  invalidateSession,
  readLoginConfig,
} from './traffit-login.js';

const MARKER_PREFIX = '<!-- bakk-etap2:';

const BK_STAGE_ID = 15;
const EXCLUDED_RECRUITMENT_IDS = new Set<number>([65]);
const PAGE_SIZE = 100;

export interface TraffitActivity {
  id?: number;
  note_id?: number;
  type?: { sys_name?: string };
  content?: string | Record<string, unknown>;
  created_by?: { id?: number };
}

export class TraffitNotConfiguredError extends Error {
  constructor() {
    super('Traffit auto-login not configured (TRAFFIT_BASE_URL / TRAFFIT_USERNAME / TRAFFIT_PASSWORD missing)');
    this.name = 'TraffitNotConfiguredError';
  }
}

export class TraffitSessionExpiredError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`Traffit zwrocil HTTP ${status} mimo waznej sesji (re-login takze sie nie powiodl).`);
    this.name = 'TraffitSessionExpiredError';
    this.status = status;
  }
}

export { TraffitLoginError };
export { readLoginConfig as readConfig };

function buildMarker(assessmentId: string): string {
  return `${MARKER_PREFIX}${assessmentId} -->`;
}

function extractInnerContent(rawContent: TraffitActivity['content']): string {
  if (rawContent == null) return '';
  if (typeof rawContent === 'object') {
    const obj = rawContent as { content?: unknown };
    if (typeof obj.content === 'string') return obj.content;
    try { return JSON.stringify(rawContent); } catch { return ''; }
  }
  const s = String(rawContent);
  const trimmed = s.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { content?: unknown };
      if (typeof parsed.content === 'string') return parsed.content;
    } catch {
      // not JSON
    }
  }
  return s;
}

export interface TraffitBkCandidate {
  employeeId: number;
  recruitmentId: number;
  recruitmentName: string;
  fullName: string;
  email: string | null;
}

export interface TraffitClient {
  findExistingNoteId(employeeId: number, assessmentId: string): Promise<number | null>;
  createNote(employeeId: number, contentHtml: string): Promise<number>;
  updateNote(employeeId: number, noteId: number, contentHtml: string): Promise<void>;
  pushAssessmentNote(input: { employeeId: number; assessmentId: string; html: string }): Promise<{ noteId: number; action: 'created' | 'updated' }>;
  listBkCandidates(): Promise<TraffitBkCandidate[]>;
}

export function createTraffitClient(config: TraffitLoginConfig): TraffitClient {
  const baseUrl = config.baseUrl.replace(/\/$/, '');

  async function send(
    method: string,
    path: string,
    opts: { contentType: string; body?: string },
    retried = false,
  ): Promise<Response> {
    const cookie = await getSessionCookie(config);
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': opts.contentType,
        'Accept': 'application/json, text/plain, */*',
        'Cookie': cookie,
      },
      body: opts.body,
    });
    if ((res.status === 401 || res.status === 403) && !retried) {
      invalidateSession();
      return send(method, path, opts, true);
    }
    if (res.status === 401 || res.status === 403) {
      throw new TraffitSessionExpiredError(res.status);
    }
    return res;
  }

  function req(method: string, path: string, body?: unknown): Promise<Response> {
    return send(method, path, {
      contentType: 'application/json',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  function reqForm(path: string, form: string): Promise<Response> {
    return send('POST', path, { contentType: 'application/x-www-form-urlencoded; charset=UTF-8', body: form });
  }

  function recruitmentFilterBody(limit: number, offset: number): string {
    return `limit=${limit}&offset=${offset}`;
  }

  function employeeFilterBody(recruitmentId: number, stageId: number, limit: number, offset: number): string {
    const p = new URLSearchParams();
    p.append('limit', String(limit));
    p.append('offset', String(offset));
    p.append('grid[filter][andOr]', 'and');
    p.append('grid[filter][fields][0][field]', 'customEmployeeRecruitment.clientWithJobStatus');
    p.append('grid[filter][fields][0][comparision]', 'custom');
    p.append('grid[filter][fields][0][type]', 'assigned');
    p.append('grid[filter][fields][0][values][job.id][]', String(recruitmentId));
    p.append('grid[filter][fields][1][field]', 'customEmployeeRecruitment.stage');
    p.append('grid[filter][fields][1][comparision]', 'custom');
    p.append('grid[filter][fields][1][type]', 'reached');
    p.append('grid[filter][fields][1][values][current]', '1');
    p.append('grid[filter][fields][1][values][stage.id][]', String(stageId));
    p.append('grid[sort][fields][0][field]', 'createdAt');
    p.append('grid[sort][fields][0][direction]', 'desc');
    return p.toString();
  }

  // Traffit potrafi zwrocic 200 + {logged:false} albo non-JSON na wygaslej sesji
  // (osobno od 401/403). Wtedy invalidacja + jeden retry.
  async function fetchAllPages(
    path: string,
    buildBody: (limit: number, offset: number) => string,
    retriedSession = false,
  ): Promise<Array<Record<string, unknown>>> {
    const all: Array<Record<string, unknown>> = [];
    let offset = 0;
    let total = Infinity;
    while (offset < total) {
      const res = await reqForm(path, buildBody(PAGE_SIZE, offset));
      const ct = res.headers.get('content-type') ?? '';
      if (!res.ok || !ct.includes('application/json')) {
        if (!retriedSession) { invalidateSession(); return fetchAllPages(path, buildBody, true); }
        throw new TraffitSessionExpiredError(res.status);
      }
      const page = (await res.json()) as { items?: unknown; count?: unknown; logged?: boolean };
      if (page && page.logged === false) {
        if (!retriedSession) { invalidateSession(); return fetchAllPages(path, buildBody, true); }
        throw new TraffitSessionExpiredError(200);
      }
      const items = Array.isArray(page.items) ? (page.items as Array<Record<string, unknown>>) : [];
      total = typeof page.count === 'number' ? page.count : items.length;
      all.push(...items);
      if (items.length === 0) break;
      offset += items.length;
    }
    return all;
  }

  return {
    async findExistingNoteId(employeeId, assessmentId) {
      const res = await req('GET', `/api/v2/employees/${employeeId}/activities`);
      if (!res.ok) throw new Error(`activities(${employeeId}) failed: ${res.status}`);
      const activities = (await res.json()) as TraffitActivity[];
      if (!Array.isArray(activities)) return null;
      const marker = buildMarker(assessmentId);
      for (const a of activities) {
        if (a.type?.sys_name !== 'note' || !a.note_id) continue;
        if (extractInnerContent(a.content).includes(marker)) return a.note_id;
      }
      return null;
    },

    async createNote(employeeId, contentHtml) {
      const res = await req('POST', `/api/v2/employees/${employeeId}/notes`, { content: contentHtml });
      if (res.status !== 201) {
        const err = await res.text();
        throw new Error(`createNote(${employeeId}) failed: ${res.status} ${err.slice(0, 200)}`);
      }
      const body = (await res.json()) as { id?: number };
      if (typeof body.id !== 'number') throw new Error('createNote: brak id w odpowiedzi');
      return body.id;
    },

    async updateNote(employeeId, noteId, contentHtml) {
      const res = await req('PUT', `/api/v2/employees/${employeeId}/notes/${noteId}`, { content: contentHtml });
      if (res.status !== 204) {
        const err = await res.text();
        throw new Error(`updateNote(${employeeId},${noteId}) failed: ${res.status} ${err.slice(0, 200)}`);
      }
    },

    async pushAssessmentNote({ employeeId, assessmentId, html }) {
      const existing = await this.findExistingNoteId(employeeId, assessmentId);
      if (existing != null) {
        await this.updateNote(employeeId, existing, html);
        return { noteId: existing, action: 'updated' };
      }
      const noteId = await this.createNote(employeeId, html);
      return { noteId, action: 'created' };
    },

    async listBkCandidates() {
      const recs = await fetchAllPages('/api/recruitment/filter', recruitmentFilterBody);
      const open = recs
        .map((r) => ({
          id: Number(r.id),
          name: typeof r.name === 'string' ? r.name : `Rekrutacja ${r.id}`,
          isClosed: Boolean(r.isClosed),
        }))
        .filter((r) => Number.isFinite(r.id) && !r.isClosed && !EXCLUDED_RECRUITMENT_IDS.has(r.id));

      const out: TraffitBkCandidate[] = [];
      for (const rec of open) {
        const items = await fetchAllPages('/api/employee/filter', (limit, offset) =>
          employeeFilterBody(rec.id, BK_STAGE_ID, limit, offset));
        for (const it of items) {
          const ars = Array.isArray(it.activeRecruitments)
            ? (it.activeRecruitments as Array<Record<string, unknown>>)
            : [];
          const ar = ars.find((r) => {
            const recObj = (r.recruitment ?? r.job) as { id?: unknown } | undefined;
            return Number(recObj?.id) === rec.id;
          });
          const state = ar?.state as { id?: unknown; color?: unknown } | undefined;
          if (!state || Number(state.id) !== BK_STAGE_ID) continue;
          if (state.color === 'red') continue;
          const lastname = typeof it.lastname === 'string' ? it.lastname : '';
          const firstname = typeof it.name === 'string' ? it.name : '';
          const fullName = `${lastname} ${firstname}`.trim() || `#${it.id}`;
          out.push({
            employeeId: Number(it.id),
            recruitmentId: rec.id,
            recruitmentName: rec.name,
            fullName,
            email: typeof it.email === 'string' ? it.email : null,
          });
        }
      }
      out.sort((a, b) => a.employeeId - b.employeeId);
      return out;
    },
  };
}
