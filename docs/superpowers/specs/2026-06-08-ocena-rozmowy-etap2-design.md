# Spec: Aplikacja do prowadzenia i oceny II etapu rozmowy rekrutacyjnej

**Data:** 2026-06-08
**Status:** zaakceptowany design (do przejścia na plan implementacji)
**Źródła:** `PRD_aplikacja_ocena_rozmowy.md`, `POC_ocena_rozmowy.html` (prototyp przepływu i scoringu)

---

## 1. Cel i kontekst

Narzędzie **prowadzącego** (architekta .NET) do prowadzenia i oceny **II, finałowego etapu** rozmowy rekrutacyjnej na Junior C#/SQL. Kandydat aplikacji nie widzi. Cel nadrzędny: ten sam zestaw bodźców dla każdego kandydata, ocena behawioralna na opisanych skalach, wynik liczony przez system, ekran zbiorczy **do porównania kandydatów między sobą**. Twardy limit rozmowy: 60 min.

Relacja do etapu I: w tym samym repo (`bakk-rekrutacja`) żyją materiały etapu I (publiczne zadanie SQL `index.html` + zaszyfrowany klucz `eval.html`). Aplikacja etapu II to **osobny artefakt**. Jedyne powiązanie to ręcznie wpisywane pole „wynik etapu I". Aplikacja etapu II ląduje w podkatalogu **niepublikowanym na GitHub Pages**.

POC wiernie odwzorowuje rdzeń: przepływ start → bloki A–E → podsumowanie → zestawienie, ocenę 5-poziomową z opisami i kluczami, ukrywanie punktów do podsumowania, wagi, wzór scoringu, profil per blok, flagi, ręczną decyzję, warianty A/B/C, pytania pogłębiające bez osobnych punktów, blok E bez wagi.

## 2. Decyzje architektoniczne

| Obszar | Decyzja |
|---|---|
| Stack | Vite + TypeScript, modularne źródła, build do statycznej paczki. Vanilla TS, bez frameworka UI (4 ekrany, brak routingu/złożonego stanu współdzielonego) |
| Trwałość | Za **interfejsem repozytorium**. Faza 0: localStorage. Faza online: druga implementacja (Azure Functions + Cosmos serverless) |
| Ścieżka wdrożenia | Najpierw używalna aplikacja na localStorage (do realnej rozmowy), później lekki Azure: Static Web Apps + wbudowane logowanie Microsoft Entra (zero kodu MSAL) + cienkie Functions + Cosmos DB serverless |
| Zakres | Pełne PRD, w fazach |
| Design | POC jako wzorzec UX odtworzony wiernie, rebranding na BAKK (paleta cream/amber, Newsreader/IBM Plex jak w etapie I) |
| Repo | Ten sam `bakk-rekrutacja`, podkatalog niepublikowany na Pages |
| Język | Polski (UI i treści) |

Świadomie nadpisujemy wymóg PRD „offline, jeden plik, bez backendu": docelowo aplikacja webowa z cienkim API i wspólną bazą (porównywalność między prowadzącymi/urządzeniami). W fazie 0 aplikacja i tak działa lokalnie/offline na localStorage, więc nic nie tracimy na starcie. Pełna odporność na utratę sieci w trybie online to nice-to-have, nie zobowiązanie.

## 3. Architektura i struktura modułów

Czysta logika domenowa odcięta od DOM i od trwałości (warunek TDD/80% i bezbolesnego przejścia localStorage → Azure).

```
src/
  domain/
    model.ts            # typy + walidacja na granicach (Assessment, Block, Settings...)
    scoring.ts          # czysta funkcja: wynik ważony 0-100 + profil per blok (z naprawą normalizacji)
    variants.ts         # rotacja "najmniej używany" + licznik (deterministyczna, testowalna)
    weights.config.ts   # wagi w JEDNYM miejscu (A15/B30/C25/D30, E0)
    timer.ts            # logika zegara: elapsed, pauza, offset, progi 45/55, per-blok
  content/
    blocks.ts           # treści A-E, klucze, skale, warianty, pytania pogłębiające (sportowane z POC)
  persistence/
    repository.ts       # INTERFEJS: findAll/get/save/delete + VariantUsage + Settings
    local-store.ts      # implementacja localStorage (faza 0)
    migrations.ts       # schemaVersion N->N+1
    # azure-store.ts    # implementacja Functions+Cosmos (faza online, ten sam interfejs)
  export/
    csv.ts  json.ts     # eksport (+ import JSON)
  ui/
    screen-start.ts  screen-assess.ts  screen-summary.ts  screen-roster.ts
    components/...  theme.css (BAKK)
  app.ts                # router ekranów + bootstrap
tests/                  # Vitest (domena) + Playwright (1 krytyczny E2E)
```

Limit ~200-400 linii/plik. Logika domenowa w czystych funkcjach przyjmujących dane jako argumenty (np. `scoring(marks, weights)`), bez czytania globali. Repozytorium zwraca nowe obiekty, nie mutuje (POC mutuje `state` w miejscu, to zmieniamy).

## 4. Model danych

```
Assessment {
  id, schemaVersion,
  candidate { nameOrId, date, stage1Result: string, stage1Note: string },
  selectedVariants { A, B, C, D, E },     // indeks użytego wariantu per blok
  deepenAsked { [blockId]: bool },         // czy zadano pytanie pogłębiające (bez wpływu na punkty)
  marks { [blockId]: 1..5 },
  flags { [blockId]: { red: bool, green: bool } },
  notes { [blockId]: string },
  decision: 'yes' | 'no' | 'wait' | null,
  decisionNote: string,
  negotiation { oczekiwania, widelki, formaUmowy, dostepnosc, uwagi },  // notatkowe, poza scoringiem
  timer { elapsedSec, paused, offsetSec },
  useE: bool,
  createdAt, updatedAt
}

VariantUsage { [blockId]: { [variantIdx]: count } }   // globalny, wspólny dla rotacji
Settings { weights, showScoreLive: false, includeEInScore: false }
```

`schemaVersion` + kroki migracji, bo PRD zapowiada strojenie wag i ewolucję treści. Uszkodzony/niedostępny localStorage nie wywala aplikacji (obsługa błędu, nie ciche połknięcie).

## 5. Logika domenowa (poprawki względem POC)

- **Scoring**: `wynik = Σ(poziom_i · waga_i) / Σ(5 · waga_i) · 100`, ale mianownik **tylko po blokach faktycznie ocenionych i ważonych**. Nieoceniony blok nie jest karany jak 0/5. Przy niekompletnej ocenie: ostrzeżenie „oceniono X/4 bloki", nie ciche zaniżenie. Blok E (waga 0) nie wchodzi do wyniku (`includeEInScore` domyślnie false).
- **Rotacja wariantów**: zamiast `Math.random()` deterministyczny `argmin` licznika `VariantUsage` per (blok, wariant); remis → najniższy indeks; inkrement **przy zapisie rozmowy** (faktycznie użyty wariant, łącznie z ręczną zmianą). Podpowiedź na ekranie startowym + ręczna zmiana (start i w bloku). Blok D nie podlega licznikowi wariantów (jest pulą pytań).
- **Werdykt progowy**: złagodzony do neutralnego opisu profilu, bez sugerowania decyzji (PRD: decyzja ręczna, nie z progu).
- **Zegar**: elapsed liczony od startu, korygowalny offsetem, pauzowalny; progi 45 min (sygnał „przejdź do pytań/negocjacji") i 55 min; liczniki per blok z miękkim ostrzeżeniem po przekroczeniu sugerowanego czasu (kolor, bez blokady).

## 6. Treści

Bloki A–E z sekcji 5 PRD, sportowane z `BLOCKS` w POC do `content/blocks.ts`: A-1/A-2/A-3 (algorytm), B-1/B-2/B-3 (objaw vs przyczyna), C-1/C-2/C-3 (presja), D (pula 5 pytań, wybór 3–4 przez checkboxy), E (podlewanie, jakościowo). Każdy blok: treść do przeczytania, klucz „czego szukać", flaga czerwona/zielona jako wskazówki, pełna 5-poziomowa skala, pytanie pogłębiające. Klucz bloku A wstawiamy z poprawnym wynikiem (np. A-1 → `(10, 4)`), pułapkę opisujemy osobno jako „częsty błąd". Wariant **A-alt** (wykresowy, własna skala 1/3/5, punktowane uzasadnienie) jako alternatywny TRYB bloku A (przełącznik „algorytm / wykres" na starcie, dziedziczy wagę 15%), realizowany w Fazie 3.

## 7. Ekrany i UX

Cztery ekrany odtworzone z POC, rebranding na BAKK (cream/amber, Newsreader/IBM Plex, marka BAKK zamiast „Sito·rec"):

- **Start**: kandydat (imię/ID), data, wynik etapu I, **notatka z etapu I** (osobne pole), **podpowiedź/wybór wariantu per blok**, toggle bloku E, „Rozpocznij rozmowę".
- **Ocena (bloki)**: karta per blok z treścią do przeczytania, kluczem, skalą 1–5 jako natywny radio-group, flagi, **obowiązkowa-miękko notatka**, sekcja pytania pogłębiającego z checkboxem „zadano", zegar globalny w nagłówku, stan bloku (do zrobienia / w trakcie / oceniony) w stepperze, punkty ukryte (plakietka).
- **Podsumowanie**: wynik 0–100 (ring), profil per blok (słupki), lista flag, decyzja ręczna Tak/Nie/Czekamy, uzasadnienie, **sekcja negocjacji podpięta do stanu** (oczekiwania, widełki, forma umowy, dostępność, uwagi).
- **Zestawienie**: tabela (imię/ID, data, etap I, etap II, flagi, decyzja), sortowanie, filtr po decyzji, usuwanie rekordu z potwierdzeniem, eksport.

Ergonomia „na żywo": duże strefy klikalne, minimum scrollowania, obsługa klawiatury (1–5 = poziom w aktywnym bloku, strzałki = dalej/wstecz, skrót na pauzę), focus states, ARIA live na zegarze i ostrzeżeniach, semantyczne radio-group/fieldset zamiast div+onclick. Desktop-first.

## 8. Rozstrzygnięcia niejasności PRD

- C = 25% (zgodne z tabelą 3.4 i sumą 100%).
- Blok E: skala 1–5 przy wadze 0, wizualnie odcięta od punktów („ocena jakościowa, nie wlicza się").
- Pytanie pogłębiające: ten sam pojedynczy poziom bloku, bez osobnych punktów; znacznik „zadano" dla porównywalności.
- Blok D: pula 5 pytań z checkboxami wyboru 3–4; bez licznika wariantów.
- Notatki: egzekwowane miękko (znacznik braku + nienachalne ostrzeżenie przy „Zakończ ocenę", możliwość kontynuacji).
- Eksport: CSV = płaski roster (UTF-8 z BOM dla polskich znaków, poprawne escapowanie), JSON = pełny rekord; import JSON jako backup/restore.
- Wagi: domyślne w `weights.config.ts`, nadpisywalne w ekranie ustawień, utrwalane w `Settings`; scoring przyjmuje wagi jako argument.

## 9. Czego świadomie nie robimy

- Nie dodajemy punktowanych bloków bonusowych (złamałoby porównywalność, PRD: „nie zmieniać").
- Decyzja nie jest wyliczana z progu.
- Pytania pogłębiające i blok E nie dodają punktów.

## 10. Faza online (Azure, faza 4)

Azure Static Web Apps + **wbudowane** logowanie Microsoft Entra (konfiguracja w `staticwebapp.config.json`, bez kodu MSAL), cienkie Azure Functions jako API, Cosmos DB serverless („jedna ocena = jeden dokument JSON"). Druga implementacja interfejsu repozytorium (`azure-store.ts`). Migracja danych z localStorage przez istniejący import/export. Vite `base: './'` lub single-file output, by działało też z `file://`.

Otwarte na fazę online (do decyzji przy realizacji, nie blokują faz 1–3): język Functions (TS dla spójności vs .NET dla zespołu), model ról/uprawnień w Entra, retencja danych (RODO), ewentualny współdzielony `VariantUsage` po stronie serwera.

## 11. Testy

- **Vitest** na czystej domenie (cel 80%+): scoring (wszystkie 5 → 100; wszystkie 1 → 20; nieoceniony blok nie zaniża; E nie wpływa; zmiana wag → przeliczony wynik), rotacja (deterministyczny argmin, remis stabilny, inkrement przy zapisie), migracje (round-trip, N→N+1 zachowuje dane, uszkodzony storage nie wywala), eksport (CSV/JSON deterministyczny, escaping przecinków/cudzysłowów/newline/polskich znaków).
- Testy charakteryzujące scoring **przed** naprawą buga (TDD/regresja).
- **Playwright**: 1 E2E na krytyczną ścieżkę start → ocena → podsumowanie → zapis → roster.

## 12. Fazowanie

**Faza 1 (używalne szybko, do realnej rozmowy):** scaffold Vite+TS, treści A–E z POC, scoring + testy (z naprawą normalizacji), 4 ekrany odtworzone z rebrandingiem BAKK, localStorage przez repozytorium, zegar globalny, **pola negocjacji (podpięte i utrwalane)**, **wybór wariantu na ekranie startowym** (ręczny; inteligentna podpowiedź „najmniej używany" dochodzi w Fazie 2), notatka z etapu I.

**Faza 2 (porównywalność):** licznik „najmniej używany" zasilający podpowiedź wariantu, eksport JSON/CSV + import, sortowanie/filtrowanie/usuwanie w zestawieniu, miękkie egzekwowanie notatek, wyraźne stany bloku.

**Faza 3 (ergonomia):** liczniki czasu per blok + ostrzeżenia, pauza + ręczne przewijanie zegara, sygnał 45 min, przełącznik „pokaż punkty na żywo", ekran ustawień (wagi, flaga `includeEInScore`), pełne a11y (klawiatura, ARIA), wariant A-alt (wykresowy).

**Faza 4 (online, gdy zechcesz):** Azure SWA + wbudowane Entra, Functions + Cosmos serverless, `azure-store.ts`, migracja danych.

Przesunięcia względem pierwotnego podziału: pola negocjacji i wybór wariantu na starcie przeniesione z Fazy 2 do Fazy 1.
