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

# FAZA 2 — Porównywalność (backlog)

Każda pozycja = osobny task w stylu TDD jak wyżej. Pełne rozpisanie na kroki przygotuję, gdy ruszymy fazę.

- **Rotacja „najmniej używany" end-to-end:** wpięcie `recordUsage` przy zapisie oceny (`repo.saveVariantUsage` po `repo.save`), inkrement faktycznie użytych wariantów. Test: po zapisie licznik rośnie; podpowiedź na starcie zmienia się na najmniej używany. Files: `src/ui/screen-summary.ts` (zapis), `src/state.ts` (helper).
- **Eksport JSON/CSV + import:** `src/export/json.ts` (pełny rekord) i `src/export/csv.ts` (płaski roster, UTF-8 BOM, escaping przecinków/cudzysłowów/newline). Eksport pojedynczego rekordu i całej tabeli; import JSON (backup/restore). Testy deterministyczne na escaping i round-trip. Files: `src/export/*`, przyciski w `screen-roster.ts` i `screen-summary.ts`.
- **Sortowanie / filtrowanie / usuwanie w zestawieniu:** sterowane sortowanie (wynik, data, kierunek), filtr po decyzji, usuwanie rekordu z potwierdzeniem (`repo.delete`). Files: `screen-roster.ts`.
- **Miękkie egzekwowanie notatek:** znacznik braku notatki/oceny w stepperze + nienachalne ostrzeżenie przy „Zakończ ocenę", bez twardej blokady. Files: `screen-assess.ts`.
- **Wyraźne stany bloku:** trzeci stan „w trakcie" odróżniony od „do zrobienia" (np. po wejściu w blok lub częściowym wypełnieniu). Files: `screen-assess.ts`, `theme.css`.
- **Ekran szczegółów kandydata:** klik w wiersz zestawienia → karta read-only z całością rekordu (score + profil per blok, flagi z opisami, notatki per blok, pytania zadane w bloku D, deepen-asked, negocjacje, decyzja + uzasadnienie, czas). Opcje: Edytuj (powrót do oceny tego kandydata) / Eksport / Usuń. Wymaga drobnego rozszerzenia routera o ścieżkę z `id` (np. `screen: 'detail', detailId: string`). Files: `src/ui/screen-detail.ts` (nowy), `src/app.ts`, `src/state.ts`, `screen-roster.ts` (klikalny wiersz).

# FAZA 3 — Ergonomia i ustawienia (backlog)

- **Liczniki czasu per blok + ostrzeżenia:** czas wejścia/spędzony per blok, miękkie ostrzeżenie kolorystyczne po przekroczeniu sugerowanego czasu. Files: `src/domain/timer.ts` (logika, TDD), `screen-assess.ts`.
- **Pauza + ręczne przewijanie zegara:** przycisk pauzy w nagłówku, korekta offsetu (`timer.offsetSec`). Files: `timer-ui.ts`, `src/domain/timer.ts`.
- **Sygnał 45 min:** jawny komunikat „czas przejść do pytań kandydata i negocjacji". Files: `timer-ui.ts`.
- **Przełącznik „pokaż punkty na żywo":** `Settings.showScoreLive`, domyślnie off; gdy on, pokazuj wynik bloku w trakcie oceny. Files: `screen-settings.ts` (nowy), `screen-assess.ts`, `state.ts`.
- **Ekran ustawień:** edycja wag (nadpisanie `weights.config`), flaga `includeEInScore`, zapis do `Settings`; `computeScore` już przyjmuje wagi jako argument. Files: `src/ui/screen-settings.ts`, `repo.saveSettings`.
- **Pełna dostępność / klawiatura:** cyfry 1–5 = poziom w aktywnym bloku, strzałki = dalej/wstecz, skrót na pauzę, `aria-live` na zegarze i ostrzeżeniach. Files: `screen-assess.ts`, `timer-ui.ts`.
- **Wariant A-alt (wykresowy):** alternatywny tryb bloku A (przełącznik „algorytm / wykres" na starcie), własna skala 1/3/5, render prostego wykresu. Dziedziczy wagę 15%. Files: `content/blocks.ts`, `screen-start.ts`, `screen-assess.ts`.

# FAZA 4 — Online: Azure + SSO (backlog)

- **Hosting:** Azure Static Web Apps, deploy z GitHub (osobny workflow, NIE publikujący treści przez Pages). `staticwebapp.config.json` z wbudowanym logowaniem Microsoft Entra (bez kodu MSAL).
- **API:** cienkie Azure Functions (CRUD ocen, VariantUsage, Settings). Język do decyzji: TS (spójność typów z frontem przez współdzielony pakiet) lub .NET (kompetencje zespołu).
- **Baza:** Cosmos DB serverless, „jedna ocena = jeden dokument JSON".
- **Repozytorium:** `src/persistence/azure-store.ts` implementujące ten sam interfejs `Repository` (fetch do Functions z tokenem Entra). Przełączenie implementacji w `state.ts`.
- **Migracja danych:** z localStorage do chmury przez istniejący eksport/import JSON.
- **Otwarte decyzje fazy:** model ról/uprawnień Entra, retencja danych (RODO), czy `VariantUsage` współdzielony globalnie po stronie serwera.

---

## Self-review (pokrycie spec)

- Stack/struktura/trwałość/scoring (naprawa)/rotacja/treści/ekrany/rebranding/testy/fazowanie: pokryte taskami Fazy 1 + backlog Faz 2–4.
- Przesunięcia ze spec (negocjacje + wybór wariantu na starcie do Fazy 1): Task 11 (wybór wariantu, notatka etapu I), Task 13 (negocjacje podpięte).
- Rozstrzygnięcia niejasności (C=25%, E waga 0, deepen bez punktów, D jako pula, eksport CSV BOM, soften werdykt): odwzorowane w Task 4/5/6/12/13 i backlogu Fazy 2.
- Świadome pominięcia w Fazie 1 (eksport, sort/filtr/usuwanie, timery per blok, ustawienia, a11y klawiatura, A-alt, online) jawnie wymienione w backlogu, nie ukryte.
