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

export interface TraffitClient {
  findExistingNoteId(employeeId: number, assessmentId: string): Promise<number | null>;
  createNote(employeeId: number, contentHtml: string): Promise<number>;
  updateNote(employeeId: number, noteId: number, contentHtml: string): Promise<void>;
  pushAssessmentNote(input: { employeeId: number; assessmentId: string; html: string }): Promise<{ noteId: number; action: 'created' | 'updated' }>;
}

export function createTraffitClient(config: TraffitLoginConfig): TraffitClient {
  const baseUrl = config.baseUrl.replace(/\/$/, '');

  async function req(method: string, path: string, body?: unknown, retried = false): Promise<Response> {
    const cookie = await getSessionCookie(config);
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Cookie': cookie,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if ((res.status === 401 || res.status === 403) && !retried) {
      invalidateSession();
      return req(method, path, body, true);
    }
    if (res.status === 401 || res.status === 403) {
      throw new TraffitSessionExpiredError(res.status);
    }
    return res;
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
  };
}
