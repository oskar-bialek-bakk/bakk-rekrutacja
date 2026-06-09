# Wybór kandydata z Traffit w „Nowej rozmowie" — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rekruter wybiera kandydata (z etapu „Spotkanie BK") z dropdownu w formularzu „Nowa rozmowa", dzięki czemu podsumowanie trafia do Traffit bez ręcznego wpisywania ID; ręczne wprowadzanie zostaje jako alternatywa.

**Architecture:** Cienki backend (Azure Functions) reużywa sesji konta technicznego Traffit i replikuje sprawdzony z `traffit-scorer` filtr `POST /api/recruitment/filter` + `POST /api/employee/filter`, zwracając kandydatów z etapu `stage.id=15` ze wszystkich otwartych rekrutacji (poza 65). Frontend (vanilla TS) dostaje listę przez nowy serwis, pokazuje dropdown w „Nowej rozmowie" i picker przy wysyłce (auto-dopasowanie po nazwisku dla starych wpisów). Logika czysta (filtr/sort/dopasowanie) oddzielona od DOM.

**Tech Stack:** Vite + TypeScript (vanilla), Vitest + jsdom, Azure Functions v4, Zod. Spec: `docs/superpowers/specs/2026-06-09-traffit-wybor-kandydata-design.md`.

**Stałe (discovery 2026-06-09):** `BK_STAGE_ID = 15`, nazwa etapu „Spotkanie BK", `EXCLUDED_RECRUITMENT_IDS = [65]` (Inside Sales). Workflow.id=1 wspólny dla otwartych rekrutacji dev, więc stage 15 jest spójny.

---

## Mapa plików

**Tworzone:**
- `etap2/src/domain/traffit-roster.ts` — typ `TraffitCandidate` + czyste helpery `selectableCandidates`, `bestNameMatch`.
- `etap2/src/persistence/traffit-candidates.ts` — serwis `fetchTraffitCandidates()`.
- `etap2/api/src/functions/traffit-candidates.ts` — endpoint `GET /api/v1/traffit/candidates`.
- `etap2/tests/traffit-roster.test.ts`, `etap2/tests/traffit-candidates.test.ts`, `etap2/tests/screen-start.test.ts`.
- `etap2/api/tests/traffit-candidates.test.ts`.

**Modyfikowane:**
- `etap2/src/domain/model.ts` — `Candidate` + 3 opcjonalne pola.
- `etap2/src/persistence/migrations.ts` — `ensureCandidate` zachowuje nowe pola.
- `etap2/src/state.ts` — eksport `isOnline`.
- `etap2/api/src/lib/traffit-client.ts` — url-encoded `send`/`reqForm`, `listBkCandidates`.
- `etap2/src/ui/screen-start.ts` — dropdown + przełącznik ręczny.
- `etap2/src/ui/recruiter-preview-dialog.ts` — push bez pytania / picker z auto-matchem.
- `etap2/src/domain/recruiter-summary.ts` — nazwa rekrutacji w nagłówku notatki.
- `etap2/README-deploy.md` — notka o stałej etapu + jak ponowić discovery.

---

## Task 1: Model — opcjonalne pola Traffit w `Candidate`

**Files:**
- Modify: `etap2/src/domain/model.ts:7-12`
- Modify: `etap2/src/persistence/migrations.ts:18-26`
- Test: `etap2/tests/model.test.ts`, `etap2/tests/migrations.test.ts`

- [ ] **Step 1: Test — `createEmptyAssessment` zachowuje pola Traffit**

W `etap2/tests/model.test.ts` dodaj:

```typescript
it('createEmptyAssessment zachowuje opcjonalne pola Traffit', () => {
  const a = createEmptyAssessment('id-1', {
    nameOrId: 'Kowalski Jan', date: '2026-06-09', stage1Result: '', stage1Note: '',
    traffitId: 4242, recruitmentId: 63, recruitmentName: 'C# SQL 05-2026',
  });
  expect(a.candidate.traffitId).toBe(4242);
  expect(a.candidate.recruitmentId).toBe(63);
  expect(a.candidate.recruitmentName).toBe('C# SQL 05-2026');
});
```

- [ ] **Step 2: Uruchom test — ma FAILOWAĆ**

Run: `cd etap2 && npx vitest run tests/model.test.ts -t "pola Traffit"`
Expected: FAIL (TS: `traffitId` nie istnieje na typie / wartość undefined).

- [ ] **Step 3: Dodaj pola do `Candidate`**

W `etap2/src/domain/model.ts` zamień interfejs `Candidate`:

```typescript
export interface Candidate {
  nameOrId: string;
  date: string;
  stage1Result: string;
  stage1Note: string;
  traffitId?: number;        // employeeId w Traffit
  recruitmentId?: number;    // job.id w Traffit
  recruitmentName?: string;  // etykieta + nagłówek notatki
}
```

`createEmptyAssessment` przyjmuje `candidate: Candidate` i przypisuje go wprost, więc nowe pola przechodzą bez zmian w ciele funkcji.

- [ ] **Step 4: Uruchom test — ma PRZEJŚĆ**

Run: `cd etap2 && npx vitest run tests/model.test.ts -t "pola Traffit"`
Expected: PASS.

- [ ] **Step 5: Test — migracja zachowuje pola i defaultuje brak**

W `etap2/tests/migrations.test.ts` dodaj:

```typescript
it('ensureCandidate zachowuje pola Traffit gdy są', () => {
  const a = migrateAssessment({ id: 'x', candidate: {
    nameOrId: 'A', date: '', stage1Result: '', stage1Note: '',
    traffitId: 7, recruitmentId: 63, recruitmentName: 'R',
  }});
  expect(a.candidate.traffitId).toBe(7);
  expect(a.candidate.recruitmentId).toBe(63);
  expect(a.candidate.recruitmentName).toBe('R');
});

it('ensureCandidate zostawia pola Traffit undefined gdy brak', () => {
  const a = migrateAssessment({ id: 'x', candidate: { nameOrId: 'A', date: '', stage1Result: '', stage1Note: '' }});
  expect(a.candidate.traffitId).toBeUndefined();
  expect(a.candidate.recruitmentId).toBeUndefined();
  expect(a.candidate.recruitmentName).toBeUndefined();
});
```

- [ ] **Step 6: Uruchom — ma FAILOWAĆ**

Run: `cd etap2 && npx vitest run tests/migrations.test.ts -t "Traffit"`
Expected: FAIL (pola gubione przez `ensureCandidate`).

- [ ] **Step 7: Zaktualizuj `ensureCandidate`**

W `etap2/src/persistence/migrations.ts` zamień funkcję `ensureCandidate`:

```typescript
function ensureCandidate(c: unknown): Candidate {
  const obj = (c ?? {}) as Partial<Candidate>;
  const out: Candidate = {
    nameOrId: obj.nameOrId ?? '',
    date: obj.date ?? '',
    stage1Result: obj.stage1Result ?? '',
    stage1Note: obj.stage1Note ?? '',
  };
  if (typeof obj.traffitId === 'number') out.traffitId = obj.traffitId;
  if (typeof obj.recruitmentId === 'number') out.recruitmentId = obj.recruitmentId;
  if (typeof obj.recruitmentName === 'string') out.recruitmentName = obj.recruitmentName;
  return out;
}
```

- [ ] **Step 8: Uruchom — ma PRZEJŚĆ**

Run: `cd etap2 && npx vitest run tests/migrations.test.ts tests/model.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add etap2/src/domain/model.ts etap2/src/persistence/migrations.ts etap2/tests/model.test.ts etap2/tests/migrations.test.ts
git commit -m "feat(etap2): opcjonalne pola Traffit (traffitId/recruitmentId/recruitmentName) w Candidate"
```

---

## Task 2: Domena — czyste helpery `traffit-roster.ts`

**Files:**
- Create: `etap2/src/domain/traffit-roster.ts`
- Test: `etap2/tests/traffit-roster.test.ts`

- [ ] **Step 1: Test — `selectableCandidates` filtruje pary z rosteru i sortuje po employeeId**

Utwórz `etap2/tests/traffit-roster.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { selectableCandidates, bestNameMatch, type TraffitCandidate } from '../src/domain/traffit-roster';
import { createEmptyAssessment } from '../src/domain/model';

const c = (employeeId: number, recruitmentId: number, fullName = 'X Y'): TraffitCandidate =>
  ({ employeeId, recruitmentId, recruitmentName: `R${recruitmentId}`, fullName, email: null });

describe('selectableCandidates', () => {
  it('ukrywa pary (traffitId, recruitmentId) już w rosterze, sortuje po employeeId', () => {
    const all = [c(30, 63), c(10, 63), c(10, 62), c(20, 63)];
    const a = createEmptyAssessment('a1', {
      nameOrId: 'X', date: '', stage1Result: '', stage1Note: '', traffitId: 10, recruitmentId: 63,
    });
    const res = selectableCandidates(all, [a]);
    expect(res.map((x) => `${x.employeeId}/${x.recruitmentId}`)).toEqual(['10/62', '20/63', '30/63']);
  });

  it('ta sama osoba w innej rekrutacji nadal się pokazuje', () => {
    const all = [c(10, 62), c(10, 63)];
    const a = createEmptyAssessment('a1', {
      nameOrId: 'X', date: '', stage1Result: '', stage1Note: '', traffitId: 10, recruitmentId: 63,
    });
    expect(selectableCandidates(all, [a]).map((x) => x.recruitmentId)).toEqual([62]);
  });
});

describe('bestNameMatch', () => {
  it('dopasowuje po nazwisku i imieniu ignorując wielkość liter i diakrytyki', () => {
    const all = [c(1, 63, 'Nowak Anna'), c(2, 63, 'Kowalski Łukasz')];
    expect(bestNameMatch(all, 'łukasz kowalski')?.employeeId).toBe(2);
  });

  it('zwraca null gdy brak wspólnych tokenów', () => {
    expect(bestNameMatch([c(1, 63, 'Nowak Anna')], 'Zaradny Piotr')).toBeNull();
  });
});
```

- [ ] **Step 2: Uruchom — ma FAILOWAĆ**

Run: `cd etap2 && npx vitest run tests/traffit-roster.test.ts`
Expected: FAIL (moduł nie istnieje).

- [ ] **Step 3: Implementuj `traffit-roster.ts`**

Utwórz `etap2/src/domain/traffit-roster.ts`:

```typescript
import type { Assessment } from './model';

export interface TraffitCandidate {
  employeeId: number;
  recruitmentId: number;
  recruitmentName: string;
  fullName: string;
  email: string | null;
}

function pairKey(traffitId: number, recruitmentId: number): string {
  return `${traffitId}::${recruitmentId}`;
}

/** Ukrywa pary (traffitId, recruitmentId) już obecne w rosterze; sortuje po employeeId rosnąco. */
export function selectableCandidates(
  all: ReadonlyArray<TraffitCandidate>,
  assessments: ReadonlyArray<Assessment>,
): TraffitCandidate[] {
  const taken = new Set<string>();
  for (const a of assessments) {
    const { traffitId, recruitmentId } = a.candidate;
    if (typeof traffitId === 'number' && typeof recruitmentId === 'number') {
      taken.add(pairKey(traffitId, recruitmentId));
    }
  }
  return all
    .filter((c) => !taken.has(pairKey(c.employeeId, c.recruitmentId)))
    .slice()
    .sort((x, y) => x.employeeId - y.employeeId);
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Najlepsze dopasowanie po wspólnych tokenach (>=3 znaki). Wejście zakładamy posortowane po employeeId. */
export function bestNameMatch(
  all: ReadonlyArray<TraffitCandidate>,
  name: string,
): TraffitCandidate | null {
  const target = new Set(tokens(name));
  if (target.size === 0) return null;
  let best: TraffitCandidate | null = null;
  let bestScore = 0;
  for (const c of all) {
    let score = 0;
    for (const t of tokens(c.fullName)) {
      if (t.length >= 3 && target.has(t)) score++;
    }
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}
```

- [ ] **Step 4: Uruchom — ma PRZEJŚĆ**

Run: `cd etap2 && npx vitest run tests/traffit-roster.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add etap2/src/domain/traffit-roster.ts etap2/tests/traffit-roster.test.ts
git commit -m "feat(etap2): helpery domeny selectableCandidates + bestNameMatch"
```

---

## Task 3: Backend — `listBkCandidates` w `traffit-client.ts`

**Files:**
- Modify: `etap2/api/src/lib/traffit-client.ts`
- Test: `etap2/api/tests/traffit-client.test.ts`

- [ ] **Step 1: Test — lista kandydatów BK z dwóch rekrutacji, filtr etapu i odrzuconych**

W `etap2/api/tests/traffit-client.test.ts` dodaj na końcu pliku, w ramach `describe('TraffitClient', ...)`:

```typescript
it('listBkCandidates: zwraca tylko stage 15 non-rejected, pomija rekrutacje 65, sortuje po employeeId', async () => {
  fetchMock.mockImplementation(async (url: string, init: { body?: string }) => {
    const u = String(url);
    if (u.endsWith('/api/recruitment/filter')) {
      return resp(200, { count: 3, items: [
        { id: 63, name: 'C# SQL 05-2026', isClosed: false },
        { id: 65, name: 'Inside Sales', isClosed: false },
        { id: 61, name: 'Stara', isClosed: true },
      ]});
    }
    if (u.endsWith('/api/employee/filter')) {
      const body = init.body ?? '';
      const recId = body.includes('job.id%5D%5B%5D=63') || body.includes('job.id][]=63') ? 63 : 0;
      if (recId === 63) {
        return resp(200, { count: 3, items: [
          { id: 30, name: 'Anna', lastname: 'Nowak', email: 'a@x.pl',
            activeRecruitments: [{ recruitment: { id: 63 }, state: { id: 15, name: 'Spotkanie BK', color: 'green' } }] },
          { id: 10, name: 'Jan', lastname: 'Kowalski', email: null,
            activeRecruitments: [{ recruitment: { id: 63 }, state: { id: 15, name: 'Spotkanie BK', color: 'red' } }] },
          { id: 20, name: 'Ewa', lastname: 'Lis', email: null,
            activeRecruitments: [{ recruitment: { id: 63 }, state: { id: 4, name: 'Spotkanie techniczne', color: 'green' } }] },
        ]});
      }
    }
    return resp(200, { count: 0, items: [] });
  });

  const c = createTraffitClient(config);
  const list = await c.listBkCandidates();
  expect(list).toEqual([
    { employeeId: 30, recruitmentId: 63, recruitmentName: 'C# SQL 05-2026', fullName: 'Nowak Anna', email: 'a@x.pl' },
  ]);
});
```

(Odrzuca: id 10 = color red, id 20 = inny stage, rekrutacja 65 = excluded, 61 = closed.)

- [ ] **Step 2: Uruchom — ma FAILOWAĆ**

Run: `cd etap2/api && npx vitest run tests/traffit-client.test.ts -t "listBkCandidates"`
Expected: FAIL (`listBkCandidates` nie istnieje).

- [ ] **Step 3: Dodaj url-encoded transport + `listBkCandidates`**

W `etap2/api/src/lib/traffit-client.ts`:

Na górze pliku (po `const MARKER_PREFIX = ...`) dodaj stałe:

```typescript
const BK_STAGE_ID = 15;
const EXCLUDED_RECRUITMENT_IDS = new Set<number>([65]);
const PAGE_SIZE = 100;
```

Rozszerz typ `TraffitClient` o metodę:

```typescript
export interface TraffitBkCandidate {
  employeeId: number;
  recruitmentId: number;
  recruitmentName: string;
  fullName: string;
  email: string | null;
}
```

i w interfejsie `TraffitClient` dopisz:

```typescript
  listBkCandidates(): Promise<TraffitBkCandidate[]>;
```

W `createTraffitClient` zamień funkcję `req` na wspólny `send` + dwa wrappery (zachowuje dotychczasowe zachowanie JSON):

```typescript
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
```

Dodaj budowniki body i paginację (wzór z `traffit-scorer/src/fetch.js` i `recruitments-fetch.js`):

```typescript
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

  // Traffit potrafi zwrócić 200 + {logged:false} albo non-JSON na wygasłej sesji
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
```

W zwracanym obiekcie `createTraffitClient` dodaj metodę:

```typescript
    async listBkCandidates() {
      const recs = await fetchAllPages('/api/recruitment/filter', recruitmentFilterBody);
      const open = recs
        .map((r) => ({ id: Number(r.id), name: typeof r.name === 'string' ? r.name : `Rekrutacja ${r.id}`, isClosed: Boolean(r.isClosed) }))
        .filter((r) => Number.isFinite(r.id) && !r.isClosed && !EXCLUDED_RECRUITMENT_IDS.has(r.id));

      const out: TraffitBkCandidate[] = [];
      for (const rec of open) {
        const items = await fetchAllPages('/api/employee/filter', (limit, offset) =>
          employeeFilterBody(rec.id, BK_STAGE_ID, limit, offset));
        for (const it of items) {
          const ars = Array.isArray(it.activeRecruitments) ? (it.activeRecruitments as Array<Record<string, unknown>>) : [];
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
```

- [ ] **Step 4: Uruchom — ma PRZEJŚĆ (i nie psuje istniejących testów klienta)**

Run: `cd etap2/api && npx vitest run tests/traffit-client.test.ts`
Expected: PASS (wszystkie, łącznie z `przekazuje Cookie header` i retry 401).

- [ ] **Step 5: Commit**

```bash
git add etap2/api/src/lib/traffit-client.ts etap2/api/tests/traffit-client.test.ts
git commit -m "feat(etap2): listBkCandidates w traffit-client (recruitment+employee filter, stage 15)"
```

---

## Task 4: Backend — endpoint `GET /api/v1/traffit/candidates`

**Files:**
- Create: `etap2/api/src/functions/traffit-candidates.ts`
- Test: `etap2/api/tests/traffit-candidates.test.ts`

- [ ] **Step 1: Test — 200 z listą, 501 bez configu, 401 bez usera**

Utwórz `etap2/api/tests/traffit-candidates.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const listBkCandidates = vi.fn();
const readConfig = vi.fn();

vi.mock('../src/lib/traffit-client.js', () => ({
  readConfig: () => readConfig(),
  createTraffitClient: () => ({ listBkCandidates }),
  TraffitNotConfiguredError: class extends Error { constructor() { super('not configured'); this.name = 'TraffitNotConfiguredError'; } },
  TraffitSessionExpiredError: class extends Error { status = 502; },
  TraffitLoginError: class extends Error {},
}));

const ctx = { error: vi.fn(), warn: vi.fn() } as never;

function fakeReq(opts: { upn?: string; oid?: string }) {
  const h = new Map<string, string>();
  if (opts.upn) h.set('x-ms-client-principal-name', opts.upn);
  if (opts.oid) h.set('x-ms-client-principal-id', opts.oid);
  return { headers: { get: (k: string) => h.get(k.toLowerCase()) ?? null } };
}

beforeEach(() => { listBkCandidates.mockReset(); readConfig.mockReset(); });
afterEach(() => { vi.clearAllMocks(); });

describe('traffitCandidates', () => {
  it('200 zwraca listę kandydatów', async () => {
    readConfig.mockReturnValue({ baseUrl: 'https://t', username: 'u', password: 'p' });
    listBkCandidates.mockResolvedValue([
      { employeeId: 30, recruitmentId: 63, recruitmentName: 'R', fullName: 'Nowak Anna', email: null },
    ]);
    const { traffitCandidates } = await import('../src/functions/traffit-candidates.js');
    const res = await traffitCandidates(fakeReq({ upn: 'a@bakk.com', oid: 'o' }) as never, ctx);
    expect(res.status).toBe(200);
    expect((res.jsonBody as { candidates: unknown[] }).candidates).toHaveLength(1);
  });

  it('501 gdy Traffit nieskonfigurowany', async () => {
    readConfig.mockReturnValue(null);
    const { traffitCandidates } = await import('../src/functions/traffit-candidates.js');
    const res = await traffitCandidates(fakeReq({ upn: 'a@bakk.com', oid: 'o' }) as never, ctx);
    expect(res.status).toBe(501);
  });

  it('401 gdy brak usera', async () => {
    readConfig.mockReturnValue({ baseUrl: 'https://t', username: 'u', password: 'p' });
    const { traffitCandidates } = await import('../src/functions/traffit-candidates.js');
    const res = await traffitCandidates(fakeReq({}) as never, ctx);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Uruchom — ma FAILOWAĆ**

Run: `cd etap2/api && npx vitest run tests/traffit-candidates.test.ts`
Expected: FAIL (moduł nie istnieje).

- [ ] **Step 3: Implementuj endpoint**

Utwórz `etap2/api/src/functions/traffit-candidates.ts`:

```typescript
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireUser } from '../lib/auth.js';
import { errorResponse, jsonResponse } from '../lib/http.js';
import {
  TraffitLoginError,
  TraffitNotConfiguredError,
  TraffitSessionExpiredError,
  createTraffitClient,
  readConfig,
} from '../lib/traffit-client.js';

export async function traffitCandidates(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    requireUser(req);
    const config = readConfig();
    if (!config) throw new TraffitNotConfiguredError();

    const client = createTraffitClient(config);
    const candidates = await client.listBkCandidates();
    return jsonResponse(200, { candidates });
  } catch (err) {
    if (err instanceof TraffitNotConfiguredError) {
      ctx.warn('Traffit candidates attempted but not configured');
      return jsonResponse(501, { error: err.message });
    }
    if (err instanceof TraffitSessionExpiredError) {
      ctx.warn(err.message);
      return jsonResponse(502, { error: err.message });
    }
    if (err instanceof TraffitLoginError) {
      ctx.error('Traffit login failed', err);
      return jsonResponse(502, { error: `Traffit login: ${err.message}` });
    }
    ctx.error('traffitCandidates failed', err);
    return errorResponse(err);
  }
}

app.http('traffit-candidates', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'v1/traffit/candidates',
  handler: traffitCandidates,
});
```

- [ ] **Step 4: Uruchom — ma PRZEJŚĆ**

Run: `cd etap2/api && npx vitest run tests/traffit-candidates.test.ts`
Expected: PASS.

- [ ] **Step 5: Build backendu (sanity TS)**

Run: `cd etap2/api && npm run build`
Expected: brak błędów TS.

- [ ] **Step 6: Commit**

```bash
git add etap2/api/src/functions/traffit-candidates.ts etap2/api/tests/traffit-candidates.test.ts
git commit -m "feat(etap2): endpoint GET /api/v1/traffit/candidates"
```

---

## Task 5: Frontend — serwis `traffit-candidates.ts` + `isOnline`

**Files:**
- Create: `etap2/src/persistence/traffit-candidates.ts`
- Modify: `etap2/src/state.ts:12`
- Test: `etap2/tests/traffit-candidates.test.ts`

- [ ] **Step 1: Test — serwis mapuje odpowiedź i robi retry na 401**

Utwórz `etap2/tests/traffit-candidates.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/auth/access-token', () => ({
  getAccessToken: vi.fn(async () => 'tok'),
  forceRefresh: vi.fn(),
}));

import { fetchTraffitCandidates } from '../src/persistence/traffit-candidates';
import { forceRefresh } from '../src/auth/access-token';

const fetchMock = vi.fn();
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('fetchTraffitCandidates', () => {
  it('zwraca listę kandydatów', async () => {
    fetchMock.mockResolvedValue(ok({ candidates: [
      { employeeId: 30, recruitmentId: 63, recruitmentName: 'R', fullName: 'Nowak Anna', email: null },
    ]}));
    const res = await fetchTraffitCandidates({ baseUrl: 'https://api' });
    expect(res).toHaveLength(1);
    expect(res[0].employeeId).toBe(30);
  });

  it('na 401 robi forceRefresh i ponawia', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(ok({ candidates: [] }));
    await fetchTraffitCandidates({ baseUrl: 'https://api' });
    expect(forceRefresh).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Uruchom — ma FAILOWAĆ**

Run: `cd etap2 && npx vitest run tests/traffit-candidates.test.ts`
Expected: FAIL (moduł nie istnieje).

- [ ] **Step 3: Implementuj serwis**

Utwórz `etap2/src/persistence/traffit-candidates.ts`:

```typescript
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
```

- [ ] **Step 4: Uruchom — ma PRZEJŚĆ**

Run: `cd etap2 && npx vitest run tests/traffit-candidates.test.ts`
Expected: PASS.

- [ ] **Step 5: Dodaj `isOnline` do `state.ts`**

W `etap2/src/state.ts` po linii `export const repo: Repository = createRepo();` dodaj:

```typescript
/** Czy backend (Azure) jest aktywny — bramka funkcji Traffit (lista + push). */
export const isOnline: boolean = repo instanceof AzureStore;
```

- [ ] **Step 6: Uruchom pełny zestaw FE (sanity)**

Run: `cd etap2 && npx vitest run tests/traffit-candidates.test.ts tests/state.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add etap2/src/persistence/traffit-candidates.ts etap2/src/state.ts etap2/tests/traffit-candidates.test.ts
git commit -m "feat(etap2): serwis fetchTraffitCandidates + flaga isOnline"
```

---

## Task 6: „Nowa rozmowa" — dropdown Traffit + przełącznik ręczny

**Files:**
- Modify: `etap2/src/ui/screen-start.ts`
- Modify: `etap2/src/ui/theme.css` (drobny styl przełącznika)
- Test: `etap2/tests/screen-start.test.ts`

- [ ] **Step 1: Test — render dropdownu, ukrycie pary z rosteru, przełącznik ręczny, zapis pól**

Utwórz `etap2/tests/screen-start.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEmptyAssessment } from '../src/domain/model';
import type { TraffitCandidate } from '../src/domain/traffit-roster';

const findAll = vi.fn();
const getVariantUsage = vi.fn(async () => ({}));
const navigate = vi.fn();
const fetchTraffitCandidates = vi.fn();

const session = { current: null as unknown, cur: 0, visited: new Set(), editing: false };

vi.mock('../src/state', () => ({
  repo: { findAll: () => findAll(), getVariantUsage: () => getVariantUsage() },
  session,
  isOnline: true,
}));
vi.mock('../src/app', () => ({ navigate: (s: string) => navigate(s), render: vi.fn() }));
vi.mock('../src/ui/migration-banner', () => ({ renderMigrationBanner: vi.fn() }));
vi.mock('../src/ui/timer-ui', () => ({ startTimer: vi.fn() }));
vi.mock('../src/persistence/traffit-candidates', () => ({
  fetchTraffitCandidates: () => fetchTraffitCandidates(),
}));

import { renderStart } from '../src/ui/screen-start';

const cand = (employeeId: number, recruitmentId: number, fullName: string): TraffitCandidate =>
  ({ employeeId, recruitmentId, recruitmentName: `R${recruitmentId}`, fullName, email: null });

beforeEach(() => {
  document.body.innerHTML = '';
  findAll.mockResolvedValue([]);
  fetchTraffitCandidates.mockResolvedValue([cand(10, 63, 'Kowalski Jan'), cand(30, 63, 'Nowak Anna')]);
  navigate.mockReset();
});
afterEach(() => { vi.clearAllMocks(); });

async function flush(): Promise<void> { await Promise.resolve(); await Promise.resolve(); }

describe('renderStart dropdown Traffit', () => {
  it('renderuje opcje kandydatów posortowane po employeeId', async () => {
    const host = document.createElement('div');
    await renderStart(host);
    await flush();
    const opts = Array.from(host.querySelectorAll('#traffit-pick option')).map((o) => o.textContent);
    expect(opts.some((t) => t?.includes('Kowalski Jan'))).toBe(true);
    expect(opts.some((t) => t?.includes('Nowak Anna') && t?.includes('R63'))).toBe(true);
  });

  it('ukrywa kandydata już dodanego w rosterze (para traffitId+recruitmentId)', async () => {
    findAll.mockResolvedValue([createEmptyAssessment('a1', {
      nameOrId: 'Kowalski Jan', date: '', stage1Result: '', stage1Note: '', traffitId: 10, recruitmentId: 63,
    })]);
    const host = document.createElement('div');
    await renderStart(host);
    await flush();
    const opts = Array.from(host.querySelectorAll('#traffit-pick option')).map((o) => o.textContent ?? '');
    expect(opts.some((t) => t.includes('Kowalski Jan'))).toBe(false);
    expect(opts.some((t) => t.includes('Nowak Anna'))).toBe(true);
  });

  it('wybór z dropdownu zapisuje traffitId/recruitmentId/recruitmentName w sesji po starcie', async () => {
    const host = document.createElement('div');
    await renderStart(host);
    await flush();
    const sel = host.querySelector('#traffit-pick') as HTMLSelectElement;
    sel.value = '30::63';
    sel.dispatchEvent(new Event('change'));
    (host.querySelector('#btn-start') as HTMLButtonElement).click();
    const a = session.current as ReturnType<typeof createEmptyAssessment>;
    expect(a.candidate.traffitId).toBe(30);
    expect(a.candidate.recruitmentId).toBe(63);
    expect(a.candidate.recruitmentName).toBe('R63');
    expect(a.candidate.nameOrId).toBe('Nowak Anna');
  });

  it('przełącznik "wprowadź ręcznie" pokazuje pole tekstowe i czyści wybór', async () => {
    const host = document.createElement('div');
    await renderStart(host);
    await flush();
    (host.querySelector('#manual-toggle') as HTMLButtonElement).click();
    const nameField = host.querySelector('#in-name') as HTMLInputElement;
    expect(nameField.closest('.field')?.hasAttribute('hidden')).toBe(false);
    nameField.value = 'Ręczny Kandydat';
    (host.querySelector('#btn-start') as HTMLButtonElement).click();
    const a = session.current as ReturnType<typeof createEmptyAssessment>;
    expect(a.candidate.nameOrId).toBe('Ręczny Kandydat');
    expect(a.candidate.traffitId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Uruchom — ma FAILOWAĆ**

Run: `cd etap2 && npx vitest run tests/screen-start.test.ts`
Expected: FAIL (brak `#traffit-pick` / `#manual-toggle`, brak importów).

- [ ] **Step 3: Zmodyfikuj `screen-start.ts`**

W `etap2/src/ui/screen-start.ts` zmień importy (dodaj):

```typescript
import { isOnline, repo, session } from '../state';
import { selectableCandidates, type TraffitCandidate } from '../domain/traffit-roster';
import { fetchTraffitCandidates } from '../persistence/traffit-candidates';
```

(usuń poprzedni `import { repo, session } from '../state';`).

W `host.innerHTML` zamień blok pola nazwy. Zamiast:

```html
      <div class="field"><label for="in-name">Kandydat — imię i nazwisko / ID</label><input id="in-name"></div>
```

wstaw:

```html
      <div class="field" id="traffit-pick-field" hidden>
        <label for="traffit-pick">Kandydat z Traffit (etap Spotkanie BK)</label>
        <select id="traffit-pick"><option value="">— wybierz kandydata —</option></select>
        <button type="button" class="btn ghost manual-link" id="manual-toggle" title="Wprowadź dane ręcznie">✎ wprowadź ręcznie</button>
        <div id="traffit-pick-status" class="hint"></div>
      </div>
      <div class="field" id="manual-name-field"><label for="in-name">Kandydat — imię i nazwisko / ID</label><input id="in-name"></div>
```

Przed handlerem `#btn-start` dodaj logikę ładowania listy i przełącznika. Wstaw tuż przed `(host.querySelector('#btn-start') as HTMLButtonElement).onclick = ...`:

```typescript
  // Wybrany kandydat z Traffit (null = tryb ręczny / brak wyboru).
  let picked: TraffitCandidate | null = null;

  const traffitField = host.querySelector('#traffit-pick-field') as HTMLElement;
  const manualField = host.querySelector('#manual-name-field') as HTMLElement;
  const pickSelect = host.querySelector('#traffit-pick') as HTMLSelectElement;
  const pickStatus = host.querySelector('#traffit-pick-status') as HTMLElement;
  const nameInput = host.querySelector('#in-name') as HTMLInputElement;

  const showManual = (): void => {
    picked = null;
    traffitField.hidden = true;
    manualField.hidden = false;
    nameInput.focus();
  };

  (host.querySelector('#manual-toggle') as HTMLButtonElement).onclick = showManual;

  if (isOnline) {
    // Domyślnie ukryj pole ręczne; pokaż dropdown po załadowaniu listy.
    manualField.hidden = true;
    traffitField.hidden = false;
    pickStatus.textContent = 'Ładuję kandydatów z Traffit…';
    void (async () => {
      try {
        const [all, assessments] = await Promise.all([fetchTraffitCandidates(), repo.findAll()]);
        const list = selectableCandidates(all, assessments);
        if (list.length === 0) {
          pickStatus.textContent = 'Brak kandydatów na etapie „Spotkanie BK". Wprowadź dane ręcznie.';
          showManual();
          return;
        }
        const byKey = new Map<string, TraffitCandidate>();
        for (const c of list) {
          const key = `${c.employeeId}::${c.recruitmentId}`;
          byKey.set(key, c);
          const opt = document.createElement('option');
          opt.value = key;
          opt.textContent = `${c.fullName} — ${c.recruitmentName}`;
          pickSelect.appendChild(opt);
        }
        pickStatus.textContent = '';
        pickSelect.onchange = () => {
          picked = byKey.get(pickSelect.value) ?? null;
          if (picked) nameInput.value = picked.fullName;
        };
      } catch {
        pickStatus.textContent = 'Nie udało się pobrać listy z Traffit. Wprowadź dane ręcznie.';
        showManual();
      }
    })();
  }
```

W handlerze `#btn-start` zamień budowę kandydata. Zamiast obecnego `createEmptyAssessment(crypto.randomUUID(), { nameOrId: ..., date, stage1Result, stage1Note })` użyj:

```typescript
    const a = createEmptyAssessment(crypto.randomUUID(), {
      nameOrId: (host.querySelector('#in-name') as HTMLInputElement).value || picked?.fullName || '(bez nazwy)',
      date: (host.querySelector('#in-date') as HTMLInputElement).value,
      stage1Result: (host.querySelector('#in-stage1') as HTMLInputElement).value,
      stage1Note: (host.querySelector('#in-stage1-note') as HTMLTextAreaElement).value,
      ...(picked
        ? { traffitId: picked.employeeId, recruitmentId: picked.recruitmentId, recruitmentName: picked.recruitmentName }
        : {}),
    });
```

(reszta handlera `#btn-start` bez zmian).

- [ ] **Step 4: Dodaj drobny styl przełącznika**

W `etap2/src/ui/theme.css` dopisz na końcu:

```css
.manual-link { margin-left: .5rem; font-size: .85em; }
#traffit-pick-status.hint { font-size: .85em; opacity: .75; margin-top: .25rem; }
```

- [ ] **Step 5: Uruchom — ma PRZEJŚĆ**

Run: `cd etap2 && npx vitest run tests/screen-start.test.ts`
Expected: PASS.

- [ ] **Step 6: Build FE (sanity TS)**

Run: `cd etap2 && npm run build`
Expected: brak błędów TS.

- [ ] **Step 7: Commit**

```bash
git add etap2/src/ui/screen-start.ts etap2/src/ui/theme.css etap2/tests/screen-start.test.ts
git commit -m "feat(etap2): dropdown kandydatow Traffit + przelacznik reczny w Nowej rozmowie"
```

---

## Task 7: Wysyłka — push bez pytania / picker z auto-matchem

**Files:**
- Modify: `etap2/src/ui/recruiter-preview-dialog.ts`
- Test: `etap2/tests/recruiter-preview-dialog.test.ts`

- [ ] **Step 1: Test — push bez pytania gdy traffitId; picker+auto-match gdy brak**

W `etap2/tests/recruiter-preview-dialog.test.ts` dodaj mocki na górze (po istniejących importach) oraz testy. Najpierw zamień import sekcji na wersję z mockami:

```typescript
const pushToTraffit = vi.fn();
const fetchTraffitCandidates = vi.fn();
const save = vi.fn();

vi.mock('../src/persistence/traffit-api', () => ({
  pushToTraffit: (x: unknown) => pushToTraffit(x),
  TraffitPushError: class extends Error { status = 0; },
}));
vi.mock('../src/persistence/traffit-candidates', () => ({
  fetchTraffitCandidates: () => fetchTraffitCandidates(),
}));
vi.mock('../src/state', () => ({
  repo: { save: (a: unknown) => save(a) },
  isOnline: true,
}));
```

Następnie dodaj testy:

```typescript
describe('openRecruiterPreview — Traffit push', () => {
  beforeEach(() => { pushToTraffit.mockReset(); fetchTraffitCandidates.mockReset(); save.mockReset(); });

  it('z traffitId wysyła bez pytania', async () => {
    pushToTraffit.mockResolvedValue({ noteId: 1, action: 'created' });
    const a = makeAssessment();
    a.candidate.traffitId = 30;
    a.candidate.recruitmentId = 63;
    void openRecruiterPreview(a, settings());
    (document.querySelector('#recruiter-traffit') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(pushToTraffit).toHaveBeenCalledOnce());
    expect(pushToTraffit.mock.calls[0][0]).toMatchObject({ employeeId: 30, assessmentId: a.id });
  });

  it('bez traffitId pokazuje picker, auto-match po nazwisku, zapis i push', async () => {
    fetchTraffitCandidates.mockResolvedValue([
      { employeeId: 30, recruitmentId: 63, recruitmentName: 'R', fullName: 'Próbna Janina', email: null },
    ]);
    pushToTraffit.mockResolvedValue({ noteId: 2, action: 'created' });
    const a = makeAssessment(); // nazwa 'Janina Próbna'
    void openRecruiterPreview(a, settings());
    (document.querySelector('#recruiter-traffit') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('#traffit-link-pick')).not.toBeNull());
    const sel = document.querySelector('#traffit-link-pick') as HTMLSelectElement;
    expect(sel.value).toBe('30::63'); // auto-zaznaczony best match
    (document.querySelector('#traffit-link-confirm') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(pushToTraffit).toHaveBeenCalledOnce());
    expect(save).toHaveBeenCalledOnce();
    expect(a.candidate.traffitId).toBe(30);
  });
});
```

- [ ] **Step 2: Uruchom — ma FAILOWAĆ**

Run: `cd etap2 && npx vitest run tests/recruiter-preview-dialog.test.ts -t "Traffit push"`
Expected: FAIL (brak `#traffit-link-pick`, stary `window.prompt` flow).

- [ ] **Step 3: Przebuduj handler Traffit w `recruiter-preview-dialog.ts`**

W `etap2/src/ui/recruiter-preview-dialog.ts` zmień importy:

```typescript
import { TraffitPushError, pushToTraffit } from '../persistence/traffit-api';
import { fetchTraffitCandidates } from '../persistence/traffit-candidates';
import { bestNameMatch, type TraffitCandidate } from '../domain/traffit-roster';
import { isOnline, repo } from '../state';
```

(usuń import `AzureStore` jeśli był tylko do gatingu; zostaw jeśli używany gdzie indziej).

Zmień widoczność przycisku:

```typescript
    traffitBtn.hidden = !isOnline;
```

Zamień całą funkcję `traffitBtn.onclick` na:

```typescript
    async function doPush(employeeId: number): Promise<void> {
      traffitBtn.disabled = true;
      traffitStatus.hidden = false;
      traffitStatus.textContent = 'Wysyłam do Traffit…';
      try {
        const result = await pushToTraffit({ assessmentId: a.id, employeeId, html });
        traffitStatus.textContent = `Gotowe: notatka ${result.action === 'created' ? 'utworzona' : 'zaktualizowana'} (id ${result.noteId}).`;
      } catch (err) {
        const msg = err instanceof TraffitPushError
          ? `Błąd ${err.status}: ${err.message}`
          : err instanceof Error ? err.message : 'Nieznany błąd';
        traffitStatus.textContent = `Push się nie powiódł. ${msg}`;
      } finally {
        traffitBtn.disabled = false;
      }
    }

    function renderLinkPicker(candidates: TraffitCandidate[]): void {
      // Picker: wybór kandydata z Traffit (auto-match) + furtka ręcznego ID.
      const existing = dialog.querySelector('.traffit-linker');
      if (existing) existing.remove();
      const box = document.createElement('div');
      box.className = 'traffit-linker';
      const best = bestNameMatch(candidates, a.candidate.nameOrId);
      const options = candidates
        .map((c) => `<option value="${c.employeeId}::${c.recruitmentId}"${best && c.employeeId === best.employeeId && c.recruitmentId === best.recruitmentId ? ' selected' : ''}>${c.fullName} — ${c.recruitmentName}</option>`)
        .join('');
      box.innerHTML = `
        <label for="traffit-link-pick">Powiąż z kandydatem w Traffit</label>
        <select id="traffit-link-pick"><option value="">— ręczne ID —</option>${options}</select>
        <input id="traffit-link-manual" inputmode="numeric" placeholder="lub wpisz ID ręcznie">
        <button type="button" class="btn primary" id="traffit-link-confirm">Powiąż i wyślij</button>`;
      traffitStatus.hidden = true;
      dialog.insertBefore(box, traffitStatus);

      (box.querySelector('#traffit-link-confirm') as HTMLButtonElement).onclick = async () => {
        const sel = (box.querySelector('#traffit-link-pick') as HTMLSelectElement).value;
        const manual = (box.querySelector('#traffit-link-manual') as HTMLInputElement).value.trim();
        let employeeId: number | null = null;
        let chosen: TraffitCandidate | null = null;
        if (sel) {
          chosen = candidates.find((c) => `${c.employeeId}::${c.recruitmentId}` === sel) ?? null;
          employeeId = chosen ? chosen.employeeId : null;
        } else if (manual) {
          const n = Number(manual);
          if (Number.isInteger(n) && n > 0) employeeId = n;
        }
        if (employeeId == null) {
          traffitStatus.hidden = false;
          traffitStatus.textContent = 'Wybierz kandydata z listy lub podaj poprawne ID.';
          return;
        }
        // Utrwal powiązanie na ocenie (kolejne wysyłki bez pytania).
        a.candidate = {
          ...a.candidate,
          traffitId: employeeId,
          ...(chosen ? { recruitmentId: chosen.recruitmentId, recruitmentName: chosen.recruitmentName } : {}),
        };
        try { await repo.save(a); } catch { /* zapis best-effort; push i tak spróbuje */ }
        box.remove();
        await doPush(employeeId);
      };
    }

    traffitBtn.onclick = async () => {
      if (typeof a.candidate.traffitId === 'number') {
        await doPush(a.candidate.traffitId);
        return;
      }
      traffitBtn.disabled = true;
      traffitStatus.hidden = false;
      traffitStatus.textContent = 'Pobieram listę kandydatów z Traffit…';
      try {
        const candidates = await fetchTraffitCandidates();
        traffitBtn.disabled = false;
        if (candidates.length === 0) {
          traffitStatus.textContent = 'Brak kandydatów na etapie „Spotkanie BK". Sprawdź ID w Traffit.';
          return;
        }
        renderLinkPicker(candidates);
      } catch (err) {
        traffitBtn.disabled = false;
        const msg = err instanceof Error ? err.message : 'nieznany błąd';
        traffitStatus.textContent = `Nie udało się pobrać listy. ${msg}`;
      }
    };
```

- [ ] **Step 4: Uruchom — ma PRZEJŚĆ (i nie psuje istniejących testów dialogu)**

Run: `cd etap2 && npx vitest run tests/recruiter-preview-dialog.test.ts`
Expected: PASS (stare testy kopiowania nadal zielone).

- [ ] **Step 5: Commit**

```bash
git add etap2/src/ui/recruiter-preview-dialog.ts etap2/tests/recruiter-preview-dialog.test.ts
git commit -m "feat(etap2): push do Traffit bez pytania gdy traffitId; picker z auto-matchem dla starych wpisow"
```

---

## Task 8: Notatka — nazwa rekrutacji w nagłówku

**Files:**
- Modify: `etap2/src/domain/recruiter-summary.ts:74-79`
- Test: `etap2/tests/recruiter-summary.test.ts`

- [ ] **Step 1: Test — nagłówek zawiera nazwę rekrutacji gdy jest**

W `etap2/tests/recruiter-summary.test.ts` dodaj:

```typescript
it('nagłówek zawiera nazwę rekrutacji gdy ustawiona', () => {
  const a = createEmptyAssessment('id-r', {
    nameOrId: 'Nowak Anna', date: '2026-06-09', stage1Result: '', stage1Note: '',
    traffitId: 30, recruitmentId: 63, recruitmentName: 'C# SQL 05-2026',
  });
  const { text } = buildRecruiterSummary(a, settings());
  expect(text).toContain('Rekrutacja: C# SQL 05-2026');
});
```

(Jeśli plik nie ma helpera `settings()`/`createEmptyAssessment` w imporcie — dorzuć analogicznie do istniejących testów w tym pliku.)

- [ ] **Step 2: Uruchom — ma FAILOWAĆ**

Run: `cd etap2 && npx vitest run tests/recruiter-summary.test.ts -t "nazwę rekrutacji"`
Expected: FAIL.

- [ ] **Step 3: Dodaj wiersz nagłówka**

W `etap2/src/domain/recruiter-summary.ts`, w `buildSections`, w sekcji „1. Header" po linii `headerLines.push(\`Kandydat: ${name}\`);` dodaj:

```typescript
  const recName = a.candidate.recruitmentName?.trim();
  if (recName) headerLines.push(`Rekrutacja: ${recName}`);
```

- [ ] **Step 4: Uruchom — ma PRZEJŚĆ**

Run: `cd etap2 && npx vitest run tests/recruiter-summary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add etap2/src/domain/recruiter-summary.ts etap2/tests/recruiter-summary.test.ts
git commit -m "feat(etap2): nazwa rekrutacji w naglowku notatki Traffit"
```

---

## Task 9: Dokumentacja + pełny zielony zestaw

**Files:**
- Modify: `etap2/README-deploy.md`

- [ ] **Step 1: Dopisz notkę o stałej etapu**

W `etap2/README-deploy.md` w sekcji o Traffit dodaj akapit:

```markdown
### Lista kandydatów z etapu „Spotkanie BK"

Endpoint `GET /api/v1/traffit/candidates` zwraca kandydatów z etapu
`stage.id = 15` („Spotkanie BK") ze wszystkich otwartych rekrutacji poza
`EXCLUDED_RECRUITMENT_IDS = [65]` (Inside Sales). ID etapu jest zaszyte w
`api/src/lib/traffit-client.ts` (`BK_STAGE_ID`), bo otwarte rekrutacje
deweloperskie współdzielą `workflow.id = 1`.

Gdyby Traffit zmienił workflow/numerację etapów, ponów discovery: zapytaj
`GET /api/v2/recruitments/{id}` o `workflow.id`, potem `GET /api/v2/workflows/{id}`
i odczytaj `states[]` (szukaj `name = "Spotkanie BK"`), zaktualizuj `BK_STAGE_ID`.
```

- [ ] **Step 2: Commit dokumentacji**

```bash
git add etap2/README-deploy.md
git commit -m "docs(etap2): opis endpointu listy kandydatow BK + jak ponowic discovery etapu"
```

- [ ] **Step 3: Pełny zestaw testów FE + API**

Run: `cd etap2 && npm run test`
Expected: PASS (cały front).

Run: `cd etap2/api && npm run test`
Expected: PASS (cały backend).

- [ ] **Step 4: Pełny build FE + API**

Run: `cd etap2 && npm run build`
Expected: brak błędów.

Run: `cd etap2/api && npm run build`
Expected: brak błędów.

- [ ] **Step 5: Coverage domeny (cel 80%)**

Run: `cd etap2 && npm run coverage`
Expected: `traffit-roster.ts`, `recruiter-summary.ts`, serwis i klient pokryte; brak regresji poniżej progu.

---

## Self-review (autor planu)

- **Pokrycie spec:**
  - Model 3 pola → Task 1. Backend endpoint + filtr stage 15 + wykluczenie 65 → Task 3/4. Serwis FE → Task 5. Dropdown sort po employeeId + ukrycie par + tryb ręczny → Task 2/6. Push bez pytania + picker auto-match (linkowanie starych) → Task 7. Nazwa rekrutacji w notatce → Task 8. Stała etapu + discovery w docs → Task 9. Fallback offline/błąd → Task 6 (`isOnline`, catch). ✓
- **Brak placeholderów:** każdy krok ma realny kod/komendę i oczekiwany wynik. ✓
- **Spójność typów:** `TraffitCandidate` (`employeeId/recruitmentId/recruitmentName/fullName/email`) zdefiniowany raz w `domain/traffit-roster.ts`, reużywany przez serwis, screen-start i dialog. Backend zwraca identyczny kształt (`TraffitBkCandidate`) w `{ candidates }`. Klucz pary `"<employeeId>::<recruitmentId>"` spójny w `selectableCandidates`, dropdownie i pickerze. `isOnline` z `state.ts` używany w screen-start i dialogu. ✓
- **Uwaga wykonawcza:** Task 7 podmienia mock `../src/state` w pliku testowym dialogu; upewnij się, że istniejące testy w tym pliku nie polegają na realnym `state` (obecnie nie importują go). Jeśli kolizja mocków, rozbij testy Traffit do osobnego pliku `recruiter-preview-traffit.test.ts`.
