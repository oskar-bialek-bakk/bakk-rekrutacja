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

**Do zrobienia po Twojej stronie (Easy Auth / SSO):**

Uruchom skrypt `etap2/scripts/enable-easy-auth.ps1` ze swojego konta.
Reuse istniejącej app registration **`BAKK Ext Apps`**
(`45198913-b9a9-4ef8-96a2-b6b19a4179d3`), tej samej której używa
`intrum-documentation` i `kz-test1` — bez nowego app reg, bez nowego
sekretu, bez Application Administrator. Wymaga jedynie żebyś był ownerem
`BAKK Ext Apps` (jesteś) i miał dostęp do obu App Services.

Claude tego skryptu nie odpalił bo:
- `az ad app update` na BAKK Ext Apps wymaga owner permission na app reg
  (mam tylko subskrypcję, nie owner na app);
- czytanie `MICROSOFT_PROVIDER_AUTHENTICATION_SECRET` z `intrum-documentation`
  (żeby skopiować ten sam secret do `bakk-rekrutacja`) zablokował auto-mode
  — słusznie, prod credential nie powinien trafić do transkryptu.

Wszystko co robi skrypt:

1. Dodaje `https://bakk-rekrutacja.azurewebsites.net/.auth/login/aad/callback`
   do redirect URIs `BAKK Ext Apps`.
2. Czyta `MICROSOFT_PROVIDER_AUTHENTICATION_SECRET` z `intrum-documentation`
   app settings i wpina ten sam value do `bakk-rekrutacja` app settings.
3. PUT-uje `authsettingsV2` na `bakk-rekrutacja` z `clientId =
   45198913-b9a9-4ef8-96a2-b6b19a4179d3`, `RedirectToLoginPage`,
   `tokenStore enabled`, 8h cookie — kopia 1:1 konfiguracji
   `intrum-documentation`.
4. Restart App Service.

```powershell
pwsh etap2/scripts/enable-easy-auth.ps1
```

Idempotentny — drugi run niczego nie psuje. Do czasu uruchomienia URL
`https://bakk-rekrutacja.azurewebsites.net/` jest publiczny — zalecam
zrobić to przed udostępnieniem URLa prowadzącym.

## Włączenie Easy Auth — opcja awaryjna: portal Azure

Jeśli skrypt z jakiegoś powodu padnie:

Portal Azure → `bakk-rekrutacja` → Authentication → Add identity provider:

- Identity provider: **Microsoft**
- Tenant type: **Workforce**
- App registration: **Pick an existing app registration in this directory**
  → wpisz `BAKK Ext Apps` (45198913-b9a9-4ef8-96a2-b6b19a4179d3).
- Client secret: ten sam co używa `intrum-documentation`
  (`MICROSOFT_PROVIDER_AUTHENTICATION_SECRET` app setting — portal sam
  podłączy, jeśli wybierzesz „use existing").
- Restrict access: **Require authentication**
- Unauthenticated requests: **HTTP 302 Found redirect**

Po dodaniu wejdź jeszcze do `BAKK Ext Apps` → Authentication → Redirect URIs
i dodaj `https://bakk-rekrutacja.azurewebsites.net/.auth/login/aad/callback`.

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

Dla większej bezpieczeństwa warto włączyć deployment slots (jeśli plan
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
