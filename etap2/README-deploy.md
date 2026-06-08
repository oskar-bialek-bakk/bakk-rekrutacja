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
