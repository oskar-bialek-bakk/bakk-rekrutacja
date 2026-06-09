# Aplikacja oceny II etapu rozmowy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zbudować narzędzie prowadzącego do ustrukturyzowanej oceny II etapu rozmowy (Junior C#/SQL) z ukrytym scoringiem, rotacją wariantów i zestawieniem kandydatów, używalne lokalnie od ręki, z otwartą ścieżką na Azure + SSO.

**Architecture:** Vite + TypeScript, vanilla TS bez frameworka UI. Czysta logika domenowa (scoring, rotacja, model) odcięta od DOM i od trwałości. Trwałość za interfejsem repozytorium: faza 0 localStorage, faza online druga implementacja (Azure Functions + Cosmos). Build do statycznej paczki / pojedynczego pliku offline.

**Tech Stack:** Vite, TypeScript, Vitest (testy domeny), Playwright (1 E2E), localStorage, vite-plugin-singlefile.

**Spec:** `docs/superpowers/specs/2026-06-08-ocena-rozmowy-etap2-design.md`
**Referencja UX/treści:** `POC_ocena_rozmowy.html` (prototyp), `index.html` (paleta BAKK etapu I).

---

## Konwencje

- **Katalog projektu:** wszystko pod `etap2/` w repo `bakk-rekrutacja`. Ścieżki w planie są względem korzenia repo.
- **Język:** Node 20+. Polskie znaki w treściach i testach.
- **TDD:** każda jednostka logiki domenowej: test (RED) → minimalna implementacja (GREEN) → commit. UI: implementacja + weryfikacja ręczna + 1 E2E na końcu fazy.
- **Uruchamianie testów:** `npx vitest run etap2/tests/<plik>` (pojedynczy), `npm --prefix etap2 test` (całość).
- **Commity:** conventional commits, scope `etap2`, np. `feat(etap2): scoring ważony z poprawną normalizacją`. Bez atrybucji (globalna reguła).
- **Immutability:** funkcje domenowe i repozytorium zwracają nowe obiekty, nie mutują wejścia.
- **Po każdym tasku:** uruchom testy danego modułu i commit.

---

# FAZA 1 — Używalna aplikacja na localStorage ✅ ZAKOŃCZONA (2026-06-08, PR #2 → main `cb5a2ee`)

> Zrealizowane subagent-driven w 16 taskach + 3 rundy polishu po review (XSS hardening, dark theme, blok D pula pytań, blok A bez spoilera, przycisk Kopiuj per blok). 34 testy jednostkowe + 1 E2E zielone. Build single-file ~55 kB.

Cel fazy: kompletny przepływ start → ocena → podsumowanie → zestawienie, poprawny scoring, trwałość localStorage, rebranding BAKK, pola negocjacji i wybór wariantu na starcie. Po tej fazie aplikacja nadaje się do realnej rozmowy.

## Task 1: Scaffold projektu Vite + TS + Vitest

**Files:**
- Create: `etap2/package.json`, `etap2/tsconfig.json`, `etap2/vite.config.ts`, `etap2/vitest.config.ts`, `etap2/index.html`, `etap2/src/main.ts`, `etap2/.gitignore`

- [ ] **Step 1: Utwórz projekt i zainstaluj zależności**

Run (z korzenia repo):
```bash
npm create vite@latest etap2 -- --template vanilla-ts
npm --prefix etap2 install
npm --prefix etap2 install -D vitest @vitest/coverage-v8 jsdom @playwright/test vite-plugin-singlefile
```
Expected: katalog `etap2/` z szablonem vanilla-ts, `node_modules` zainstalowane.

- [ ] **Step 2: Skonfiguruj Vite do pracy offline (build do 1 pliku)**

Create `etap2/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',                 // ścieżki względne — działa z file://
  plugins: [viteSingleFile()],
  build: { target: 'es2020', cssCodeSplit: false, assetsInlineLimit: 100000000 },
});
```

- [ ] **Step 3: Skonfiguruj Vitest (środowisko jsdom dla localStorage)**

Create `etap2/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    coverage: { provider: 'v8', include: ['src/domain/**', 'src/persistence/**', 'src/export/**'] },
  },
});
```

- [ ] **Step 4: Dodaj skrypty testowe do package.json**

Modify `etap2/package.json` (sekcja `scripts`), dodaj:
```json
"test": "vitest run",
"test:watch": "vitest",
"coverage": "vitest run --coverage",
"e2e": "playwright test"
```

- [ ] **Step 5: Sanity check**

Run:
```bash
npm --prefix etap2 run build
```
Expected: build kończy się sukcesem, powstaje `etap2/dist/index.html` (pojedynczy plik).

- [ ] **Step 6: Commit**

```bash
git add etap2/
git commit -m "chore(etap2): scaffold Vite + TS + Vitest + Playwright"
```

## Task 2: Wyłączenie `etap2/` z GitHub Pages

GitHub Pages (deploy z brancha) domyślnie serwuje całą zawartość przez Jekyll. Treści zadań etapu II NIE mogą być pobieralne pod publicznym URL. Wykluczamy `etap2/` (i `docs/`) z publikacji.

**Files:**
- Create: `_config.yml` (w korzeniu repo)

- [ ] **Step 1: Dodaj wykluczenia Jekyll**

Create `_config.yml`:
```yaml
# Etap I (index.html, eval.html) jest publiczny. Etap II i dokumentacja NIE są publikowane.
exclude:
  - etap2/
  - docs/
  - re-encrypt.ps1
  - confidential/
```

- [ ] **Step 2: Weryfikacja założenia**

Sprawdź w ustawieniach repo (Settings → Pages), czy źródłem jest branch (nie GitHub Actions) i czy nie ma pliku `.nojekyll` w korzeniu (jeśli jest, `exclude` nie zadziała i trzeba inną metodę: osobny branch lub build poza repo). Jeśli `.nojekyll` istnieje, ZATRZYMAJ się i zgłoś, zanim publikujesz cokolwiek.

- [ ] **Step 3: Commit**

```bash
git add _config.yml
git commit -m "chore: wyklucz etap2/ i docs/ z GitHub Pages"
```

## Task 3: Model domenowy

**Files:**
- Create: `etap2/src/domain/model.ts`
- Test: `etap2/tests/model.test.ts`

- [ ] **Step 1: Napisz failing test**

Create `etap2/tests/model.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createEmptyAssessment, SCHEMA_VERSION } from '../src/domain/model';

describe('createEmptyAssessment', () => {
  it('tworzy pusty rekord z poprawnym schematem i pustymi mapami', () => {
    const a = createEmptyAssessment('id-1', { nameOrId: 'A. Kowalski', date: '2026-06-08', stage1Result: '78%', stage1Note: 'mocny SQL' });
    expect(a.id).toBe('id-1');
    expect(a.schemaVersion).toBe(SCHEMA_VERSION);
    expect(a.candidate.nameOrId).toBe('A. Kowalski');
    expect(a.marks).toEqual({});
    expect(a.flags).toEqual({});
    expect(a.notes).toEqual({});
    expect(a.decision).toBeNull();
    expect(a.negotiation.oczekiwania).toBe('');
    expect(a.useE).toBe(false);
    expect(typeof a.createdAt).toBe('string');
  });
});
```

- [ ] **Step 2: Uruchom test, potwierdź FAIL**

Run: `npx vitest run etap2/tests/model.test.ts`
Expected: FAIL ("createEmptyAssessment is not exported / module not found").

- [ ] **Step 3: Implementuj model**

Create `etap2/src/domain/model.ts`:
```ts
export type BlockId = 'A' | 'B' | 'C' | 'D' | 'E';
export type Mark = 1 | 2 | 3 | 4 | 5;
export type Decision = 'yes' | 'no' | 'wait';

export interface Candidate {
  nameOrId: string;
  date: string;            // ISO yyyy-mm-dd
  stage1Result: string;
  stage1Note: string;
}

export interface Negotiation {
  oczekiwania: string;
  widelki: string;
  formaUmowy: string;
  dostepnosc: string;
  uwagi: string;
}

export interface TimerState { elapsedSec: number; paused: boolean; offsetSec: number; }
export interface Flags { red: boolean; green: boolean; }

export interface Assessment {
  id: string;
  schemaVersion: number;
  candidate: Candidate;
  selectedVariants: Partial<Record<BlockId, number>>;
  deepenAsked: Partial<Record<BlockId, boolean>>;
  marks: Partial<Record<BlockId, Mark>>;
  flags: Partial<Record<BlockId, Flags>>;
  notes: Partial<Record<BlockId, string>>;
  decision: Decision | null;
  decisionNote: string;
  negotiation: Negotiation;
  timer: TimerState;
  useE: boolean;
  createdAt: string;
  updatedAt: string;
}

export type VariantUsage = Partial<Record<BlockId, Record<number, number>>>;
export interface Weights { A: number; B: number; C: number; D: number; E: number; }
export interface Settings { weights: Weights; showScoreLive: boolean; includeEInScore: boolean; }

export const SCHEMA_VERSION = 1;

function emptyNegotiation(): Negotiation {
  return { oczekiwania: '', widelki: '', formaUmowy: '', dostepnosc: '', uwagi: '' };
}

export function createEmptyAssessment(id: string, candidate: Candidate): Assessment {
  const now = new Date().toISOString();
  return {
    id, schemaVersion: SCHEMA_VERSION, candidate,
    selectedVariants: {}, deepenAsked: {}, marks: {}, flags: {}, notes: {},
    decision: null, decisionNote: '', negotiation: emptyNegotiation(),
    timer: { elapsedSec: 0, paused: false, offsetSec: 0 },
    useE: false, createdAt: now, updatedAt: now,
  };
}
```

- [ ] **Step 4: Uruchom test, potwierdź PASS**

Run: `npx vitest run etap2/tests/model.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add etap2/src/domain/model.ts etap2/tests/model.test.ts
git commit -m "feat(etap2): model domenowy + fabryka pustej oceny"
```

## Task 4: Konfiguracja wag

**Files:**
- Create: `etap2/src/domain/weights.config.ts`
- Test: `etap2/tests/weights.test.ts`

- [ ] **Step 1: Failing test**

Create `etap2/tests/weights.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_WEIGHTS } from '../src/domain/weights.config';

describe('DEFAULT_WEIGHTS', () => {
  it('A+B+C+D = 100, E = 0', () => {
    const { A, B, C, D, E } = DEFAULT_WEIGHTS;
    expect(A + B + C + D).toBe(100);
    expect(E).toBe(0);
    expect([A, B, C, D]).toEqual([15, 30, 25, 30]);
  });
});
```

- [ ] **Step 2: Uruchom, potwierdź FAIL**

Run: `npx vitest run etap2/tests/weights.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementuj**

Create `etap2/src/domain/weights.config.ts`:
```ts
import type { Weights } from './model';

// Jedyne źródło prawdy dla wag. W Fazie 3 nadpisywalne w ekranie ustawień.
export const DEFAULT_WEIGHTS: Weights = { A: 15, B: 30, C: 25, D: 30, E: 0 };
```

- [ ] **Step 4: PASS**

Run: `npx vitest run etap2/tests/weights.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add etap2/src/domain/weights.config.ts etap2/tests/weights.test.ts
git commit -m "feat(etap2): konfiguracja wag w jednym miejscu"
```

## Task 5: Scoring (z naprawą normalizacji)

Naprawia błąd POC: nieoceniony blok NIE wchodzi do mianownika (nie jest karany jak 0/5).

**Files:**
- Create: `etap2/src/domain/scoring.ts`
- Test: `etap2/tests/scoring.test.ts`

- [ ] **Step 1: Failing testy (pełen zestaw przypadków)**

Create `etap2/tests/scoring.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeScore } from '../src/domain/scoring';
import { DEFAULT_WEIGHTS } from '../src/domain/weights.config';

describe('computeScore', () => {
  it('wszystkie A-D = 5 → 100, kompletne', () => {
    const r = computeScore({ A: 5, B: 5, C: 5, D: 5 }, DEFAULT_WEIGHTS);
    expect(r.score).toBe(100);
    expect(r.complete).toBe(true);
    expect(r.scoredCount).toBe(4);
  });

  it('wszystkie A-D = 1 → 20', () => {
    const r = computeScore({ A: 1, B: 1, C: 1, D: 1 }, DEFAULT_WEIGHTS);
    expect(r.score).toBe(20);
  });

  it('nieoceniony blok NIE zaniża wyniku (naprawa buga POC)', () => {
    // tylko A i B ocenione na 5; C, D puste
    const r = computeScore({ A: 5, B: 5 }, DEFAULT_WEIGHTS);
    expect(r.score).toBe(100);       // 100% z ocenionych, nie zaniżone przez puste C/D
    expect(r.complete).toBe(false);
    expect(r.scoredCount).toBe(2);
    expect(r.totalWeightedBlocks).toBe(4);
  });

  it('blok E (waga 0) jest ignorowany domyślnie', () => {
    const r = computeScore({ A: 5, B: 5, C: 5, D: 5, E: 1 }, DEFAULT_WEIGHTS);
    expect(r.score).toBe(100);
    expect(r.profile.E).toBeUndefined();
  });

  it('brak ocen → 0, scoredCount 0', () => {
    const r = computeScore({}, DEFAULT_WEIGHTS);
    expect(r.score).toBe(0);
    expect(r.scoredCount).toBe(0);
  });

  it('zmiana wag zmienia wynik', () => {
    const w = { A: 100, B: 0, C: 0, D: 0, E: 0 };
    const r = computeScore({ A: 3, B: 5, C: 5, D: 5 }, w);
    expect(r.score).toBe(60);        // tylko A liczy się (waga 100): 3/5 = 60
  });

  it('profil zwraca poziom per oceniony blok', () => {
    const r = computeScore({ A: 4, B: 2 }, DEFAULT_WEIGHTS);
    expect(r.profile).toEqual({ A: 4, B: 2 });
  });
});
```

- [ ] **Step 2: Uruchom, potwierdź FAIL**

Run: `npx vitest run etap2/tests/scoring.test.ts`
Expected: FAIL ("computeScore is not a function").

- [ ] **Step 3: Implementuj scoring**

Create `etap2/src/domain/scoring.ts`:
```ts
import type { BlockId, Mark, Weights } from './model';

export interface ScoreResult {
  score: number;                              // 0-100 zaokrąglone
  scoredCount: number;
  totalWeightedBlocks: number;
  profile: Partial<Record<BlockId, number>>;  // poziom 1-5 per oceniony blok
  complete: boolean;
}

const WEIGHTED_BLOCKS: BlockId[] = ['A', 'B', 'C', 'D'];

export function computeScore(
  marks: Partial<Record<BlockId, Mark>>,
  weights: Weights,
  opts: { includeE?: boolean } = {},
): ScoreResult {
  const blocks: BlockId[] = opts.includeE ? [...WEIGHTED_BLOCKS, 'E'] : WEIGHTED_BLOCKS;
  let num = 0;
  let den = 0;
  let scoredCount = 0;
  const profile: Partial<Record<BlockId, number>> = {};

  for (const b of blocks) {
    const w = weights[b];
    if (w <= 0) continue;                 // E z wagą 0 ignorowane
    const m = marks[b];
    if (m == null) continue;              // nieoceniony blok NIE wchodzi do mianownika
    num += m * w;
    den += 5 * w;
    profile[b] = m;
    scoredCount++;
  }

  const totalWeightedBlocks = blocks.filter((b) => weights[b] > 0).length;
  const score = den > 0 ? Math.round((num / den) * 100) : 0;
  return { score, scoredCount, totalWeightedBlocks, profile, complete: scoredCount === totalWeightedBlocks };
}
```

- [ ] **Step 4: PASS**

Run: `npx vitest run etap2/tests/scoring.test.ts`
Expected: PASS (7 testów).

- [ ] **Step 5: Commit**

```bash
git add etap2/src/domain/scoring.ts etap2/tests/scoring.test.ts
git commit -m "feat(etap2): scoring ważony z poprawną normalizacją po ocenionych blokach"
```

## Task 6: Treści bloków A–E

Port danych z `POC_ocena_rozmowy.html` (tablica `BLOCKS`, linie 446–538) do typowanej struktury. Treści (polski tekst) przepisz 1:1 z POC.

**Files:**
- Create: `etap2/src/content/blocks.ts`
- Test: `etap2/tests/blocks.test.ts`

- [ ] **Step 1: Failing test strukturalny**

Create `etap2/tests/blocks.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { BLOCKS } from '../src/content/blocks';

describe('BLOCKS', () => {
  it('zawiera bloki A,B,C,D,E w tej kolejności', () => {
    expect(BLOCKS.map((b) => b.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
  it('bloki ważone A-D mają wagi 15/30/25/30, E ma 0', () => {
    const w = Object.fromEntries(BLOCKS.map((b) => [b.id, b.weight]));
    expect([w.A, w.B, w.C, w.D, w.E]).toEqual([15, 30, 25, 30, 0]);
  });
  it('każdy blok ma dokładnie 5 poziomów skali', () => {
    for (const b of BLOCKS) expect(b.scale).toHaveLength(5);
  });
  it('A, B, C mają po 3 warianty; każdy wariant ma label i read', () => {
    for (const id of ['A', 'B', 'C']) {
      const b = BLOCKS.find((x) => x.id === id)!;
      expect(b.variants.length).toBe(3);
      for (const v of b.variants) { expect(v.label).toBeTruthy(); expect(v.read).toBeTruthy(); }
    }
  });
  it('E jest oznaczony jako opcjonalny', () => {
    expect(BLOCKS.find((b) => b.id === 'E')!.optional).toBe(true);
  });
});
```

- [ ] **Step 2: FAIL**

Run: `npx vitest run etap2/tests/blocks.test.ts`
Expected: FAIL.

- [ ] **Step 3: Zdefiniuj typ i port treści**

Create `etap2/src/content/blocks.ts`. Zacznij od typu i bloku A (pełny, jako wzorzec), potem przepisz B, C, D, E z `POC_ocena_rozmowy.html` (BLOCKS, linie 446–538), zachowując dokładnie polski tekst pól `read`, `deepen`, `keys`, `flagRed`, `flagGreen`, `scale`:

```ts
import type { BlockId } from '../domain/model';

export interface Variant { label: string; read: string; }   // read = HTML do wyświetlenia prowadzącemu
export interface Block {
  id: BlockId;
  key: string;            // np. 'Blok A · rozgrzewka'
  title: string;
  time: string;
  weight: number;
  optional?: boolean;
  variants: Variant[];
  deepen: string;
  keyTitle: string;
  keys: string[];
  flagRed: string;
  flagGreen: string;
  scale: string[];        // 5 opisów poziomów (indeks 0 = poziom 1)
}

export const BLOCKS: Block[] = [
  {
    id: 'A', key: 'Blok A · rozgrzewka', title: 'Śledzenie algorytmu', time: '5 min', weight: 15,
    variants: [
      { label: 'A-1 · max + parzyste', read: `<p>Trzymamy <span class="mono">wynik</span> = pierwszy element. Dla każdego kolejnego: jeśli <b>większy</b> od <span class="mono">wynik</span> → ustaw <span class="mono">wynik</span> na niego. Jeśli element jest <b>parzysty</b> → zwiększ <span class="mono">parzyste</span> o 1. Zwróć <span class="mono">(wynik, parzyste)</span>.</p><p>Wejście: <span class="mono">[3, 8, 2, 8, 5, 10, 1]</span> → ? &nbsp;<i style="color:var(--ink-faint)">popr. (10, 4)</i></p>` },
      { label: 'A-2 · min + podz. przez 3', read: `<p>Trzymamy <span class="mono">wynik</span> = pierwszy element. Dla każdego kolejnego: jeśli <b>mniejszy</b> od <span class="mono">wynik</span> → ustaw <span class="mono">wynik</span> na niego. Jeśli element jest <b>podzielny przez 3</b> → zwiększ <span class="mono">licznik</span> o 1. Zwróć <span class="mono">(wynik, licznik)</span>.</p><p>Wejście: <span class="mono">[7, 9, 4, 3, 9, 1, 6]</span> → ? &nbsp;<i style="color:var(--ink-faint)">popr. (1, 4)</i></p>` },
      { label: 'A-3 · suma długości + inicjały', read: `<p>Trzymamy <span class="mono">suma</span> = 0, <span class="mono">wynik</span> = "". Dla każdego słowa: dodaj jego długość do <span class="mono">suma</span>; jeśli zaczyna się na samogłoskę → doklej pierwszą literę do <span class="mono">wynik</span>. Zwróć <span class="mono">(suma, wynik)</span>.</p><p>Wejście: <span class="mono">["okno","dom","ul","kot","auto"]</span> → ? &nbsp;<i style="color:var(--ink-faint)">popr. (16, "oua")</i></p>` },
    ],
    deepen: 'Co się zmieni, jeśli usuniemy ostatni element? A jeśli lista będzie pusta — co powinien zrobić algorytm?',
    keyTitle: 'Klucz — śledzenie krok po kroku',
    keys: ['Czy śledzi krok po kroku, czy zgaduje', 'Czy łapie niezależność warunków', 'Pułapka: pominięte powtórzenie → zaniżony licznik (częsty błąd: 3 zamiast 4)', 'Jeśli poda od razu wynik — poproś o myślenie na głos'],
    flagRed: 'Zgaduje, myli logikę warunków', flagGreen: 'Sam weryfikuje, przelicza drugi raz',
    scale: [
      'Zgaduje, nie potrafi prześledzić nawet po naprowadzeniu; myli logikę warunków.',
      'Próbuje śledzić, ale gubi się; błędny wynik i proces, lub wymaga prowadzenia na każdym kroku.',
      'Wynik z drobnym błędem (pominięte powtórzenie), ale proces poprawny i samodzielny.',
      'Poprawny wynik i uporządkowany proces; po naprowadzeniu od razu łapie pomyłkę.',
      'Poprawny wynik samodzielnie, śledzi czysto na głos, sam weryfikuje, rozróżnia niezależność warunków.',
    ],
  },
  // PORT: bloki B, C, D, E z POC_ocena_rozmowy.html (BLOCKS, linie 466-537).
  //  - B: id 'B', weight 30, 3 warianty (B-1 dysk, B-2 nocny restart, B-3 timeout SQL).
  //  - C: id 'C', weight 25, 3 warianty (C-1 SMS, C-2 złe liczby, C-3 skrajnie wolno).
  //  - D: id 'D', weight 30, 1 "wariant" = pula 5 pytań (label 'Pula pytań (wybierz 3–4)').
  //  - E: id 'E', weight 0, optional:true, 1 wariant (układ podlewania).
  // Skopiuj DOKŁADNIE pola read/deepen/keyTitle/keys/flagRed/flagGreen/scale z POC.
];
```

- [ ] **Step 4: PASS**

Run: `npx vitest run etap2/tests/blocks.test.ts`
Expected: PASS (po dopisaniu B, C, D, E).

- [ ] **Step 5: Commit**

```bash
git add etap2/src/content/blocks.ts etap2/tests/blocks.test.ts
git commit -m "feat(etap2): treści bloków A-E (warianty, klucze, skale) sportowane z POC"
```

## Task 7: Rotacja wariantów (funkcje czyste)

Funkcje pod rotację „najmniej używany". W Fazie 1 dostępne i przetestowane; zapis licznika (recordUsage w przepływie zapisu) wpinamy w Fazie 2. Przy pustym liczniku `pickLeastUsed` zwraca indeks 0.

**Files:**
- Create: `etap2/src/domain/variants.ts`
- Test: `etap2/tests/variants.test.ts`

- [ ] **Step 1: Failing test**

Create `etap2/tests/variants.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { pickLeastUsed, recordUsage } from '../src/domain/variants';

describe('pickLeastUsed', () => {
  it('pusty licznik → indeks 0', () => {
    expect(pickLeastUsed({}, 'A', 3)).toBe(0);
  });
  it('wybiera najmniej używany wariant', () => {
    const usage = { A: { 0: 5, 1: 2, 2: 3 } };
    expect(pickLeastUsed(usage, 'A', 3)).toBe(1);
  });
  it('remis → najniższy indeks', () => {
    const usage = { A: { 0: 0, 1: 0, 2: 4 } };
    expect(pickLeastUsed(usage, 'A', 3)).toBe(0);
  });
  it('wariant bez wpisu liczy się jako 0 użyć', () => {
    const usage = { A: { 0: 3 } };           // 1 i 2 nieobecne = 0
    expect(pickLeastUsed(usage, 'A', 3)).toBe(1);
  });
});

describe('recordUsage', () => {
  it('zwraca nowy obiekt z inkrementem (immutability)', () => {
    const usage = { A: { 0: 1 } };
    const next = recordUsage(usage, 'A', 0);
    expect(next).not.toBe(usage);
    expect(next.A![0]).toBe(2);
    expect(usage.A![0]).toBe(1);             // wejście nietknięte
  });
});
```

- [ ] **Step 2: FAIL**

Run: `npx vitest run etap2/tests/variants.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementuj**

Create `etap2/src/domain/variants.ts`:
```ts
import type { BlockId, VariantUsage } from './model';

export function pickLeastUsed(usage: VariantUsage, block: BlockId, variantCount: number): number {
  const counts = usage[block] ?? {};
  let bestIdx = 0;
  let bestCount = Infinity;
  for (let i = 0; i < variantCount; i++) {
    const c = counts[i] ?? 0;
    if (c < bestCount) { bestCount = c; bestIdx = i; }
  }
  return bestIdx;
}

export function recordUsage(usage: VariantUsage, block: BlockId, variantIdx: number): VariantUsage {
  const block_counts = { ...(usage[block] ?? {}) };
  block_counts[variantIdx] = (block_counts[variantIdx] ?? 0) + 1;
  return { ...usage, [block]: block_counts };
}
```

- [ ] **Step 4: PASS**

Run: `npx vitest run etap2/tests/variants.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add etap2/src/domain/variants.ts etap2/tests/variants.test.ts
git commit -m "feat(etap2): czyste funkcje rotacji wariantów (najmniej używany)"
```

## Task 8: Trwałość — interfejs repozytorium + localStorage

**Files:**
- Create: `etap2/src/persistence/repository.ts`, `etap2/src/persistence/migrations.ts`, `etap2/src/persistence/local-store.ts`
- Test: `etap2/tests/local-store.test.ts`

- [ ] **Step 1: Failing test (round-trip, usuwanie, odporność na uszkodzony storage)**

Create `etap2/tests/local-store.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStore } from '../src/persistence/local-store';
import { createEmptyAssessment } from '../src/domain/model';

beforeEach(() => localStorage.clear());

function sample(id: string) {
  return createEmptyAssessment(id, { nameOrId: 'X', date: '2026-06-08', stage1Result: '', stage1Note: '' });
}

describe('LocalStore', () => {
  it('round-trip: save → get → findAll', async () => {
    const store = new LocalStore();
    await store.save(sample('a'));
    await store.save(sample('b'));
    expect((await store.get('a'))!.id).toBe('a');
    expect((await store.findAll()).map((x) => x.id).sort()).toEqual(['a', 'b']);
  });

  it('delete usuwa rekord', async () => {
    const store = new LocalStore();
    await store.save(sample('a'));
    await store.delete('a');
    expect(await store.get('a')).toBeNull();
  });

  it('uszkodzony storage nie wywala findAll', async () => {
    localStorage.setItem('etap2.assessments', '{ to nie jest json');
    const store = new LocalStore();
    expect(await store.findAll()).toEqual([]);
  });

  it('VariantUsage round-trip', async () => {
    const store = new LocalStore();
    await store.saveVariantUsage({ A: { 0: 2 } });
    expect((await store.getVariantUsage()).A![0]).toBe(2);
  });

  it('Settings round-trip', async () => {
    const store = new LocalStore();
    await store.saveSettings({ weights: { A: 1, B: 1, C: 1, D: 1, E: 0 }, showScoreLive: true, includeEInScore: false });
    expect((await store.getSettings())!.showScoreLive).toBe(true);
  });
});
```

- [ ] **Step 2: FAIL**

Run: `npx vitest run etap2/tests/local-store.test.ts`
Expected: FAIL.

- [ ] **Step 3: Interfejs repozytorium**

Create `etap2/src/persistence/repository.ts`:
```ts
import type { Assessment, VariantUsage, Settings } from '../domain/model';

export interface Repository {
  findAll(): Promise<Assessment[]>;
  get(id: string): Promise<Assessment | null>;
  save(a: Assessment): Promise<void>;
  delete(id: string): Promise<void>;
  getVariantUsage(): Promise<VariantUsage>;
  saveVariantUsage(u: VariantUsage): Promise<void>;
  getSettings(): Promise<Settings | null>;
  saveSettings(s: Settings): Promise<void>;
}
```

- [ ] **Step 4: Migracje (hook na przyszłość)**

Create `etap2/src/persistence/migrations.ts`:
```ts
import type { Assessment } from '../domain/model';
import { SCHEMA_VERSION } from '../domain/model';

// Migruje surowy rekord do bieżącego schematu. Dla v1 to tożsamość; hook na przyszłe zmiany.
export function migrateAssessment(raw: any): Assessment {
  let a = raw;
  // przyszłe kroki: if (a.schemaVersion === 1) a = { ...a, schemaVersion: 2, ... };
  a.schemaVersion = SCHEMA_VERSION;
  return a as Assessment;
}
```

- [ ] **Step 5: Implementacja localStorage**

Create `etap2/src/persistence/local-store.ts`:
```ts
import type { Assessment, VariantUsage, Settings } from '../domain/model';
import type { Repository } from './repository';
import { migrateAssessment } from './migrations';

const K_ASSESS = 'etap2.assessments';
const K_USAGE = 'etap2.variantUsage';
const K_SETTINGS = 'etap2.settings';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    console.error(`etap2: uszkodzony wpis localStorage pod kluczem ${key}, używam wartości domyślnej`);
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export class LocalStore implements Repository {
  async findAll(): Promise<Assessment[]> {
    const map = readJSON<Record<string, any>>(K_ASSESS, {});
    return Object.values(map).map(migrateAssessment);
  }
  async get(id: string): Promise<Assessment | null> {
    const map = readJSON<Record<string, any>>(K_ASSESS, {});
    return map[id] ? migrateAssessment(map[id]) : null;
  }
  async save(a: Assessment): Promise<void> {
    const map = readJSON<Record<string, any>>(K_ASSESS, {});
    writeJSON(K_ASSESS, { ...map, [a.id]: { ...a, updatedAt: new Date().toISOString() } });
  }
  async delete(id: string): Promise<void> {
    const map = readJSON<Record<string, any>>(K_ASSESS, {});
    const { [id]: _omit, ...rest } = map;
    writeJSON(K_ASSESS, rest);
  }
  async getVariantUsage(): Promise<VariantUsage> { return readJSON<VariantUsage>(K_USAGE, {}); }
  async saveVariantUsage(u: VariantUsage): Promise<void> { writeJSON(K_USAGE, u); }
  async getSettings(): Promise<Settings | null> { return readJSON<Settings | null>(K_SETTINGS, null); }
  async saveSettings(s: Settings): Promise<void> { writeJSON(K_SETTINGS, s); }
}
```

- [ ] **Step 6: PASS**

Run: `npx vitest run etap2/tests/local-store.test.ts`
Expected: PASS (5 testów).

- [ ] **Step 7: Commit**

```bash
git add etap2/src/persistence/ etap2/tests/local-store.test.ts
git commit -m "feat(etap2): repozytorium + implementacja localStorage z migracjami"
```

## Task 9: Motyw BAKK (paleta z etapu I)

Port palety z `index.html` (`:root`, linie 16–45) na layout POC. Zamiana ciemnej terracotty POC na cream/amber BAKK.

**Files:**
- Create: `etap2/src/ui/theme.css`

- [ ] **Step 1: Zdefiniuj zmienne motywu**

Create `etap2/src/ui/theme.css` (mapowanie 1:1 ról z POC na paletę BAKK z `index.html`):
```css
:root{
  --bg:#faf8f3;          /* było #1a1714 */
  --panel:#ffffff;        /* było #221e1a */
  --panel-2:#f5f2eb;      /* było #2a251f */
  --ink:#1a1815;          /* było #f4ece0 */
  --ink-dim:#6b6862;      /* było #b8ab98 */
  --ink-faint:#94918a;    /* było #7d7264 */
  --line:#e7e1d4;         /* było #3a342c */
  --accent:#b45309;       /* było #e0794a (terracotta → amber BAKK) */
  --accent-soft:#d9a066;
  --green:#4d7c0f;
  --red:#b91c1c;
  --gold:#b45309;
  --radius:14px;
  --shadow:0 18px 50px -20px rgba(0,0,0,.18);
  --font-serif:'Newsreader',Georgia,serif;
  --font-sans:'IBM Plex Sans',-apple-system,sans-serif;
  --font-mono:'JetBrains Mono',Consolas,monospace;
}
```

- [ ] **Step 2: Skopiuj resztę reguł CSS z POC**

Przenieś pozostałe reguły z bloku `<style>` POC (linie 26–304, bez `:root`) do `theme.css`, zmieniając tylko fonty Google na rodziny z etapu I (Newsreader / IBM Plex Sans / JetBrains Mono). Mechanika i layout bez zmian.

- [ ] **Step 3: Commit**

```bash
git add etap2/src/ui/theme.css
git commit -m "feat(etap2): motyw BAKK (paleta cream/amber z etapu I)"
```

## Task 10: Szkielet aplikacji i router ekranów

**Files:**
- Modify: `etap2/index.html`
- Create: `etap2/src/app.ts`, `etap2/src/state.ts`
- Modify: `etap2/src/main.ts`

- [ ] **Step 1: HTML — kontenery ekranów i topbar**

Replace `etap2/index.html` `<body>` zawartością odwzorowującą strukturę POC (topbar z zegarem + 4 sekcje `#screen-start`, `#screen-assess`, `#screen-summary`, `#screen-roster`), `<div id="app"></div>` jako host, `<script type="module" src="/src/main.ts">`. Markup topbaru i sekcji portuj z POC (linie 308–440), marka „BAKK" zamiast „Sito·rec".

- [ ] **Step 2: Stan sesji bieżącej oceny**

Create `etap2/src/state.ts`:
```ts
import type { Assessment } from './domain/model';
import { LocalStore } from './persistence/local-store';
import type { Repository } from './persistence/repository';

export const repo: Repository = new LocalStore();

export interface Session {
  current: Assessment | null;     // ocena w trakcie
  screen: 'start' | 'assess' | 'summary' | 'roster';
  cur: number;                    // indeks bloku
}

export const session: Session = { current: null, screen: 'start', cur: 0 };
```

- [ ] **Step 3: Router**

Create `etap2/src/app.ts`:
```ts
import { session } from './state';
import { renderStart } from './ui/screen-start';
import { renderAssess } from './ui/screen-assess';
import { renderSummary } from './ui/screen-summary';
import { renderRoster } from './ui/screen-roster';

export function navigate(screen: Session['screen']): void {
  session.screen = screen;
  render();
}

export function render(): void {
  const host = document.getElementById('app')!;
  host.innerHTML = '';
  switch (session.screen) {
    case 'start': renderStart(host); break;
    case 'assess': renderAssess(host); break;
    case 'summary': renderSummary(host); break;
    case 'roster': renderRoster(host); break;
  }
}
```
(Import `Session` typu z `./state` w sygnaturze — dodaj `import type { Session } from './state';`.)

- [ ] **Step 4: main.ts**

Replace `etap2/src/main.ts`:
```ts
import './ui/theme.css';
import { render } from './app';

render();
```

- [ ] **Step 5: Commit**

```bash
git add etap2/index.html etap2/src/app.ts etap2/src/state.ts etap2/src/main.ts
git commit -m "feat(etap2): szkielet aplikacji + router ekranów"
```

## Task 11: Ekran startowy (z notatką etapu I, wyborem wariantu, blokiem E)

**Files:**
- Create: `etap2/src/ui/screen-start.ts`

- [ ] **Step 1: Implementuj ekran startowy**

Create `etap2/src/ui/screen-start.ts`. Formularz portuj z POC (linie 322–353), DODAJ względem POC:
- osobne pole **„Notatka z etapu I"** (`stage1Note`),
- sekcję **wyboru wariantu per blok** (A, B, C; D = pula, E jeśli włączony): dla każdego bloku chipy wariantów z domyślnym wskazaniem `pickLeastUsed(usage, blockId, count)`,
- toggle bloku E.

```ts
import { BLOCKS } from '../content/blocks';
import { createEmptyAssessment } from '../domain/model';
import { pickLeastUsed } from '../domain/variants';
import { repo, session } from '../state';
import { navigate } from '../app';
import { startTimer } from './timer-ui';   // Task 12 dostarcza startTimer; w Fazie 1 minimalny zegar globalny

export async function renderStart(host: HTMLElement): Promise<void> {
  const usage = await repo.getVariantUsage();
  const suggested: Record<string, number> = {};
  for (const b of BLOCKS) suggested[b.id] = pickLeastUsed(usage, b.id, b.variants.length);

  host.innerHTML = `
    <section class="hero">
      <div class="eyebrow">Junior C# / SQL Developer</div>
      <h1>Ustrukturyzowana rozmowa finałowa</h1>
    </section>
    <div class="form">
      <div class="field"><label>Kandydat — imię i nazwisko / ID</label><input id="in-name"></div>
      <div class="field two">
        <div><label>Data rozmowy</label><input id="in-date" type="date"></div>
        <div><label>Wynik etapu I</label><input id="in-stage1"></div>
      </div>
      <div class="field"><label>Notatka z etapu I</label><textarea id="in-stage1-note" placeholder="np. mocny SQL, słabszy LINQ"></textarea></div>
      <div id="variant-pick"></div>
      <label class="opt-toggle" id="opt-e"><input type="checkbox" id="chk-e"> Dołącz blok E „podlewanie” (bez wagi)</label>
      <button class="btn primary" id="btn-start">Rozpocznij rozmowę →</button>
    </div>`;

  const vp = host.querySelector('#variant-pick')!;
  vp.innerHTML = BLOCKS.filter((b) => b.variants.length > 1).map((b) => `
    <div class="field"><label>${b.title} — wariant</label>
      <div class="vchips" data-block="${b.id}">
        ${b.variants.map((v, i) => `<button type="button" class="vchip ${i === suggested[b.id] ? 'on' : ''}" data-idx="${i}">${v.label}</button>`).join('')}
      </div></div>`).join('');

  // wybór wariantu (toggle pojedynczy)
  vp.querySelectorAll<HTMLElement>('.vchips').forEach((row) => {
    row.querySelectorAll<HTMLButtonElement>('.vchip').forEach((chip) => {
      chip.onclick = () => {
        row.querySelectorAll('.vchip').forEach((c) => c.classList.remove('on'));
        chip.classList.add('on');
      };
    });
  });

  (host.querySelector('#in-date') as HTMLInputElement).value = new Date().toISOString().slice(0, 10);

  (host.querySelector('#btn-start') as HTMLButtonElement).onclick = () => {
    const a = createEmptyAssessment(crypto.randomUUID(), {
      nameOrId: (host.querySelector('#in-name') as HTMLInputElement).value || '(bez nazwy)',
      date: (host.querySelector('#in-date') as HTMLInputElement).value,
      stage1Result: (host.querySelector('#in-stage1') as HTMLInputElement).value,
      stage1Note: (host.querySelector('#in-stage1-note') as HTMLTextAreaElement).value,
    });
    a.useE = (host.querySelector('#chk-e') as HTMLInputElement).checked;
    for (const b of BLOCKS) {
      const sel = vp.querySelector(`.vchips[data-block="${b.id}"] .vchip.on`) as HTMLElement | null;
      a.selectedVariants[b.id] = sel ? Number(sel.dataset.idx) : (suggested[b.id] ?? 0);
    }
    session.current = a;
    session.cur = 0;
    startTimer();
    navigate('assess');
  };
}
```

- [ ] **Step 2: Weryfikacja ręczna**

Run: `npm --prefix etap2 run dev`, otwórz URL. Sprawdź: pola, chipy wariantów z domyślnym podświetleniem, toggle E, przejście do ekranu oceny po „Rozpocznij".

- [ ] **Step 3: Commit**

```bash
git add etap2/src/ui/screen-start.ts
git commit -m "feat(etap2): ekran startowy z notatką etapu I i wyborem wariantu"
```

## Task 12: Ekran oceny (bloki) + zegar globalny

**Files:**
- Create: `etap2/src/ui/screen-assess.ts`, `etap2/src/ui/timer-ui.ts`

- [ ] **Step 1: Minimalny zegar globalny**

Create `etap2/src/ui/timer-ui.ts`:
```ts
import { session } from '../state';

let intervalId: number | null = null;
let startMs = 0;

export function startTimer(): void {
  startMs = Date.now();
  const clock = document.getElementById('clock');
  if (clock) clock.style.visibility = 'visible';
  if (intervalId != null) clearInterval(intervalId);
  intervalId = window.setInterval(tick, 1000);
  tick();
}

function tick(): void {
  if (!session.current) return;
  const s = Math.floor((Date.now() - startMs) / 1000) + session.current.timer.offsetSec;
  session.current.timer.elapsedSec = s;
  const el = document.getElementById('elapsed');
  if (el) el.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const t = document.getElementById('timer');
  if (t) { t.classList.toggle('warn', s >= 45 * 60 && s < 55 * 60); t.classList.toggle('over', s >= 55 * 60); }
}

export function elapsedStr(): string {
  const s = session.current?.timer.elapsedSec ?? 0;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
```

- [ ] **Step 2: Ekran oceny**

Create `etap2/src/ui/screen-assess.ts`. Render karty bloku portuj z POC `renderBlock` (linie 585–642), z różnicami: czyta/zapisuje do `session.current` (marks/flags/notes/selectedVariants/deepenAsked), skala jako natywny radio-group, stepper ze stanami (oceniony / w trakcie / do zrobienia), punkty ukryte. Kluczowa logika:

```ts
import { BLOCKS } from '../content/blocks';
import type { Block } from '../content/blocks';
import type { BlockId, Mark } from '../domain/model';
import { session } from '../state';
import { navigate } from '../app';

function activeBlocks(): Block[] {
  return BLOCKS.filter((b) => !b.optional || session.current!.useE);
}

export function renderAssess(host: HTMLElement): void {
  const a = session.current!;
  const blocks = activeBlocks();
  if (session.cur >= blocks.length) session.cur = blocks.length - 1;
  const b = blocks[session.cur];
  const vIdx = a.selectedVariants[b.id] ?? 0;
  const sel = a.marks[b.id];
  const fl = a.flags[b.id] ?? { red: false, green: false };

  host.innerHTML = `
    <div class="stepper">${blocks.map((x, i) => {
      const state = a.marks[x.id] != null ? 'done' : i === session.cur ? 'active' : 'todo';
      return `<button class="step ${state}" data-i="${i}"><div class="k">${x.key}</div><div class="t">${x.title}</div></button>`;
    }).join('')}</div>
    <div class="card"><div class="card-body">
      <div class="twocol">
        <div>
          <div class="label">Przeczytaj kandydatowi</div>
          <div class="readbox">${b.variants[vIdx].read}</div>
          <div class="label">Ocena — wybierz poziom</div>
          <fieldset class="scale" id="scale">${b.scale.map((d, i) =>
            `<label class="lvl ${sel === i + 1 ? 'sel' : ''}"><input type="radio" name="mark" value="${i + 1}" ${sel === i + 1 ? 'checked' : ''}><span class="num">${i + 1}</span><span class="desc">${d}</span></label>`).join('')}</fieldset>
          <div class="deepen"><div class="dh">Pytanie pogłębiające <span class="tag">jeśli zostanie czas</span></div>
            <div class="dq">„${b.deepen}”</div>
            <label><input type="checkbox" id="deepen-asked" ${a.deepenAsked[b.id] ? 'checked' : ''}> zadano</label></div>
        </div>
        <div>
          <div class="keybox"><h4>${b.keyTitle}</h4><ul>${b.keys.map((k) => `<li>${k}</li>`).join('')}</ul>
            <div class="flag red">${b.flagRed}</div><div class="flag green">${b.flagGreen}</div></div>
          <div class="flagrow">
            <button class="flagbtn red ${fl.red ? 'on' : ''}" id="fr">⚑ Czerwona</button>
            <button class="flagbtn green ${fl.green ? 'on' : ''}" id="fg">⚑ Zielona</button></div>
          <div class="label">Notatka / cytat</div>
          <textarea id="note" placeholder="Konkretna obserwacja…">${a.notes[b.id] ?? ''}</textarea>
        </div>
      </div>
      <div class="nav">
        <button class="btn ghost" id="prev" ${session.cur === 0 ? 'disabled' : ''}>← Poprzedni</button>
        <div class="hidden-note">🔒 Punkty ukryte — odsłonią się na podsumowaniu</div>
        <button class="btn primary" id="next">${session.cur < blocks.length - 1 ? 'Następny blok →' : 'Zakończ ocenę →'}</button>
      </div>
    </div></div>`;

  host.querySelectorAll<HTMLElement>('.step').forEach((s) => (s.onclick = () => { session.cur = Number(s.dataset.i); render2(host); }));
  host.querySelector('#scale')!.addEventListener('change', (e) => {
    a.marks[b.id] = Number((e.target as HTMLInputElement).value) as Mark; render2(host);
  });
  (host.querySelector('#deepen-asked') as HTMLInputElement).onchange = (e) => { a.deepenAsked[b.id] = (e.target as HTMLInputElement).checked; };
  (host.querySelector('#fr') as HTMLButtonElement).onclick = () => { a.flags[b.id] = { red: !fl.red, green: fl.green }; render2(host); };
  (host.querySelector('#fg') as HTMLButtonElement).onclick = () => { a.flags[b.id] = { red: fl.red, green: !fl.green }; render2(host); };
  (host.querySelector('#note') as HTMLTextAreaElement).oninput = (e) => { a.notes[b.id] = (e.target as HTMLTextAreaElement).value; };
  (host.querySelector('#prev') as HTMLButtonElement).onclick = () => { if (session.cur > 0) { session.cur--; render2(host); } };
  (host.querySelector('#next') as HTMLButtonElement).onclick = () => {
    if (session.cur < blocks.length - 1) { session.cur++; render2(host); } else { navigate('summary'); }
  };
}

function render2(host: HTMLElement): void { renderAssess(host); }
```
(Uwaga: `keyboard 1–5` i ARIA przenosimy do Fazy 3. Tu radio-group daje już bazową dostępność.)

- [ ] **Step 3: Weryfikacja ręczna**

Run dev. Sprawdź: wybór poziomu, flagi, notatka, nawigacja dalej/wstecz bez utraty danych, stepper pokazuje stan, przejście do podsumowania.

- [ ] **Step 4: Commit**

```bash
git add etap2/src/ui/screen-assess.ts etap2/src/ui/timer-ui.ts
git commit -m "feat(etap2): ekran oceny bloków + zegar globalny"
```

## Task 13: Ekran podsumowania (scoring, decyzja, negocjacje, zapis)

**Files:**
- Create: `etap2/src/ui/screen-summary.ts`

- [ ] **Step 1: Implementuj**

Create `etap2/src/ui/screen-summary.ts`. Layout portuj z POC `goSummary` (linie 656–682) + sekcja decyzji i negocjacji (linie 393–414), z różnicami: użyj `computeScore`, **złagodź werdykt** (neutralny opis profilu, bez sugestii decyzji), **podłącz pola negocjacji do `a.negotiation`**, ostrzeżenie przy niekompletnej ocenie, zapis do repo.

```ts
import { BLOCKS } from '../content/blocks';
import { computeScore } from '../domain/scoring';
import { DEFAULT_WEIGHTS } from '../domain/weights.config';
import type { Decision } from '../domain/model';
import { repo, session } from '../state';
import { navigate } from '../app';
import { elapsedStr } from './timer-ui';

export function renderSummary(host: HTMLElement): void {
  const a = session.current!;
  const r = computeScore(a.marks, DEFAULT_WEIGHTS);
  const verdict = r.score >= 75 ? 'Wysoki wynik względny' : r.score >= 55 ? 'Średni wynik względny' : 'Niski wynik względny';
  const incomplete = !r.complete ? `<div class="callout warn">Ocena niepełna: oceniono ${r.scoredCount}/${r.totalWeightedBlocks} bloków ważonych. Wynik liczony tylko z ocenionych.</div>` : '';

  const flagsHtml = BLOCKS.flatMap((b) => {
    const f = a.flags[b.id] ?? { red: false, green: false };
    const out: string[] = [];
    if (f.red) out.push(`<div class="fchip red">⚑ ${b.title}: ${b.flagRed}</div>`);
    if (f.green) out.push(`<div class="fchip green">⚑ ${b.title}: ${b.flagGreen}</div>`);
    return out;
  }).join('');

  host.innerHTML = `
    <div class="card"><div class="card-body">
      ${incomplete}
      <div class="scorebig"><div class="val"><b>${r.score}</b><span>na 100</span></div><div class="verdict">${verdict} · ${a.candidate.nameOrId} · ⏱ ${elapsedStr()}</div></div>
      <div class="breakdown">${BLOCKS.filter((b) => !b.optional || a.useE).map((b) => {
        const m = r.profile[b.id]; const wl = b.weight ? `waga ${b.weight}%` : 'bez wagi';
        return `<div class="brow"><div class="bn">${b.title}<small>${wl}</small></div><div class="bv">${m ? m + '/5' : '—'}</div></div>`;
      }).join('')}</div>
      <div class="flags-summary">${flagsHtml}</div>

      <div class="section-title">Decyzja prowadzącego</div>
      <div class="decide">
        <button class="dbtn yes" data-d="yes">Tak — oferta</button>
        <button class="dbtn wait" data-d="wait">Czekamy — porównać</button>
        <button class="dbtn no" data-d="no">Nie</button>
      </div>
      <textarea id="dec-note" placeholder="Uzasadnienie decyzji">${a.decisionNote}</textarea>

      <div class="section-title">Negocjacje i warunki <span class="muted">— poza oceną</span></div>
      <div class="neg-grid">
        <input id="neg-ocz" placeholder="Oczekiwania finansowe" value="${a.negotiation.oczekiwania}">
        <input id="neg-wid" placeholder="Proponowane widełki" value="${a.negotiation.widelki}">
        <input id="neg-forma" placeholder="Forma umowy" value="${a.negotiation.formaUmowy}">
        <input id="neg-dost" placeholder="Dostępność / wypowiedzenie" value="${a.negotiation.dostepnosc}">
        <input id="neg-uwagi" class="full" placeholder="Uwagi" value="${a.negotiation.uwagi}">
      </div>

      <div class="nav">
        <button class="btn ghost" id="back">← Wróć do oceny</button>
        <button class="btn primary" id="save">Zapisz i pokaż zestawienie →</button>
      </div>
    </div></div>`;

  const setDec = (d: Decision) => { a.decision = d; host.querySelectorAll('.dbtn').forEach((x) => x.classList.toggle('on', (x as HTMLElement).dataset.d === d)); };
  host.querySelectorAll<HTMLElement>('.dbtn').forEach((btn) => (btn.onclick = () => setDec(btn.dataset.d as Decision)));
  if (a.decision) setDec(a.decision);

  (host.querySelector('#dec-note') as HTMLTextAreaElement).oninput = (e) => { a.decisionNote = (e.target as HTMLTextAreaElement).value; };
  const bind = (id: string, key: keyof typeof a.negotiation) => {
    (host.querySelector(id) as HTMLInputElement).oninput = (e) => { a.negotiation[key] = (e.target as HTMLInputElement).value; };
  };
  bind('#neg-ocz', 'oczekiwania'); bind('#neg-wid', 'widelki'); bind('#neg-forma', 'formaUmowy'); bind('#neg-dost', 'dostepnosc'); bind('#neg-uwagi', 'uwagi');

  (host.querySelector('#back') as HTMLButtonElement).onclick = () => navigate('assess');
  (host.querySelector('#save') as HTMLButtonElement).onclick = async () => { await repo.save(a); navigate('roster'); };
}
```

- [ ] **Step 2: Weryfikacja ręczna**

Run dev. Sprawdź: wynik liczony poprawnie (w tym ostrzeżenie przy niepełnej ocenie), decyzja, uzasadnienie i negocjacje zapamiętane, „Zapisz" przenosi do zestawienia.

- [ ] **Step 3: Commit**

```bash
git add etap2/src/ui/screen-summary.ts
git commit -m "feat(etap2): podsumowanie ze scoringiem, decyzją, negocjacjami i zapisem"
```

## Task 14: Ekran zestawienia (wczytanie z repo)

**Files:**
- Create: `etap2/src/ui/screen-roster.ts`

- [ ] **Step 1: Implementuj (lista sortowana po wyniku)**

Create `etap2/src/ui/screen-roster.ts`. Sortowanie/filtr/usuwanie dochodzą w Fazie 2; tu lista z repo, sortowana malejąco po wyniku.

```ts
import { computeScore } from '../domain/scoring';
import { DEFAULT_WEIGHTS } from '../domain/weights.config';
import { repo, session } from '../state';
import { navigate } from '../app';

export async function renderRoster(host: HTMLElement): Promise<void> {
  const all = await repo.findAll();
  const rows = all.map((a) => {
    const score = computeScore(a.marks, DEFAULT_WEIGHTS).score;
    const red = Object.values(a.flags).filter((f) => f?.red).length;
    const green = Object.values(a.flags).filter((f) => f?.green).length;
    return { a, score, red, green };
  }).sort((x, y) => y.score - x.score);

  const decTag = (d: string | null) =>
    d === 'yes' ? '<span class="dec-tag yes">Tak</span>' : d === 'wait' ? '<span class="dec-tag wait">Czekamy</span>' : d === 'no' ? '<span class="dec-tag no">Nie</span>' : '—';

  host.innerHTML = `
    <div class="card"><div class="card-head"><h2>Porównanie kandydatów</h2>
      <button class="btn ghost" id="new">+ Nowa rozmowa</button></div>
      <div class="card-body"><table>
        <thead><tr><th>Kandydat</th><th>Data</th><th>Etap I</th><th>Etap II</th><th>Flagi</th><th>Decyzja</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>
          <td class="name">${r.a.candidate.nameOrId}</td><td>${r.a.candidate.date}</td>
          <td>${r.a.candidate.stage1Result || '—'}</td><td><span class="score-tag">${r.score}</span> / 100</td>
          <td>${'🔴'.repeat(r.red)}${'🟢'.repeat(r.green) || (r.red ? '' : '—')}</td><td>${decTag(r.a.decision)}</td>
        </tr>`).join('')}</tbody>
      </table></div></div>`;

  (host.querySelector('#new') as HTMLButtonElement).onclick = () => { session.current = null; session.cur = 0; navigate('start'); };
}
```

- [ ] **Step 2: Weryfikacja ręczna**

Run dev. Przejdź pełny przepływ dwóch kandydatów, sprawdź że obaj są w tabeli posortowani po wyniku, dane przeżywają odświeżenie strony (localStorage).

- [ ] **Step 3: Commit**

```bash
git add etap2/src/ui/screen-roster.ts
git commit -m "feat(etap2): zestawienie kandydatów wczytywane z repozytorium"
```

## Task 15: E2E krytycznej ścieżki (Playwright)

**Files:**
- Create: `etap2/playwright.config.ts`, `etap2/tests/e2e/flow.spec.ts`

- [ ] **Step 1: Konfiguracja Playwright**

Create `etap2/playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
  use: { baseURL: 'http://localhost:5173' },
});
```

- [ ] **Step 2: Test E2E**

Create `etap2/tests/e2e/flow.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('pełny przepływ: start → ocena → podsumowanie → zestawienie', async ({ page }) => {
  await page.goto('/');
  await page.fill('#in-name', 'Test Kandydat');
  await page.click('#btn-start');

  // oceń wszystkie aktywne bloki na poziom 4
  for (let i = 0; i < 4; i++) {
    await page.check('input[name="mark"][value="4"]');
    await page.click('#next');
  }
  // ekran podsumowania
  await expect(page.locator('.scorebig b')).toHaveText('80');
  await page.click('.dbtn.yes');
  await page.click('#save');

  // zestawienie
  await expect(page.locator('td.name')).toContainText('Test Kandydat');
});
```

- [ ] **Step 3: Uruchom E2E**

Run: `npm --prefix etap2 run e2e`
Expected: PASS. (Jeśli liczba bloków ≠ 4 bo E wyłączony — 4 to A,B,C,D; OK.)

- [ ] **Step 4: Commit**

```bash
git add etap2/playwright.config.ts etap2/tests/e2e/
git commit -m "test(etap2): E2E krytycznej ścieżki przepływu"
```

## Task 16: Weryfikacja buildu offline + pokrycie

- [ ] **Step 1: Pełne testy + pokrycie**

Run: `npm --prefix etap2 run coverage`
Expected: PASS; pokrycie domeny/persistence ≥ 80%.

- [ ] **Step 2: Build i test offline**

Run: `npm --prefix etap2 run build`, otwórz `etap2/dist/index.html` przez `file://` w przeglądarce. Sprawdź pełny przepływ offline (bez serwera dev).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(etap2): weryfikacja buildu offline i pokrycia (Faza 1 gotowa)"
```

**Po Fazie 1: aplikacja używalna w realnej rozmowie.**

---

# FAZA 2 — Porównywalność ✅ ZAKOŃCZONA (2026-06-08, PR #4 → main `9bd14ae`)

> Zrealizowane subagent-driven w 8 taskach + 7 poprawek: fix double-count licznika rotacji, uwagi z review (trim `id` importu, hardening CSV przed formula injection, odroczenie `revokeObjectURL`) oraz UX/a11y (stała nawigacja w topbarze do zestawienia, wewnątrzaplikacyjny dialog potwierdzenia zamiast `window.confirm`, widoczne stany bloku w stepperze z legendą, szybki „Zapisz zmiany" w trybie edycji, dostępność klawiaturowa klikalnego wiersza i fokusu dialogu). 110 testów jednostkowych + 2 E2E zielone, pokrycie domain/persistence/export 100% stmts. Build single-file ~70 kB.

Zrealizowane pozycje (każda osobny feature branch, merge --no-ff):

- **Rotacja „najmniej używany" end-to-end:** wpięcie `recordUsage` przy zapisie oceny (`repo.saveVariantUsage` po `repo.save`), inkrement faktycznie użytych wariantów. Test: po zapisie licznik rośnie; podpowiedź na starcie zmienia się na najmniej używany. Files: `src/ui/screen-summary.ts` (zapis), `src/state.ts` (helper).
- **Eksport JSON/CSV + import:** `src/export/json.ts` (pełny rekord) i `src/export/csv.ts` (płaski roster, UTF-8 BOM, escaping przecinków/cudzysłowów/newline). Eksport pojedynczego rekordu i całej tabeli; import JSON (backup/restore). Testy deterministyczne na escaping i round-trip. Files: `src/export/*`, przyciski w `screen-roster.ts` i `screen-summary.ts`.
- **Sortowanie / filtrowanie / usuwanie w zestawieniu:** sterowane sortowanie (wynik, data, kierunek), filtr po decyzji, usuwanie rekordu z potwierdzeniem (`repo.delete`). Files: `screen-roster.ts`.
- **Miękkie egzekwowanie notatek:** znacznik braku notatki/oceny w stepperze + nienachalne ostrzeżenie przy „Zakończ ocenę", bez twardej blokady. Files: `screen-assess.ts`.
- **Wyraźne stany bloku:** trzeci stan „w trakcie" odróżniony od „do zrobienia" (np. po wejściu w blok lub częściowym wypełnieniu). Files: `screen-assess.ts`, `theme.css`.
- **Ekran szczegółów kandydata:** klik w wiersz zestawienia → karta read-only z całością rekordu (score + profil per blok, flagi z opisami, notatki per blok, pytania zadane w bloku D, deepen-asked, negocjacje, decyzja + uzasadnienie, czas). Opcje: Edytuj (powrót do oceny tego kandydata) / Eksport / Usuń. Wymaga drobnego rozszerzenia routera o ścieżkę z `id` (np. `screen: 'detail', detailId: string`). Files: `src/ui/screen-detail.ts` (nowy), `src/app.ts`, `src/state.ts`, `screen-roster.ts` (klikalny wiersz).

# FAZA 3 — Ergonomia, ustawienia i podsumowanie dla rekrutera ✅ ZAKOŃCZONA (2026-06-08, PR #6 → main `fad9fcd`)

> Zrealizowane subagent-driven w 12 taskach + 3 poprawki: diakrytyki w ekranie ustawień, em-dash w komentarzu dialogu, fixy z review PR #6 (parseTargetSec zakres „9-10 min", clamp vIdx dla A-alt, reset prevGlobalLevel w startTimer, treści aria-live „Minelo 45/55 minut rozmowy", clamp spentSec ≥ 0 w migracji). 197 testów jednostkowych + 2 E2E zielone, pokrycie domain/persistence/export 96.96% stmts / 100% funcs / 99.27% lines. Build single-file ~99 kB.

Zrealizowane pozycje (każda osobny feature branch, merge --no-ff):

- **Liczniki czasu per blok + ostrzeżenia:** czyste funkcje `parseTargetSec`/`warnLevel`/`tickBlock`/`totalSpentSec` w `src/domain/timer.ts` (TDD); chip `mm:ss` w stepperze z klasami `warn`/`over`; punktowy update DOM (bez flicker). Pole `Assessment.blockTimes` + migracja schema v1→v2. Files: `src/domain/timer.ts` (nowy), `src/ui/timer-ui.ts`, `screen-assess.ts`, `theme.css`.
- **Pauza + ręczne przewijanie zegara:** czyste `pauseTimer`/`resumeTimer`/`adjustOffset` (z clampem) w domain; przyciski pauzy + −1m / +1m w topbarze; wall-delta accumulation respektujący `paused`. Files: `src/domain/timer.ts`, `src/ui/timer-ui.ts`, `index.html`, `theme.css`.
- **Sygnał 45 min z aria-live:** jednorazowy baner `role="status" aria-live="polite"` „Czas przejść do pytań kandydata i negocjacji."; flaga `timer.phase45Notified` (idempotencja, sync DOM po wczytaniu istniejącej oceny). Files: `index.html`, `src/ui/timer-ui.ts`, `model.ts`, `migrations.ts`, `theme.css`.
- **Domain Settings + ekran ustawień:** `DEFAULT_SETTINGS` + `loadSettings(repo)` z defensywnym mergem (`src/domain/settings.ts`); `state.reloadSettings()` + `export let settings` jako live binding; ekran `screen-settings.ts` z walidacją sumy wag A-D = 100, edycją `includeEInScore` i `showScoreLive`, reset do default, toast „Zapisano."; link „⚙ Ustawienia" w topnav; `IIFE` w `main.ts` ładuje settings przed pierwszym renderem. Files: `src/domain/settings.ts` (nowy), `src/ui/screen-settings.ts` (nowy), `state.ts`, `app.ts`, `main.ts`, `index.html`.
- **Wpięcie Settings do scoringu w UI:** `screen-summary` / `screen-roster` / `screen-detail` używają runtime'owych `settings.weights` i `{ includeE: settings.includeEInScore }` zamiast `DEFAULT_WEIGHTS`. Files: 3 ekrany + nowy `tests/screen-summary.test.ts`.
- **Pokaż punkty na żywo:** gdy `settings.showScoreLive=true`, panel `.live-score` z wynikiem globalnym (aria-live polite) + badge `.step-score` w stepperze tylko dla ocenionych bloków. Domyślnie off. Files: `screen-assess.ts`, `theme.css`.
- **Dostępność klawiaturowa + aria-live:** cyfry 1-5 = poziom aktywnego bloku (ignoruje gdy focus na input/textarea), strzałki ←/→ = nawigacja bloków, Alt+P = pauza; visually-hidden `#timer-announcement` z aria-live polite, komunikaty tylko przy zmianie poziomu (ok→warn→over), pauza/wznowienie; dyskretna legenda klawiszy pod stepperem. Files: `screen-assess.ts`, `timer-ui.ts`, `index.html`, `theme.css`.
- **Wariant A-alt (wykresowy):** pole `Assessment.useAChart`; toggle „Tryb A: wykres" na ekranie startowym (chipy A-1/2/3 disabled gdy on); `BLOCK_A_CHART` z inline SVG (7 słupków) i 3-stopniową skalą mapowaną na poziomy 1/3/5 (dziedziczy wagę 15%); handler klawiszy filtruje 2/4 dla A-alt. Files: `content/blocks.ts`, `model.ts`, `migrations.ts`, `screen-start.ts`, `screen-assess.ts`, `theme.css`.
- **Podsumowanie dla rekrutera (front, bez Traffit-push):** czysta funkcja `buildRecruiterSummary(a, settings) → { text, html }` w `src/domain/recruiter-summary.ts` (sekcje: nagłówek + czas, werdykt, profil per blok z A-alt jako „Blok A (wykres)", flagi, notatki z truncacją 240, decyzja, negocjacje, etap I; marker idempotencji Traffit `<!-- bakk-etap2:${id} -->` na końcu HTML; XSS-safe przez `escapeHtml` przeniesione do `src/domain/escape.ts`); modal podglądu `recruiter-preview-dialog.ts` z `role=dialog aria-modal=true`, focus management, Escape, klik tła; przyciski „Kopiuj jako tekst" (writeText), „Kopiuj jako HTML" (`ClipboardItem` z fallbackiem na writeText(html)), „Zamknij". Przycisk „Podsumowanie dla rekrutera" w `screen-detail` i `screen-summary`. Automatyczny push do Traffit świadomie odłożony — wymaga proxy/Functions z Fazy 4.
# FAZA 4 — Online: hosting na Azure App Service ✅ ZAKOŃCZONA (2026-06-08, PR #9 + #10 → main `b7a138e`)

**URL:** https://bakk-rekrutacja.azurewebsites.net/ (Easy Auth Entra włączony — BAKK Int Apps `5d588d76-...`).

Wariant **B**: dedykowany App Service `bakk-rekrutacja` na planie `asp-bakk-docs` (F1 Free, shared z `intrum-documentation`, zero dodatkowego kosztu). Subpath = root. Wzorzec workflow lustrzany do Intrum docs.

Zrealizowane:
- `.github/workflows/deploy-vite-to-azure.yml` — reużywalny workflow (inputy `app-name`/`resource-group`/`subscription-id`/`app-dir`/`subpath`/`site-base`, secret `azure-publish-profile`), staging do `__artifact/${subpath}/`, `azure/webapps-deploy@v3` z `clean: false`.
- `.github/workflows/deploy-bakk-rekrutacja-etap2.yml` — caller na push main z paths `etap2/**` + `workflow_dispatch`.
- `.github/workflows/etap2-ci.yml` — PR guard: `npm ci && npm test && npm run build` na PR z paths `etap2/**`.
- App Service `bakk-rekrutacja` utworzony, basic publishing creds (SCM+FTP) włączone, publish profile w GitHub secret `AZURE_PUBLISH_PROFILE_BAKK_REKRUTACJA`, pierwszy deploy zielony.
- Easy Auth (Microsoft Entra) włączony zgodnie ze standardem BAKK (Confluence pageId=159417649): Enterprise App `BAKK Int Apps` (single-tenant, pracownicy BAKK), dedykowany secret per App Service, `RedirectToLoginPage`, tokenStore on, cookie 8h.
- `etap2/README-deploy.md` — stan środowiska + sekcja „Reprodukcja od zera".
- `etap2/scripts/enable-easy-auth.ps1` — idempotentny (URI + authsettingsV2) skrypt do Easy Auth.

Świadomie poza zakresem Fazy 4 (przeniesione do Fazy 5):
- Persystencja danych w localStorage przeglądarki — każdy rekruter ma własną listę per urządzenie/profil.
- Brak współdzielenia danych między rekruterami / urządzeniami.
- Brak backendu, brak auto-push Traffit.

---

## Opis fazy (oryginalny)

Wzorzec do skopiowania: `C:/GIT/Intrum` deployuje `integration-api/` i `migration/` (MkDocs Material) na **jeden App Service** `intrum-documentation` (RG `rg-bakk-docs`, subscription `28b7c9a4-317a-495c-99ed-6a6cec116a44`) pod **subpathami** `/integration-api` i `/migration`, używając:
- reużywalnego workflow `.github/workflows/deploy-mkdocs-to-azure.yml` z inputami `app-name`/`resource-group`/`subscription-id`/`mkdocs-dir`/`subpath`/`site-url` i secretem `azure-publish-profile`;
- per-projekt caller workflows (`deploy-intrum-integration-api.yml`, `deploy-intrum-migration.yml`) z `paths:` filtrem;
- `clean: false` w `azure/webapps-deploy@v3` żeby subpathy się nie nadpisywały;
- `--site-url` nadpisywany w mkdocs.yml `sed`-em na docelowy URL z subpathem.

**Cel Fazy 4 minimalistyczny:** wystawić bieżącą aplikację etap2 (front, single-file `dist/index.html`, localStorage) jako stronę pod tym samym (lub siostrzanym) App Service, identycznym wzorcem workflow, **bez backendu**. Persystencja w localStorage zostaje — multi-user / Cosmos / Functions / auto-push Traffit przesuwane do Fazy 5.

- **Hosting (Azure App Service, wzorzec Intrum):**
  - Reużywalny workflow `.github/workflows/deploy-vite-to-azure.yml` (lustrzany do `deploy-mkdocs-to-azure.yml`): inputy `app-name`, `resource-group`, `subscription-id`, `app-dir` (= `etap2`), `subpath`, `site-base` (do nadpisania `base` w `vite.config.ts` przy buildzie). Build: `npm ci && npm run build`. Artifact staging w `__artifact/${subpath}/` z całością `dist/`. Zip + `azure/webapps-deploy@v3` z `clean: false` (jeśli dzielimy App Service z innymi siostrzanymi stronami).
  - Caller `.github/workflows/deploy-bakk-rekrutacja-etap2.yml` z `paths: etap2/**` + `workflow_dispatch`.
  - **Decyzja deploymentowa (do potwierdzenia z użytkownikiem):**
    - (A) **dosiadamy `intrum-documentation`** pod subpathem `/etap2` (RG `rg-bakk-docs`, sub `28b7c9a4-317a-495c-99ed-6a6cec116a44`, reuse istniejącego publish profile);
    - (B) tworzymy **osobny App Service** `bakk-rekrutacja` (lub `bakk-documentation`) w tym samym RG `rg-bakk-docs`, nowy publish profile w nowym secret, root path.
    - Rekomendacja: (A) — ten sam wzorzec, tańsze, mniej zasobów. App Service ma już SSL, custom domain w przyszłości można dorzucić.
  - **Auth do strony:** App Service „Easy Auth" z Microsoft Entra (Authentication blade w portalu — toggle, bez kodu MSAL). To zastępuje SSO na poziomie SWA i nie wymaga zmian w kodzie etap2. Włączane ręcznie w portalu po pierwszym deployu, kontrola dostępu per AAD group.
- **Build single-file vs multi-file:** etap2 ma `vite-plugin-singlefile` → `dist/index.html` ~99 kB inline. App Service obsługuje też SPA bez problemu, ale single-file = jeden artifact, idealne pod static hosting. Zachowujemy `viteSingleFile()`.
- **`base` URL:** w `vite.config.ts` aktualnie `base: './'`. Pod subpathem `/etap2/` ścieżki względne nadal działają (single-file inline), więc zmiana `base` nie jest wymagana. Test: po deployu pod `https://intrum-documentation.azurewebsites.net/etap2/` aplikacja musi się otworzyć z `file://`-stylem assetów inline.
- **Sekrety:** GitHub secret `AZURE_PUBLISH_PROFILE_INTRUM_DOCUMENTATION` (lub nowy, jeśli wariant B) z pełną treścią `.PublishSettings` XML. Pozyskiwany z portalu Azure: App Service → Overview → Get publish profile.
- **Wykluczenie z GitHub Pages:** `_config.yml` w korzeniu repo nadal wyklucza `etap2/` z Jekyll (z Fazy 1). Po deployu na Azure publiczny URL etap2 to App Service, nie GitHub Pages.
- **CI guardrails:** osobny job na PR (push do `feature/*`) buduje `npm --prefix etap2 run build` jako smoke (bez deployu), zapewnia że TS strict + vite build są zielone przed mergem. Deploy tylko z `main`.

# FAZA 5 — Finałowa (multi-user persistence + auto-push Traffit, gotowość do udostępnienia firmowego) ✅ ZAKOŃCZONA (2026-06-09, PR #12, #13, #14, #15, #16, #17, #18, #19, #20 → feature/etap2-faza5)

> **Faza 5 zakończona 2026-06-09.** Cosmos DB serverless w polandcentral,
> Function App **Windows** Consumption Node 24 w **westeurope** (Linux
> Consumption padał z chronic SCM 503 w germanywestcentral i northeurope),
> Easy Auth Bearer cross-origin z BAKK Int Apps (frontend bierze id_token
> z `/.auth/me`, nie access_token, bo audience match), AzureStore + build
> flag VITE_PERSISTENCE=azure, UI migracji z localStorage, deploy workflow
> przez publish profile + Azure/functions-action (OIDC + UAMI próbowane
> ale wymagałyby Reader na sub-level, klasifier security zablokował),
> auto-push do Traffit z **kontem technicznym** (HTTP form login Symfony,
> session cookie cache w Function App z TTL 7h + auto-relogin). Tests:
> backend + frontend zielone. Build front ~108 kB. Backend deploy idzie
> przez publish profile Azure/functions-action (nie OIDC).



**Cel:** każdy rekruter loguje się przez Entra (już działa po Fazie 4), widzi własne rozmowy, dane przeżywają zmianę urządzenia/przeglądarki, lista jest faktycznie współdzielona zespołowo (opcjonalnie filtrowalna „moje / wszystkie"), notatki podsumowujące mogą być jednym kliknięciem dosłane do Traffit. **Po tej fazie aplikacja jest produkcyjnie używalna dla wewnętrznej rekrutacji BAKK i to ostatnia faza.**

**Poza zakresem już tylko:** eksport do Azure SQL, multi-tenant, advanced monitoring — nie potrzebne do uruchomienia.

## Decyzje architektoniczne

### Decyzje zatwierdzone przez usera (sesja 2026-06-08)

1. **Widoczność rozmów:** toggle „moje / wszystkie", default = **moje**.
2. **`VariantUsage`:** **globalny dla zespołu** (jeden licznik), żeby kandydat nie dostał tego samego wariantu od dwóch rekruterów.
3. **Retencja RODO:** **pomijamy automatyczne kasowanie** — `DELETE /api/v1/assessments/{id}` robi hard delete na żądanie usera, brak soft-delete (`archivedAt`), brak job retencji.
4. **Build flag:** `VITE_PERSISTENCE=local|azure` z fallbackiem do `LocalStore` dla `npm run dev` i Vitest. Prod build ustawia `azure`.
5. **Hosting backendu:** **osobny Function App Consumption** `bakk-rekrutacja-api` zamiast inline w App Service.

### Architektura wynikowa

- **Backend:** osobny **Function App `bakk-rekrutacja-api`** na **Windows Consumption plan** w `rg-bakk-docs`, region **westeurope**. (Linux Consumption próbowany wcześniej w germanywestcentral i northeurope - oba miały chronic SCM 503; Windows wystartował od razu). Storage account `stbakkrekrutacjaapi` (westeurope, w tej samej grupie). Koszt: Consumption ~5-15 PLN/mc + storage ~1-2 PLN/mc. Bez upgrade'u `asp-bakk-docs` z F1.
- **Język Functions:** **TypeScript Node 24**, model v4 (`@azure/functions` 4.x). Node 20 osiągnął EOL 2026-04-30, Azure odmawia tworzenia Functions na Node 20. W `etap2/api/` osobny `package.json` i `tsconfig.json`. Wspólne typy `Assessment`/`VariantUsage`/`Settings` przez relative import z `etap2/src/domain/model.ts`.
- **Baza:** **Cosmos DB serverless**, konto `bakk-rekrutacja-db` w `rg-bakk-docs`, baza `etap2`, kontenery:
  - `assessments` — partition key `/userPrincipalName`. Lista filtruje per upn (scope=mine) lub cross-partition (scope=team).
  - `variantUsage` — partition key `/scope`, dokument `id=global`, struktura `{ counts: { A: [n,n,n,n], B: [n,n,n], C: [n,n,n,n,n], D: [n,n,n] } }`.
  - `settings` — partition key `/userPrincipalName`, jeden dokument per user.
  - Koszt: pay-per-RU, < 10 PLN/mc dla ruchu rekrutacji.
- **Autoryzacja cross-origin (Bearer):**
  - Oba zasoby używają tego samego app reg **BAKK Int Apps `5d588d76-2173-49d8-ad6e-4c50b0ca6983`** jako `clientId` w Easy Auth. Token wystawiony dla App Service'u ma `aud = 5d588d76-...` i jest akceptowany przez Function App (też walidującego ten sam audience).
  - Frontend pobiera access token z `https://bakk-rekrutacja.azurewebsites.net/.auth/me` (zwraca aktualny token z sesji Easy Auth) i wysyła do API jako `Authorization: Bearer <token>`.
  - Function App ma Easy Auth on z `unauthenticatedAction=Return401` (nie redirect, bo to API), walidacja JWT przez platformę. Po walidacji wstawia te same nagłówki `X-MS-CLIENT-PRINCIPAL-*`, więc helper `getCurrentUser(req)` z `etap2/api/lib/auth.ts` czyta je tak samo jak inline.
  - **CORS** na Function App: `allowedOrigins = ['https://bakk-rekrutacja.azurewebsites.net']`, `supportCredentials = false` (Bearer, nie cookie).
  - Brak MSAL we froncie, brak tokenów w localStorage. Token pobierany tuż przed requestem przez `AzureStore` (cache na 30 min z early refresh).
- **Format URL API:** `https://bakk-rekrutacja-api.azurewebsites.net/api/v1/*`. Stała w `etap2/src/persistence/azure-store.ts` (`VITE_API_BASE_URL` env).
- **Migracja z localStorage:** UI „Importuj z localStorage" na ekranie startowym (widoczny gdy `repo instanceof AzureStore` oraz nieskonsumowany localStorage istnieje), wywołuje `AzureStore.importBulk` we froncie. Implementacja forwarduje rekordy przez istniejące endpointy `PUT /api/v1/assessments/{id}` + `PUT /api/v1/settings` + `POST /api/v1/variant-usage/increment` (delta vs `{}`). Brak dedykowanego endpointu `/api/v1/migrate` po stronie backendu, żeby uniknąć duplikacji logiki upsertu i walidacji.
- **Sekrety Cosmos i Traffit:** wpięte do **app settings Function App** (nie App Service). Function App ma osobne `COSMOS_ENDPOINT`, `COSMOS_KEY`, `COSMOS_DB`, `TRAFFIT_BASE_URL`, `TRAFFIT_USERNAME`, `TRAFFIT_PASSWORD` (konto techniczne BAKK). Auto-login Symfony Security HTTP form (bez Chromium) - cookie sesji cache w pamięci modułu z TTL 7h, auto-relogin na 401/403.

## Taski

### Task 1: Decyzje + provisioning Cosmos DB serverless

**Files:**
- Create: `etap2/scripts/provision-cosmos.ps1`

- [x] **Step 1:** Potwierdzenie 5 decyzji (zrobione w sesji 2026-06-08, sekcja „Decyzje zatwierdzone").
- [ ] **Step 2:** Skrypt provisioning idempotentny:
  ```powershell
  $rg='rg-bakk-docs'; $acct='bakk-rekrutacja-db'; $db='etap2'
  az cosmosdb create -g $rg -n $acct --capabilities EnableServerless --default-consistency-level Session --locations regionName=polandcentral
  az cosmosdb sql database create -g $rg -a $acct -n $db
  az cosmosdb sql container create -g $rg -a $acct -d $db -n assessments --partition-key-path /userPrincipalName
  az cosmosdb sql container create -g $rg -a $acct -d $db -n variantUsage --partition-key-path /scope
  az cosmosdb sql container create -g $rg -a $acct -d $db -n settings --partition-key-path /userPrincipalName
  ```
- [ ] **Step 3:** Po utworzeniu endpoint + primary key zachowane w pliku tymczasowym; wpięcie do **app settings Function App `bakk-rekrutacja-api`** (Task 2) jako `COSMOS_ENDPOINT` i `COSMOS_KEY`. NIE wpinamy do App Service `bakk-rekrutacja`. Docelowo: managed identity dla Function App z rolą `Cosmos DB Built-in Data Contributor` (jako follow-up po smoke teście).
- [ ] **Step 4:** Seed dokumentu `variantUsage` (`id=global`, `scope=global`, `counts={ A: [0,0,0,0], B: [0,0,0], C: [0,0,0,0,0], D: [0,0,0] }`) przez `az cosmosdb sql ... ` lub przez health endpoint w Task 3.
- [ ] **Step 5:** Smoke test: `az cosmosdb sql container list` zwraca trzy kontenery.
- [ ] **Step 6:** Commit: `chore(etap2): skrypt provisioning Cosmos DB serverless dla etap2`.

### Task 2: Provisioning Function App `bakk-rekrutacja-api` na Consumption + Easy Auth + CORS

**Files:**
- Create: `etap2/scripts/provision-function-app.ps1`
- Create: `etap2/scripts/configure-function-app-auth.ps1`

- [ ] **Step 1:** Skrypt provisioning idempotentny:
  ```powershell
  $rg='rg-bakk-docs'; $loc='polandcentral'
  $func='bakk-rekrutacja-api'; $stg='stbakkrekrutacjaapi'
  az storage account create -g $rg -n $stg -l $loc --sku Standard_LRS
  az functionapp create -g $rg -n $func --consumption-plan-location $loc `
    --runtime node --runtime-version 20 --functions-version 4 `
    --storage-account $stg --os-type Linux
  ```
- [ ] **Step 2:** Easy Auth Entra na Function App z tym samym BAKK Int Apps app reg (`5d588d76-2173-49d8-ad6e-4c50b0ca6983`):
  - Pobierz dedykowany secret z BAKK Int Apps (osobny od secretu dla `bakk-rekrutacja`, zgodnie ze standardem BAKK).
  - `az webapp auth update -g $rg -n $func --enabled true --action Return401 --redirect-provider azureactivedirectory`
  - `az webapp auth microsoft update -g $rg -n $func --client-id 5d588d76-... --client-secret <secret> --tenant-id c21db186-... --issuer https://login.microsoftonline.com/c21db186-.../v2.0`
  - **Lokalny az CLI authV2 bypass** (uszkodzony extension): `$env:AZURE_EXTENSION_DIR = "$env:TEMP/azext-empty"` przed wywołaniem.
  - Weryfikacja: `curl https://bakk-rekrutacja-api.azurewebsites.net/api/health` bez tokenu zwraca **401**, nie 302.
- [ ] **Step 3:** CORS na Function App:
  - `az functionapp cors add -g $rg -n $func --allowed-origins https://bakk-rekrutacja.azurewebsites.net`
  - `supportCredentials = false` (Bearer w `Authorization`, nie cookie).
- [ ] **Step 4:** Wpięcie sekretów Cosmos z Task 1:
  - `az functionapp config appsettings set -g $rg -n $func --settings COSMOS_ENDPOINT=... COSMOS_KEY=... COSMOS_DB=etap2`
- [ ] **Step 5:** Confluence pageId=159417649 (BAKK app standard): zaznaczyć w README-deploy że Function App używa dedykowanego secretu z BAKK Int Apps (osobny od App Service bakk-rekrutacja).
- [ ] **Step 6:** Smoke test: GET `https://bakk-rekrutacja-api.azurewebsites.net` zwraca placeholder Functions runtime; `/api/health` (po Task 3) zwraca 401 bez tokenu.
- [ ] **Step 7:** Commit: `chore(etap2): provisioning Function App bakk-rekrutacja-api + Easy Auth + CORS`.

### Task 3: Functions skeleton w `etap2/api/`

**Files:**
- Create: `etap2/api/host.json`, `etap2/api/package.json`, `etap2/api/tsconfig.json`, `etap2/api/local.settings.json.example`, `etap2/api/.gitignore`, `etap2/api/health/function.json`, `etap2/api/health/index.ts`, `etap2/api/lib/auth.ts`, `etap2/api/lib/cosmos.ts`

- [ ] **Step 1:** Struktura projektu Functions v4 model, Node 24 TS. `host.json` z `extensionBundle` `[4.*, 5.0.0)`. `package.json` z `@azure/functions` 4.x, `@azure/cosmos` 4.x, `zod` 3.x. `tsconfig.json` z `target: ES2022`, `module: NodeNext`, `outDir: dist`.
- [ ] **Step 2:** `lib/auth.ts` z `getCurrentUser(req): { upn: string, oid: string, name: string } | null` czytający Easy Auth headers `X-MS-CLIENT-PRINCIPAL-NAME` / `X-MS-CLIENT-PRINCIPAL-ID` / `X-MS-CLIENT-PRINCIPAL` (base64 JSON, claims w `claims[]`). Easy Auth na Function App wstawia te nagłówki po walidacji Bearer tokenu, więc handler nie waliduje JWT samodzielnie. Fallback dla `npm run dev` z `local.settings.json`: `MOCK_USER_UPN`.
- [ ] **Step 3:** `lib/cosmos.ts` z singleton `CosmosClient` (z `COSMOS_ENDPOINT` + `COSMOS_KEY`), factory metod `assessmentsContainer()` / `variantUsageContainer()` / `settingsContainer()`.
- [ ] **Step 4:** `health/index.ts` zwracający `{ ok: true, user: getCurrentUser(req)?.upn, cosmos: 'reachable' }` po ping cosmos (np. `database.read()`).
- [ ] **Step 5:** `local.settings.json.example` z `AzureWebJobsStorage=UseDevelopmentStorage=true`, `FUNCTIONS_WORKER_RUNTIME=node`, `MOCK_USER_UPN=os.bialek@bakk.com`, pola Cosmos. `.gitignore` ignoruje `local.settings.json`.
- [ ] **Step 6:** Lokalny test: `func start` w `etap2/api/`, `curl http://localhost:7071/api/health` zwraca 200 z mock userem.
- [ ] **Step 7:** Commit: `feat(etap2): skeleton Functions Node 24 TS + auth + cosmos lib`.

### Task 4: Endpointy CRUD assessments

**Files:**
- Create: `etap2/api/assessments-list/`, `etap2/api/assessments-get/`, `etap2/api/assessments-upsert/`, `etap2/api/assessments-delete/`
- Test: `etap2/api/tests/assessments.test.ts`

- [ ] **Step 1:** Testy jednostkowe handlerów z mockiem `@azure/cosmos` (Vitest, `vi.mock('@azure/cosmos')`). Bez emulatora Cosmos w CI.
- [ ] **Step 2:** Implementacje:
  - `GET /api/v1/assessments?scope=mine|team` — `scope=mine` (default) filtruje przez partition `/userPrincipalName = upn`, `scope=team` cross-partition (`enableCrossPartitionQuery`). Każdy rekord wzbogacany o `ownerUpn` z dokumentu (bez ujawniania innych claims).
  - `GET /api/v1/assessments/{id}` — wymaga `partitionKey` query param albo cross-partition lookup; sprawdza, że upn matchuje albo żądanie `scope=team`.
  - `PUT /api/v1/assessments/{id}` — upsert; backend nadpisuje `userPrincipalName` z auth (klient nie może ustawić cudzego), wstawia `updatedAt = now`. Tworzenie wymaga `createdAt`, edycja zachowuje `createdAt` z dokumentu w Cosmos.
  - `DELETE /api/v1/assessments/{id}` — **hard delete** (bez soft-delete, zgodnie z decyzją 3). Wymaga, żeby upn matchowało `userPrincipalName` z dokumentu (nie pozwala kasować cudzych w trybie `scope=team`). Zwraca 204.
- [ ] **Step 3:** Walidacja payload przez Zod. `AssessmentSchema` współdzielona z frontem przez relative import z `../../src/domain/model-schema.ts` (do utworzenia w tym Tasku — wyciągnięcie schematów Zod z istniejących typów TS jeśli jeszcze brak).
- [ ] **Step 4:** Edge cases: 404 gdy `id` nie istnieje, 403 gdy próba edycji/usuwania cudzego dokumentu, 400 gdy payload nie przechodzi walidacji.
- [ ] **Step 5:** Commit: `feat(etap2): API CRUD assessments z partition per-user + scope=team`.

### Task 5: Endpointy VariantUsage + Settings

**Files:**
- Create: `etap2/api/variant-usage-get/`, `etap2/api/variant-usage-increment/`, `etap2/api/settings-get/`, `etap2/api/settings-put/`

- [ ] **Step 1:** `GET /api/v1/variant-usage` — zwraca globalny licznik (partition `global`).
- [ ] **Step 2:** `POST /api/v1/variant-usage/increment` — atomowy increment przez Cosmos `patch` operation; body `{ block: BlockId, variantIdx: number }`.
- [ ] **Step 3:** `GET/PUT /api/v1/settings` — per upn.
- [ ] **Step 4:** Commit: `feat(etap2): API variant-usage (globalny) + settings (per-user)`.

### Task 6: `AzureStore` w froncie + przełącznik build-flag

**Files:**
- Create: `etap2/src/persistence/azure-store.ts`
- Modify: `etap2/src/state.ts`, `etap2/vite.config.ts`
- Test: `etap2/tests/azure-store.test.ts` (z mockowanym fetch)

- [ ] **Step 1:** Helper `getAccessToken()` w `etap2/src/auth/access-token.ts`:
  - `fetch('/.auth/me', { credentials: 'include' })` na **bieżącym** hoście (App Service `bakk-rekrutacja`), zwraca tablicę z `access_token`, `expires_on`.
  - Cache w pamięci modułu (`{ token, expiresAt }`); refresh gdy `expiresAt - now < 5 min`.
  - Przy 401 z `/.auth/me`: redirect do `/.auth/login/aad?post_login_redirect_url=<current>`.
- [ ] **Step 2:** `AzureStore` implementuje `Repository`. Każda metoda buduje URL `${VITE_API_BASE_URL}/api/v1/...`, dodaje header `Authorization: Bearer ${await getAccessToken()}` i wywołuje `fetch` **bez** `credentials: 'include'` (Bearer, nie cookie). Mapowanie odpowiedzi: 204 → `void`, 401 → wymuszony refresh tokenu + 1 retry, 403/404/400 → throw `ApiError` z `status` i body.
- [ ] **Step 3:** W `state.ts`: `export const repo: Repository = import.meta.env.VITE_PERSISTENCE === 'azure' ? new AzureStore() : new LocalStore();` (default = `local` w dev, `azure` w prod build).
- [ ] **Step 4:** `.env.production` (committed): `VITE_PERSISTENCE=azure`, `VITE_API_BASE_URL=https://bakk-rekrutacja-api.azurewebsites.net`. `.env.example` dokumentuje obie zmienne.
- [ ] **Step 5:** Testy: 5+ testów lustrzanych do `local-store.test.ts` z mockiem `fetch` i `getAccessToken` zwracającym fake JWT. Pokrycie 401 retry, 403 throw, 204 void, list per scope.
- [ ] **Step 6:** Commit: `feat(etap2): AzureStore z Bearer auth + przelacznik build-flag VITE_PERSISTENCE`.

### Task 7: UI migracji z localStorage

**Files:**
- Modify: `etap2/src/ui/screen-start.ts`
- Create: `etap2/src/persistence/local-snapshot.ts`, `etap2/src/ui/migration-banner.ts`

- [x] **Step 1:** Na ekranie startowym wykrycie danych w localStorage (klucze `etap2.assessments` / `etap2.variantUsage` / `etap2.settings`) przez `readLocalSnapshot`. Banner pokazuje się tylko gdy `repo instanceof AzureStore` (czyli build prod).
- [x] **Step 2:** Po kliknięciu „Zaimportuj do chmury": `AzureStore.importBulk` we froncie - wywołuje istniejące endpointy `PUT /api/v1/assessments/{id}` per rozmowa, `PUT /api/v1/settings` raz, `POST /api/v1/variant-usage/increment` per delta. **Brak dedykowanego `/api/v1/migrate`** - reuse istniejących handlerów, jedna ścieżka logiki.
- [x] **Step 3:** Po sukcesie: confirm czyszczenia `localStorage` przez `clearLocalSnapshot`, reload listy przez `render()`.
- [x] **Step 4:** Testy jednostkowe (`local-snapshot.test.ts` 5 testów, `migration-banner.test.ts` 4 testy z fake fetch + ClipboardItem fallback).
- [ ] **Step 5:** Commit: `feat(etap2): UI jednorazowej migracji z localStorage do chmury`.

### Task 8: Deployment Function App (nowy workflow GitHub Actions)

**Files:**
- Create: `.github/workflows/deploy-bakk-rekrutacja-api.yml`
- Modify: `etap2/README-deploy.md`

- [ ] **Step 1:** Nowy workflow triggerowany push na `main` z paths `etap2/api/**`:
  ```yaml
  jobs:
    deploy:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: '20' }
        - run: npm ci && npm run build
          working-directory: etap2/api
        - uses: azure/login@v2
          with:
            client-id: ${{ secrets.AZURE_CLIENT_ID }}
            tenant-id: ${{ secrets.AZURE_TENANT_ID }}
            subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
        - uses: Azure/functions-action@v1
          with:
            app-name: bakk-rekrutacja-api
            package: etap2/api
  ```
  OIDC federated credential w app reg dla GitHub Actions (już używane przez deploy-bakk-rekrutacja-etap2.yml).
- [ ] **Step 2:** PR guard dla `etap2/api/**`: dodać do istniejącego `etap2-ci.yml` matrix step: `npm ci && npm run build && npm test` w `etap2/api/`.
- [ ] **Step 3:** Smoke test po deployu (manual w `README-deploy.md` jako instrukcja):
  - `curl https://bakk-rekrutacja-api.azurewebsites.net/api/health` → **401** bez tokenu.
  - Z poziomu zalogowanej sesji w App Service (DevTools `/.auth/me` → token → curl z Bearer) → 200 z `{ ok: true, user: <upn>, cosmos: 'reachable' }`.
- [ ] **Step 4:** README-deploy update: sekcja „Function App `bakk-rekrutacja-api`" z opisem (Consumption plan, Easy Auth z BAKK Int Apps, sekrety Cosmos/Traffit, link do Confluence pageId=159417649).
- [ ] **Step 5:** Commit + PR: `ci(etap2): nowy workflow deploy-bakk-rekrutacja-api dla Function App`.

### Task 9: Auto-push notatek do Traffit

**Files:**
- Create: `etap2/api/traffit-push/`, `etap2/api/lib/traffit-client.ts`
- Modify: `etap2/src/ui/recruiter-preview-dialog.ts`

Marker idempotencji `<!-- bakk-etap2:${id} -->` jest budowany inline w `traffit-push.ts` po stronie backendu (treść notatki to po prostu HTML z front przez `buildRecruiterSummary` — backend nie wstawia markera, tylko sprawdza obecność w istniejących notatkach Traffit).

**Zmiana vs pierwotny plan:** Linux Consumption Function App nie wspiera Chromium → niemożliwy auto-login do Traffit jak w `traffit-scorer/src/push-notes.js`. Zamiast tego pre-shared session cookie z lokalnej przeglądarki user'a (renew raz na ~30 dni).

- [x] **Step 1:** `lib/traffit-client.ts` z session-cookie-based auth (env `TRAFFIT_BASE_URL` + `TRAFFIT_SESSION_COOKIE` w app settings **Function App `bakk-rekrutacja-api`**, NIE App Service). Na 401/403 rzuca `TraffitSessionExpiredError` (502 do klienta), bez auto-relogin (brak Chromium).
- [x] **Step 2:** `POST /api/v1/traffit/push` body `{ assessmentId, employeeId, html }`:
  - Sprawdź że Assessment istnieje w partycji wykonującego (ownership) - Cosmos `assessmentsContainer.item(id, upn).read()`.
  - `findExistingNoteId(employeeId, assessmentId)` listuje activities, filtruje notatki z markerem `<!-- bakk-etap2:${assessmentId} -->`.
  - Jeśli znaleziona → `PUT /api/v2/employees/{id}/notes/{noteId}` (update).
  - Inaczej → `POST /api/v2/employees/{id}/notes` (create).
  - Zwróć `{ noteId, action: 'created'|'updated' }`. 501 gdy brak konfiguracji Traffit.
- [x] **Step 3:** Sekrety Traffit wpięte do app settings Function App przez `etap2/scripts/set-traffit-secrets.ps1`: `az functionapp config appsettings set -g rg-bakk-docs -n bakk-rekrutacja-api --settings TRAFFIT_BASE_URL=... TRAFFIT_SESSION_COOKIE=...`. User wkleja Cookie z DevTools → Network → Request Headers → Cookie po zalogowaniu do Traffit.
- [x] **Step 4:** UI: przycisk „Wyślij do Traffit" w `recruiter-preview-dialog.ts` (visible tylko gdy `repo instanceof AzureStore`). `window.prompt` o ID Traffit kandydata, stan disabled w trakcie, status pod akcjami.
- [x] **Step 5:** Testy jednostkowe `api/tests/traffit-client.test.ts` (6 testów: marker detect, create vs update, 401 session expired, Cookie header).
- [x] **Step 6:** Commit: `feat(etap2): auto-push notatki podsumowania do Traffit przez API proxy (Faza 5 Task 9)`.

### Task 10: Cleanup + dokumentacja

**Files:**
- Modify: `etap2/README-deploy.md`, `docs/superpowers/plans/2026-06-08-ocena-rozmowy-etap2.md`

- [ ] **Step 1:** Dopisać w `README-deploy.md` sekcję „Faza 5 — multi-user + Traffit" z opisem stanu (osobny Function App Consumption + Cosmos serverless, cross-origin Bearer auth z BAKK Int Apps), kosztu (Function App Consumption ~5-15 PLN/mc + storage ~1-2 PLN/mc + Cosmos serverless < 10 PLN/mc), monitoringu (Application Insights wpięte do Function App), procedurą wpięcia sekretów Traffit, instrukcją rotacji secretu BAKK Int Apps dla Function App.
- [ ] **Step 2:** W planie oznaczyć Fazę 5 jako ✅ ZAKOŃCZONA z datą.
- [ ] **Step 3:** Commit jako osobny PR docs (jak po Fazach 3 i 4).

## Self-review Fazy 5

- Pokrycie celu „udostępnienie firmowe": multi-user persistence ✅, autoryzacja per rekruter ✅, migracja danych ✅, auto-push Traffit ✅, koszt akceptowalny (Cosmos serverless < 10 PLN/mc + Function App Consumption ~5-15 PLN/mc + storage ~1-2 PLN/mc, bez ruszania F1 plan App Service).
- Co poza zakresem (świadomie, nie potrzebne do uruchomienia): eksport do Azure SQL, multi-tenant, advanced monitoring custom dashboardy, auto-retencja RODO (decyzja: hard delete na żądanie, bez job retencji).
- Ryzyka:
  - **Cross-origin auth Bearer:** front pobiera token z `/.auth/me` App Service'u, Function App waliduje audience. Wymaga aby oba miały **ten sam clientId** w Easy Auth (BAKK Int Apps `5d588d76-...`). Smoke test (Task 3+8) potwierdza, że token z App Service jest akceptowany przez Function App.
  - **F1 plan zostaje** — nie ruszamy `intrum-documentation` ani `kz-test1`. Function App ma osobny Consumption plan, niezależny od `asp-bakk-docs`.
  - **Cosmos serverless** ma limit 5000 RU/sec na partition — nadmiarowe dla rekrutacji.
  - **Brak retencji RODO:** dane utrzymują się bez automatycznego soft-delete. Reakcja na żądanie usunięcia danych = ręczne `DELETE /api/v1/assessments/{id}` z UI. Świadomie poza zakresem Fazy 5.
  - **Traffit** nie ma oficjalnego API → klient w `traffit-scorer/src/push-notes.js` opiera się na session cookie. Endpoint może się zmienić bez ostrzeżenia. Wbudowany retry/relogin minimalizuje ryzyko, ale nie eliminuje.
  - **Token z `/.auth/me`:** Easy Auth domyślnie wystawia token z audience = clientId aplikacji (tu BAKK Int Apps). Należy zweryfikować w Task 6, że App Service nie zwraca tokenu z audience Graph (`https://graph.microsoft.com`) — wtedy Function App go odrzuci. Jeśli tak, konfiguracja `additionalLoginParams: ['resource=5d588d76-...']` w authsettingsV2 App Service.

---

## Self-review (pokrycie spec)

- Stack/struktura/trwałość/scoring (naprawa)/rotacja/treści/ekrany/rebranding/testy/fazowanie: pokryte taskami Fazy 1 + backlog Faz 2–4.
- Przesunięcia ze spec (negocjacje + wybór wariantu na starcie do Fazy 1): Task 11 (wybór wariantu, notatka etapu I), Task 13 (negocjacje podpięte).
- Rozstrzygnięcia niejasności (C=25%, E waga 0, deepen bez punktów, D jako pula, eksport CSV BOM, soften werdykt): odwzorowane w Task 4/5/6/12/13 i backlogu Fazy 2.
- Świadome pominięcia w Fazie 1 (eksport, sort/filtr/usuwanie, timery per blok, ustawienia, a11y klawiatura, A-alt, online) jawnie wymienione w backlogu, nie ukryte.
