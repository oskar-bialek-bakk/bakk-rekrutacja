# etap2 — deployment na Azure App Service

Aplikacja oceny II etapu hostowana na dedykowanym Azure App Service
`bakk-rekrutacja` (RG `rg-bakk-docs`, subskrypcja
`28b7c9a4-317a-495c-99ed-6a6cec116a44`). Wzorzec lustrzany do
`intrum-documentation` (zob. repo Intrum). SSO przez Microsoft Entra („Easy
Auth" App Service) z tego samego tenanta co `intrum-documentation`.

Workflow:
- reusable `.github/workflows/deploy-vite-to-azure.yml` (build Vite + deploy
  do App Service)
- caller `.github/workflows/deploy-bakk-rekrutacja-etap2.yml` (push na main
  z paths `etap2/**` lub `workflow_dispatch`)
- PR guard `.github/workflows/etap2-ci.yml` (testy + build na PR, bez deployu)

Persystencja zostaje w `localStorage` przeglądarki (Faza 4). Multi-user,
Functions/Cosmos i auto-push Traffit są w Fazie 5.

## Setup jednorazowy (Azure portal)

Wymagane uprawnienia: Owner / Contributor na subskrypcji
`28b7c9a4-317a-495c-99ed-6a6cec116a44` oraz prawa do tenant Entra (lub osoba,
która skonfigurowała Easy Auth dla `intrum-documentation` — odtwarzamy
identyczną konfigurację).

### 1. Utwórz App Service `bakk-rekrutacja`

Portal Azure → Create resource → Web App:

- Subscription: `28b7c9a4-317a-495c-99ed-6a6cec116a44`
- Resource group: `rg-bakk-docs`
- Name: `bakk-rekrutacja`
- Publish: **Code**
- Runtime stack: **Node 20 LTS**
- Operating System: **Linux**
- Region: ten sam co `intrum-documentation`
- Pricing plan: ten sam plan co `intrum-documentation` (jeżeli ma wolne sloty,
  można dosiąść; w razie potrzeby B1/F1)

Po utworzeniu URL aplikacji: `https://bakk-rekrutacja.azurewebsites.net/`.

### 2. Pobierz publish profile

App Service `bakk-rekrutacja` → Overview → **Get publish profile** (pobierze
plik `.PublishSettings` XML).

### 3. Dodaj GitHub secret

Repo `oskar-bialek-bakk/bakk-rekrutacja` → Settings → Secrets and variables
→ Actions → New repository secret:

- Name: `AZURE_PUBLISH_PROFILE_BAKK_REKRUTACJA`
- Value: pełna treść XML z `.PublishSettings`

### 4. Włącz Easy Auth (Microsoft Entra)

Lustro konfiguracji `intrum-documentation`.

App Service `bakk-rekrutacja` → Authentication → Add identity provider:

- Identity provider: **Microsoft**
- Tenant type: **Workforce**
- App registration: **Create new app registration** (nazwa
  `bakk-rekrutacja-auth`) albo **Pick an existing app registration** jeżeli
  centralnie zarządzana
- Supported account types: ten sam wybór co w `intrum-documentation`
  (zazwyczaj „Current tenant only")
- Restrict access: **Require authentication**
- Unauthenticated requests: **HTTP 302 Found redirect: recommended for
  websites**
- Token store: enabled

Po dodaniu providera:

- W App registration (Entra ID → App registrations →
  `bakk-rekrutacja-auth` → Authentication) sprawdź redirect URI
  `https://bakk-rekrutacja.azurewebsites.net/.auth/login/aad/callback`.
- W „Authentication" App Service → Identity provider → Edit → przejdź do
  zakładki „Permissions" i nadaj te same scopes co
  `intrum-documentation` (`openid profile email User.Read`).

### 5. Nadanie dostępu prowadzącym rozmowy

Wariant prostszy (jak w `intrum-documentation`, jeśli tam tak jest):
wszyscy użytkownicy tenanta BAKK mają dostęp przy zalogowaniu — Easy Auth
sprawdza tylko ważny token Entra, bez dodatkowej autoryzacji per grupa.

Wariant z grupą AAD (jeśli `intrum-documentation` używa grupy):
- Entra ID → Groups → utwórz grupę `bakk-rekrutacja-users` (lub reuse grupy
  używanej w `intrum-documentation`).
- App registration `bakk-rekrutacja-auth` → Enterprise applications →
  `bakk-rekrutacja-auth` → Properties → **Assignment required: Yes**.
- Users and groups → Add user/group → wybierz grupę.

Decyzję który wariant odtworzyć podejmij po sprawdzeniu, jak skonfigurowane
jest `intrum-documentation` w portalu.

## Deployment

Po jednorazowym setupie deploy jest automatyczny:

- Push na `main` z dotknięciem `etap2/**` → workflow
  `deploy-bakk-rekrutacja-etap2` uruchamia reusable, buduje `etap2/dist/`,
  pakuje do zipa i wrzuca na App Service (`clean: false`, więc późniejsze
  siostrzane subpathy się nie nadpisują).
- Ręczny deploy: GitHub → Actions → workflow „Deploy etap2 → bakk-rekrutacja
  (root)" → Run workflow → branch `main`.

PR na `etap2/**` uruchamia `etap2-ci`: `npm ci`, `npm test`, `npm run build`.
Zielony build jest warunkiem mergea (skonfiguruj w Settings → Branches →
Branch protection rules → `main` → Require status checks: `test-and-build`).

## Smoke test po pierwszym deployu

1. Po zakończonym workflow otwórz `https://bakk-rekrutacja.azurewebsites.net/`.
2. Zaloguj się przez Entra (powinno zażądać tokena BAKK).
3. Po zalogowaniu otwiera się ekran startowy etap2 (formularz kandydata,
   wybór wariantów, toggle bloku E).
4. Wypełnij dane testowe → „Rozpocznij rozmowę" → przejdź blok A → zapisz
   ocenę → „Podsumowanie" → „Zestawienie kandydatów" (rekord widoczny na
   liście).
5. Odśwież stronę → kandydat dalej na liście (localStorage trzyma dane).
6. Otwórz devtools → Application → Local Storage →
   `https://bakk-rekrutacja.azurewebsites.net` → klucze
   `etap2.assessments`, `etap2.variantUsage`, `etap2.settings` istnieją.

Jeżeli aplikacja nie ładuje assetów (białe okno + 404 w sieci):

- Sprawdź w `vite.config.ts` wartość `base`. Single-file build (`base: './'`)
  powinien działać pod rootem.
- Jeżeli chcesz w przyszłości subpath (np. `/etap2/`), uruchom caller
  workflow z inputem `site-base: '/etap2/'`; reusable workflow nadpisze
  `base` w `vite.config.ts` sed-em przed buildem.

## Rollback

W razie problemu po deployu:

- App Service → Deployment Center → Logs → ostatnie wdrożenie → **Redeploy**
  poprzedniej paczki, **lub**
- W GitHub → Actions → wybierz wcześniejszy zielony run workflow
  `deploy-bakk-rekrutacja-etap2` → „Re-run all jobs".

Dla większej bezpieczeństwa warto włączyć deployment slots (jeśli plan
pricing pozwala): staging slot + swap. Do rozważenia po stabilizacji.
