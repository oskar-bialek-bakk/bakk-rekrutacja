# etap2 — deployment na Azure App Service

Aplikacja oceny II etapu hostowana na dedykowanym Azure App Service
`bakk-rekrutacja` (RG `rg-bakk-docs`, subskrypcja
`28b7c9a4-317a-495c-99ed-6a6cec116a44`, plan `asp-bakk-docs` F1 Free dzielony
z `intrum-documentation`). Wzorzec lustrzany do `intrum-documentation` (zob.
repo Intrum). SSO przez Microsoft Entra („Easy Auth" App Service) z tego
samego tenanta co `intrum-documentation`.

URL: `https://bakk-rekrutacja.azurewebsites.net/`.

Workflow:
- reusable `.github/workflows/deploy-vite-to-azure.yml` (build Vite + deploy
  do App Service)
- caller `.github/workflows/deploy-bakk-rekrutacja-etap2.yml` (push na main
  z paths `etap2/**` lub `workflow_dispatch`)
- PR guard `.github/workflows/etap2-ci.yml` (testy + build na PR, bez deployu)

Persystencja zostaje w `localStorage` przeglądarki (Faza 4). Multi-user,
Functions/Cosmos i auto-push Traffit są w Fazie 5.

## Faza 5 — backend (✅ ZAKOŃCZONA 2026-06-09)

Backend API w osobnym **Function App `bakk-rekrutacja-api`** (Linux,
Consumption plan, Node 24, Functions v4), region **germanywestcentral**
(Linux Consumption nie wspierany w `polandcentral` gdzie jest Cosmos).
Cosmos DB serverless `bakk-rekrutacja-db` w `polandcentral` (PL data
residency), kontenery `assessments` / `variantUsage` / `settings`.

Easy Auth (Microsoft Entra) z tym samym app reg co App Service — **BAKK
Int Apps** (`5d588d76-2173-49d8-ad6e-4c50b0ca6983`), dedykowany secret per
zasób (per standard Confluence pageId=159417649). `unauthenticatedAction =
Return401` (API, nie redirect na login). CORS dopuszcza tylko
`https://bakk-rekrutacja.azurewebsites.net`, `supportCredentials=false`
(Bearer token, nie cookie).

Frontend (App Service) pobiera access token z `/.auth/me` (audience =
BAKK Int Apps clientId) i wysyła do Function App jako `Authorization:
Bearer <token>`. Function App z Easy Auth na tym samym clientId
akceptuje token i wstawia `X-MS-CLIENT-PRINCIPAL-*` po walidacji.

Sekrety Cosmos i Traffit w app settings Function App (NIE App Service).
URL: `https://bakk-rekrutacja-api.azurewebsites.net/api/v1/*`.

Koszt szacunkowy Fazy 5:
- Cosmos serverless: pay-per-RU, < 10 PLN/mc dla typowego ruchu rekrutacji
- Function App Consumption: ~5-15 PLN/mc
- Storage account dla Function App: ~1-2 PLN/mc
- App Service plan `asp-bakk-docs` **zostaje F1 Free** (bez upgrade'u)

Skrypty provisioningowe:
- `etap2/scripts/provision-cosmos.ps1` — Cosmos DB + 3 kontenery
- `etap2/scripts/provision-function-app.ps1` — storage + Function App +
  wpięcie app settings Cosmos (z `%TEMP%/bakk-cosmos-secrets.txt`)
- `etap2/scripts/configure-function-app-auth.ps1` — redirect URI w BAKK
  Int Apps, dedykowany secret, `authsettingsV2`, CORS
- `etap2/scripts/set-traffit-secrets.ps1` — TRAFFIT_BASE_URL +
  TRAFFIT_SESSION_COOKIE w app settings Function App

### Auto-push do Traffit

Backend ma endpoint `POST /api/v1/traffit/push` który forwarduje notatkę
podsumowania do Traffit jako notatka na profilu kandydata.

**Ograniczenie:** Linux Consumption Function App nie wspiera bibliotek
binarnych typu Chromium, więc nie ma auto-login do Traffit (jak w lokalnym
`traffit-scorer/src/push-notes.js`). Zamiast tego użytkownik wkleja aktywne
cookie sesji Traffit do app settings raz na ~30 dni:

1. Zaloguj się do Traffit w przeglądarce
2. DevTools → Network → dowolny request do `/api/v2/*` → Headers → `Cookie`
3. Skopiuj pełną wartość headera
4. `./etap2/scripts/set-traffit-secrets.ps1 -BaseUrl 'https://intrum.traffit.com' -Cookie '<wklejone>'`

UI: w „Podgląd dla rekrutera" → przycisk „Wyślij do Traffit" pyta o ID
kandydata (z URL profilu), wywołuje backend. Marker idempotencji
`<!-- bakk-etap2:{assessmentId} -->` w treści notatki pozwala detekcję
istniejącej notatki dla tej rozmowy → wtedy update zamiast create.

### Monitoring

Application Insights wpięte przez Function App automatycznie (Functions v4
domyślnie). Logi w Azure Portal → Function App → Application Insights →
Live Metrics, Failures, Performance.

### RODO

Decyzja: brak automatycznego soft-delete. Dane utrzymują się bez retencji.
Reakcja na żądanie usunięcia danych = ręczne `DELETE /api/v1/assessments/{id}`
przez UI (po dodaniu UI usuwania) lub bezpośrednio przez `az cosmosdb sql
container delete-item` na pojedynczych dokumentach. Dla pełnego usunięcia
konta rekrutera można wyczyścić całą partycję `userPrincipalName`.

### Rotacja sekretów

- **`MICROSOFT_PROVIDER_AUTHENTICATION_SECRET`** dla Function App — ten sam
  proces co dla App Service. `az ad app credential reset --id 5d588d76-...
  --display-name bakk-rekrutacja-api --years 2 --append` daje nowy secret,
  wpiąć przez `az functionapp config appsettings set`. Stare credentials
  per `bakk-rekrutacja-api` można usunąć ręcznie po weryfikacji.
- **`COSMOS_KEY`** — `az cosmosdb keys regenerate --key-kind primary`
  rotuje, potem `az cosmosdb keys list` + `az functionapp config
  appsettings set COSMOS_KEY=...`.
- **`TRAFFIT_SESSION_COOKIE`** — ~co miesiąc, ze skryptem
  `set-traffit-secrets.ps1`.

## Stan setupu (2026-06-08)

**Zrobione przez Claude:**
- ✅ App Service `bakk-rekrutacja` utworzony na planie `asp-bakk-docs`
  (Windows F1 Free, ten sam plan co `intrum-documentation` — zero
  dodatkowego kosztu).
- ✅ HTTPS only włączone (default w nowych App Service).
- ✅ Basic publishing credentials (SCM + FTP) włączone — wymagane przez
  `azure/webapps-deploy@v3`.
- ✅ Publish profile pobrany i wpięty do GitHub jako secret
  `AZURE_PUBLISH_PROFILE_BAKK_REKRUTACJA`.
- ✅ Pierwszy deploy z `main` przeszedł zielony, smoke test `curl` zwraca
  HTTP 200 + tytuł „Ocena rozmowy — II etap · BAKK" (single-file 99 kB).

- ✅ Easy Auth (Microsoft Entra) włączony — reuse Enterprise Application
  **BAKK Int Apps** (`5d588d76-2173-49d8-ad6e-4c50b0ca6983`, single-tenant,
  tylko pracownicy BAKK) zgodnie ze standardem z Confluence pageId=159417649.
  Redirect URI dodany do BAKK Int Apps, dedykowany secret (per standard
  „każda App Service ma własny secret") wygenerowany i wpięty do
  `MICROSOFT_PROVIDER_AUTHENTICATION_SECRET`, `authsettingsV2`
  skonfigurowane (`RedirectToLoginPage`, tokenStore on, cookie 8h),
  App Service zrestartowany.
- ✅ Smoke test: `curl -A Mozilla https://bakk-rekrutacja.azurewebsites.net/`
  zwraca HTTP 302 → `login.microsoftonline.com/c21db186-.../oauth2/v2.0/authorize`
  z `client_id=5d588d76-...`.

**Tym samym Faza 4 jest zamknięta — nie ma już zadań user-side dla samego
hostingu. Otwórz URL z konta BAKK i zweryfikuj pełen przepływ.**

## Reprodukcja od zera (gdyby trzeba)

W razie odtworzenia tej konfiguracji (np. nowy podobny App Service):

1. Utworzenie App Service na planie `asp-bakk-docs`:
   ```bash
   az webapp create -g rg-bakk-docs -p asp-bakk-docs -n <NAZWA>
   ```
2. Włączenie basic publishing creds (inaczej `azure/webapps-deploy@v3` padnie):
   ```bash
   az resource update -g rg-bakk-docs --name scm --namespace Microsoft.Web \
     --resource-type basicPublishingCredentialsPolicies \
     --parent sites/<NAZWA> --set properties.allow=true
   az resource update -g rg-bakk-docs --name ftp --namespace Microsoft.Web \
     --resource-type basicPublishingCredentialsPolicies \
     --parent sites/<NAZWA> --set properties.allow=true
   ```
3. Publish profile → GitHub secret:
   ```bash
   az webapp deployment list-publishing-profiles -g rg-bakk-docs -n <NAZWA> --xml \
     | gh secret set AZURE_PUBLISH_PROFILE_<NAZWA_UPPER> --repo <ORG>/<REPO>
   ```
4. Easy Auth: `etap2/scripts/enable-easy-auth.ps1` (zmień `$dstApp` i URI).
   Aplikacja używa **BAKK Int Apps** (pracownicy BAKK) zgodnie z artykułem
   Confluence pageId=159417649. Dla aplikacji dla użytkowników zewnętrznych
   trzeba podstawić `BAKK Ext Apps` (`45198913-...`) i dodatkowo ustawić
   `WEBSITE_AUTH_AAD_ALLOWED_TENANTS` per artykuł.

## Deployment (automatyczny)

- Push na `main` z dotknięciem `etap2/**` → workflow
  `deploy-bakk-rekrutacja-etap2` uruchamia reusable, buduje `etap2/dist/`,
  pakuje do zipa i wrzuca na App Service (`clean: false`).
- Ręczny deploy: GitHub → Actions → workflow „Deploy etap2 → bakk-rekrutacja
  (root)" → Run workflow → branch `main`.

PR na `etap2/**` uruchamia `etap2-ci`: `npm ci`, `npm test`, `npm run build`.
Zielony build jest warunkiem mergea (do skonfigurowania w Settings →
Branches → Branch protection rules → `main` → Require status checks:
`test-and-build`).

## Rollback

W razie problemu po deployu:

- App Service → Deployment Center → Logs → ostatnie wdrożenie → **Redeploy**
  poprzedniej paczki, **lub**
- W GitHub → Actions → wybierz wcześniejszy zielony run workflow
  `deploy-bakk-rekrutacja-etap2` → „Re-run all jobs".

Dla większego bezpieczeństwa warto włączyć deployment slots (jeśli plan
pricing pozwala — F1 ich nie ma, wymaga B1+): staging slot + swap. Do
rozważenia po stabilizacji.

## Skąd się wzięły basic credentials

Nowe App Service w naszej subskrypcji mają domyślnie **wyłączone** basic
auth (SCM + FTP). `azure/webapps-deploy@v3` korzysta z publish profile,
który bez basic auth nie zawiera credentiali → deploy pada „Publish profile
is invalid". Setup włączający:

```bash
az resource update -g rg-bakk-docs --name scm --namespace Microsoft.Web \
  --resource-type basicPublishingCredentialsPolicies \
  --parent sites/bakk-rekrutacja --set properties.allow=true
az resource update -g rg-bakk-docs --name ftp --namespace Microsoft.Web \
  --resource-type basicPublishingCredentialsPolicies \
  --parent sites/bakk-rekrutacja --set properties.allow=true
```

Alternatywa „enterprise-grade": OIDC z federated identity zamiast publish
profile. Do rozważenia w Fazie 5.
