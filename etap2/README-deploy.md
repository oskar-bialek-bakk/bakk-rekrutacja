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

Claude nie ma w tenancie Entra roli pozwalającej na `az ad app create`
(błąd: „Insufficient privileges"). App Registration musisz założyć
samodzielnie albo przyznać sobie rolę **Application Administrator** /
**Application Developer** na tenant `bakk.com` i uruchomić skrypt
`scripts/enable-easy-auth.ps1` (poniżej).

Do czasu włączenia Easy Auth URL jest publiczny. Treść to nasza wewnętrzna
aplikacja oceny, więc zalecam zrobić to przed udostępnieniem URLa
prowadzącym.

## Włączenie Easy Auth — opcja A: skrypt (po nadaniu sobie roli)

Wariant najlżejszy: zaloguj się jako Application Administrator w tenant
`bakk.com`, potem:

```powershell
$env:AZURE_EXTENSION_DIR = "C:\temp\azext-empty"
mkdir -Force $env:AZURE_EXTENSION_DIR | Out-Null

# 1. App Registration (osobna pod bakk-rekrutacja)
$appId = az ad app create `
  --display-name "bakk-rekrutacja" `
  --sign-in-audience AzureADMyOrg `
  --web-redirect-uris "https://bakk-rekrutacja.azurewebsites.net/.auth/login/aad/callback" `
  --query appId -o tsv

# 2. Client secret (ważny 2 lata)
$secret = az ad app credential reset --id $appId --display-name "easy-auth" --years 2 --query password -o tsv

# 3. Wrzuć secret jako app setting App Service'a (Easy Auth go odczyta)
az webapp config appsettings set -g rg-bakk-docs -n bakk-rekrutacja `
  --settings MICROSOFT_PROVIDER_AUTHENTICATION_SECRET=$secret | Out-Null

# 4. Konfiguracja authsettingsV2 (mirror intrum-documentation: AAD + RedirectToLoginPage)
$tenantId = az account show --query tenantId -o tsv
$auth = @{
  properties = @{
    globalValidation = @{
      requireAuthentication = $true
      unauthenticatedClientAction = "RedirectToLoginPage"
      redirectToProvider = "azureActiveDirectory"
    }
    httpSettings = @{ requireHttps = $true; routes = @{ apiPrefix = "/.auth" } }
    identityProviders = @{
      azureActiveDirectory = @{
        enabled = $true
        registration = @{
          clientId = $appId
          clientSecretSettingName = "MICROSOFT_PROVIDER_AUTHENTICATION_SECRET"
          openIdIssuer = "https://login.microsoftonline.com/$tenantId/v2.0"
        }
      }
    }
    login = @{
      cookieExpiration = @{ convention = "FixedTime"; timeToExpiration = "08:00:00" }
      tokenStore = @{ enabled = $true }
    }
  }
} | ConvertTo-Json -Depth 10

$auth | Out-File -Encoding utf8 -NoNewline $env:TEMP\authV2.json

az rest --method put `
  --uri "https://management.azure.com/subscriptions/28b7c9a4-317a-495c-99ed-6a6cec116a44/resourceGroups/rg-bakk-docs/providers/Microsoft.Web/sites/bakk-rekrutacja/config/authsettingsV2?api-version=2022-03-01" `
  --body "@$env:TEMP\authV2.json"

Remove-Item $env:TEMP\authV2.json
```

Po wykonaniu otwórz `https://bakk-rekrutacja.azurewebsites.net/` — powinno
przekierować na login BAKK Entra; po zalogowaniu odpowiednia aplikacja
etap2.

## Włączenie Easy Auth — opcja B: portal Azure

Portal Azure → `bakk-rekrutacja` → Authentication → Add identity provider:

- Identity provider: **Microsoft**
- Tenant type: **Workforce**
- App registration: **Create new app registration** (nazwa
  `bakk-rekrutacja`)
- Supported account types: **Current tenant — Single tenant**
- Restrict access: **Require authentication**
- Unauthenticated requests: **HTTP 302 Found redirect**

Po dodaniu providera redirect URI zostanie zarejestrowany automatycznie.

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
