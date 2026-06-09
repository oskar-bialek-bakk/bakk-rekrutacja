# Wybór kandydata z Traffit w „Nowej rozmowie" (etap II)

Data: 2026-06-09
Status: zaakceptowany do planu

## Cel

Dodać krok wstępny przed wysyłką podsumowania do Traffit: pobranie kandydatów
z etapu rekrutacji „Spotkanie BK" i wyświetlenie ich w dropdownie formularza
„Nowa rozmowa". Dzięki temu rekruter wybiera kandydata z listy (z jego ID i
rekrutacją z Traffit), a notatka z podsumowania trafia do Traffit bez ręcznego
wpisywania ID kandydata. Ręczne wprowadzanie danych pozostaje jako alternatywa.

## Kontekst i stan obecny

- Formularz „Nowa rozmowa" (`src/ui/screen-start.ts`): pole free-text
  „Kandydat — imię i nazwisko / ID". Brak powiązania z Traffit.
- Model `Assessment.candidate` (`src/domain/model.ts`): bez ID Traffit.
- Wysyłka (`src/ui/recruiter-preview-dialog.ts`): `window.prompt` pyta o ID
  kandydata przy każdej wysyłce.
- Backend (`api/src/lib/traffit-client.ts` + `traffit-login.ts`): logowanie
  konta technicznego (cookie sesji, auto-relogin) + operacje na notatkach
  `/api/v2/employees/{id}`. Funkcje Traffit aktywne tylko online
  (`repo instanceof AzureStore`).

## Kluczowa zasada domenowa

Jedna rozmowa = **kandydat × rekrutacja**. Ten sam kandydat obecny w wielu
rekrutacjach może mieć wiele rozmów. Jednostką tożsamości jest para
`(traffitId, recruitmentId)`.

## Ustalenia z Traffit (discovery jednorazowe, 2026-06-09)

- Etap „Spotkanie BK": `state.id = 15`, `type = initial_accept`,
  faktyczna nazwa w Traffit to **„Spotkanie BK"** (bez „z").
- Otwarte rekrutacje deweloperskie (62, 63) oraz 65 współdzielą
  `workflow.id = 1`, więc `stage.id = 15` jest **spójny** między rekrutacjami.
  Dlatego ID etapu zapinamy na sztywno jako stałą, bez odpytywania workflow
  w czasie działania.

Stałe w kodzie (nie env, zaszyte na sztywno):

```
const BK_STAGE_ID = 15;
const BK_STAGE_NAME = 'Spotkanie BK';   // lokalny guard po nazwie/id
```

## Endpointy Traffit (przez sesję konta technicznego)

- `POST /api/recruitment/filter` (url-encoded, paginacja `limit`/`offset`):
  lista rekrutacji `{count, items[{id, name, isClosed, ...}]}`. Bierzemy
  `isClosed === false`.
- `POST /api/employee/filter` (url-encoded grid, paginacja): kandydaci dla
  `recruitmentId` (`job.id`) + `stage.id` z `type=reached, current=1`. Zwraca
  `items[]` z m.in. `id, name, lastname, email, activeRecruitments[].state`.
  Lokalnie zostawiamy tylko tych, których bieżący `state.id === 15` i
  `state.color !== 'red'` (odsiew odrzuconych, wzór z traffit-scorer
  `src/fetch.js`).

Sesja `{logged:false}` lub 401/403 → invalidacja + relogin + retry (mechanizm
już istnieje w `traffit-login.ts`).

## Architektura rozwiązania

### 1. Model (`src/domain/model.ts`)

`Candidate` dostaje trzy opcjonalne pola:

```
interface Candidate {
  nameOrId: string;
  date: string;
  stage1Result: string;
  stage1Note: string;
  traffitId?: number;        // employeeId w Traffit
  recruitmentId?: number;    // job.id w Traffit
  recruitmentName?: string;  // do etykiety i nagłówka notatki
}
```

Zmiana addytywna. Migracja łagodna (pola opcjonalne; backendowy
`AssessmentSchema` jest już `passthrough`). `createEmptyAssessment` przyjmuje je
przez obiekt `candidate`.

### 2. Backend — nowy endpoint `GET /api/v1/traffit/candidates`

Plik `api/src/functions/traffit-candidates.ts`. Wzór błędów jak `traffit-push.ts`:
- `requireUser(req)` (autoryzacja jak przy push),
- `readConfig()`; brak konfiguracji → `501`,
- `TraffitSessionExpiredError` → `502`, `TraffitLoginError` → `502`.

Nowa metoda w `traffit-client.ts`:

```
listBkCandidates(): Promise<Array<{
  employeeId: number;
  recruitmentId: number;
  recruitmentName: string;
  fullName: string;
  email: string | null;
}>>
```

Przepływ:
1. `listOpenRecruitments()` → `POST /api/recruitment/filter`, filtr `!isClosed`.
2. Dla każdej otwartej rekrutacji: `POST /api/employee/filter` z
   `recruitmentId` + `stage.id = 15`.
3. Lokalny guard: zostaw `state.id === 15` i `state.color !== 'red'`.
4. Spłaszcz do listy z tagiem rekrutacji.

Wymaga rozszerzenia warstwy `req()` w `traffit-client.ts` o obsługę
`Content-Type: application/x-www-form-urlencoded` i surowego body (obecnie
tylko JSON). Endpointy `/api/recruitment/filter` i `/api/employee/filter` nie
są pod `/api/v2`, więc metoda buduje pełną ścieżkę względem `baseUrl`.

Uwaga zakresowa: lista obejmuje **wszystkie** otwarte rekrutacje mające etap
„Spotkanie BK" (w tym np. Inside Sales, bo współdzieli workflow 1). Rekruter
rozróżnia je po nazwie rekrutacji w etykiecie. Ewentualne zawężenie do ról
deweloperskich (allowlista) to późniejsza iteracja, poza zakresem.

### 3. Frontend — serwis `src/persistence/traffit-candidates.ts`

```
interface TraffitCandidate {
  employeeId: number;
  recruitmentId: number;
  recruitmentName: string;
  fullName: string;
  email: string | null;
}
fetchTraffitCandidates(): Promise<TraffitCandidate[]>
```

Wzór jak `traffit-api.ts`: bearer token z `getAccessToken()`, retry na 401 przez
`forceRefresh()`, baza z `VITE_API_BASE_URL`.

### 4. Formularz „Nowa rozmowa" (`src/ui/screen-start.ts`)

- Online (`repo instanceof AzureStore`): ładuj listę przez
  `fetchTraffitCandidates()`. Dropdown „Kandydat z Traffit (etap Spotkanie BK)":
  - wspólna lista wszystkich par (kandydat × rekrutacja),
  - **sortowanie po `employeeId`** rosnąco, żeby ten sam kandydat w dwóch
    rekrutacjach był obok siebie i rekruter wybrał właściwą pozycję,
  - etykieta wiersza: `Nazwisko Imię — [Nazwa rekrutacji]`,
  - **ukrywamy pary już dodane** do rosteru (klucz `traffitId+recruitmentId`),
    więc ta sama osoba w innej rekrutacji nadal się pokaże,
  - wybór uzupełnia `nameOrId` i zapisuje `traffitId`, `recruitmentId`,
    `recruitmentName`.
- Ikona / przełącznik „✎ wprowadź ręcznie" odsłania obecne pole free-text
  (bez ID) — zachowanie dotychczasowe.
- Offline lub błąd pobrania: cichy fallback do trybu ręcznego (sam free-text),
  z krótkim komunikatem o niedostępności listy.
- Stany: ładowanie, błąd, pusta lista.

### 5. Wysyłka do Traffit (`src/ui/recruiter-preview-dialog.ts`)

- Jeśli `candidate.traffitId` ustawione → wysyłka **bez pytania**.
- Jeśli brak (stare wpisy / wprowadzone ręcznie) → wspólny picker:
  - lista kandydatów z Traffit (jak w dropdownie nowej rozmowy),
  - **auto-dopasowanie** po nazwisku i imieniu (best match zaznaczony),
  - furtka: ręczne numeryczne ID,
  - po wyborze: zapis `traffitId` (+ `recruitmentId`, `recruitmentName`) na
    `Assessment` i `repo.save(...)`, potem push. Kolejne wysyłki już bez pytania.
- Marker notatki pozostaje per `assessmentId` (UUID) → ten sam employee w dwóch
  rekrutacjach = dwie osobne notatki. Do nagłówka notatki dodajemy
  `recruitmentName`, żeby były rozróżnialne w Traffit
  (`src/domain/recruiter-summary.ts`).

## Obsługa błędów

- Backend: `501` (nieskonfigurowany Traffit), `502` (sesja/login), inne →
  `errorResponse`. Logi po stronie serwera, bez wycieku sekretów.
- Frontend: błąd listy nie blokuje formularza (fallback ręczny). Błąd wysyłki
  pokazywany w `traffit-status` (jak teraz).
- Walidacja wejścia: `employeeId` numeryczny dodatni; dane z Traffit traktowane
  jako niezaufane (mapowanie pól defensywne).

## Testy

Backend (Vitest, wzór `api/tests/traffit-client.test.ts`):
- `listBkCandidates`: paginacja, filtr `state.id===15`, odsiew `color==='red'`,
  spłaszczenie z tagiem rekrutacji, retry 401.
- endpoint `traffit-candidates`: autoryzacja, `501` przy braku konfiguracji.

Frontend (Vitest + jsdom):
- `traffit-candidates` serwis: mapowanie, retry 401.
- `screen-start`: render dropdownu, sort po `employeeId`, ukrycie par już w
  rosterze, przełącznik trybu ręcznego, zapis trzech pól.
- `recruiter-preview-dialog`: bez pytania gdy `traffitId` jest; picker +
  auto-match gdy brak; ręczna furtka.
- model/migracja: opcjonalne pola `traffitId/recruitmentId/recruitmentName`.

Cel pokrycia domeny/logiki 80% (jak reszta etap II).

## Konfiguracja / deploy

- Bez nowych sekretów: reużywa `TRAFFIT_BASE_URL/USERNAME/PASSWORD`.
- Stałe `BK_STAGE_ID=15` i nazwa etapu zaszyte w kodzie (udokumentowane w
  `README-deploy.md`, z notką jak ponowić discovery, gdyby Traffit zmienił
  workflow).

## Poza zakresem (świadomie)

- Selektor rekrutacji w UI (rekrutacja wynika z wybranej pozycji listy).
- Allowlista rekrutacji (zawężenie do ról deweloperskich).
- Cache TTL listy kandydatów po stronie backendu (do dodania, gdyby liczba
  otwartych rekrutacji urosła).
- Tryb offline single-file: lista Traffit niedostępna z założenia (brak
  backendu) → tylko tryb ręczny.
