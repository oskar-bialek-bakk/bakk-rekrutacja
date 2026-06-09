# Konfiguracja Easy Auth (Microsoft Entra) + CORS na Function App `bakk-rekrutacja-api`.
#
# Zgodnie z planem Fazy 5:
#  - Reuse Enterprise Application `BAKK Int Apps` (5d588d76-2173-49d8-ad6e-4c50b0ca6983).
#  - DEDYKOWANY secret per zasob (osobny od secretu App Service `bakk-rekrutacja`).
#  - unauthenticatedClientAction = `Return401` (API, nie redirect na login).
#  - CORS: allowedOrigins = ['https://bakk-rekrutacja.azurewebsites.net'], bez credentials
#    (Bearer w Authorization, nie cookie).
#
# Architektura cross-origin: front (App Service `bakk-rekrutacja`) pobiera access token
# z `/.auth/me` (audience = BAKK Int Apps clientId) i wysyla do Function App jako
# Authorization: Bearer. Function App z Easy Auth na tym samym clientId akceptuje token.
#
# Wymagania:
#  - az CLI zalogowany na sub 28b7c9a4-...
#  - Konto z uprawnieniami do edycji `BAKK Int Apps` (standardowy BAKK dev).
#  - Function App `bakk-rekrutacja-api` istnieje (uruchom najpierw provision-function-app.ps1).
#
# Idempotencja (czesciowa):
#  - Redirect URI: idempotentne.
#  - Secret: KAZDE uruchomienie dorzuca nowy credential (--append) i nadpisuje
#    `MICROSOFT_PROVIDER_AUTHENTICATION_SECRET` w app settings. Stare credentiale
#    per `bakk-rekrutacja-api` zostaja na app reg - usun recznie po weryfikacji.
#  - authsettingsV2 PUT, CORS replace: idempotentne.

$ErrorActionPreference = 'Stop'

$tempDir = [System.IO.Path]::GetTempPath()

$rg            = 'rg-bakk-docs'
$dstApp        = 'bakk-rekrutacja-api'
$sub           = '28b7c9a4-317a-495c-99ed-6a6cec116a44'
$sharedAppId   = '5d588d76-2173-49d8-ad6e-4c50b0ca6983'   # BAKK Int Apps
$secretName    = 'MICROSOFT_PROVIDER_AUTHENTICATION_SECRET'
$secretDisplay = $dstApp
$redirectUri   = "https://$dstApp.azurewebsites.net/.auth/login/aad/callback"
$frontOrigin   = 'https://bakk-rekrutacja.azurewebsites.net'

# Bypass uszkodzonego rozszerzenia authV2 jesli istnieje
$env:AZURE_EXTENSION_DIR = Join-Path $tempDir 'azext-empty'
New-Item -ItemType Directory -Force -Path $env:AZURE_EXTENSION_DIR | Out-Null

az account set --subscription $sub | Out-Null

Write-Host "1/5 Dodaje redirect URI do BAKK Int Apps ($sharedAppId)..."
$existing = az ad app show --id $sharedAppId --query "web.redirectUris" -o json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Nie udalo sie odczytac BAKK Int Apps. Sprawdz uprawnienia." }
if ($existing -contains $redirectUri) {
    Write-Host "    Juz jest: $redirectUri"
} else {
    $merged = @($existing) + @($redirectUri)
    az ad app update --id $sharedAppId --web-redirect-uris @merged | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "az ad app update sie nie powiodlo. Brak uprawnien do BAKK Int Apps?" }
    Write-Host "    Dodane: $redirectUri"
}

Write-Host "2/5 Generuje dedykowany client secret '$secretDisplay' (standard BAKK: per zasob)..."
$secret = az ad app credential reset --id $sharedAppId --display-name $secretDisplay --years 2 --append --query password -o tsv
if ($LASTEXITCODE -ne 0 -or -not $secret) { throw "Nie udalo sie wygenerowac sekretu." }
Write-Host "    Wygenerowany (dlugosc: $($secret.Length) znakow)"

Write-Host "3/5 Wpinam secret do app settings $dstApp jako $secretName..."
az functionapp config appsettings set -g $rg -n $dstApp --settings "$secretName=$secret" --only-show-errors | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Nie udalo sie ustawic app setting." }

Write-Host "4/5 Konfiguruje authsettingsV2 (Return401 dla API)..."
$tenantId = az account show --query tenantId -o tsv
if ($LASTEXITCODE -ne 0 -or -not $tenantId) { throw "az account show nie zwrocil tenantId." }

$auth = @{
    properties = @{
        globalValidation = @{
            requireAuthentication       = $true
            unauthenticatedClientAction = "Return401"
        }
        httpSettings = @{
            requireHttps = $true
            routes       = @{ apiPrefix = "/.auth" }
        }
        identityProviders = @{
            azureActiveDirectory = @{
                enabled      = $true
                registration = @{
                    clientId                = $sharedAppId
                    clientSecretSettingName = $secretName
                    openIdIssuer            = "https://login.microsoftonline.com/$tenantId/v2.0"
                }
                validation = @{
                    allowedAudiences = @(
                        "api://$sharedAppId",
                        $sharedAppId
                    )
                }
            }
        }
        login = @{
            cookieExpiration = @{
                convention       = "FixedTime"
                timeToExpiration = "08:00:00"
            }
            tokenStore       = @{ enabled = $true }
        }
    }
} | ConvertTo-Json -Depth 10

$tmp = Join-Path $tempDir "authV2-funcapp-$([Guid]::NewGuid()).json"
$auth | Out-File -Encoding utf8 -NoNewline $tmp

try {
    az rest --method put `
        --uri "https://management.azure.com/subscriptions/$sub/resourceGroups/$rg/providers/Microsoft.Web/sites/$dstApp/config/authsettingsV2?api-version=2022-03-01" `
        --body "@$tmp" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "authsettingsV2 PUT sie nie powiodl." }
} finally {
    Remove-Item -Force $tmp -ErrorAction SilentlyContinue
}

Write-Host "5/5 Konfiguruje CORS (allowedOrigins=[$frontOrigin])..."
# Czysc istniejace origins i ustaw jeden
$currentOrigins = @(az functionapp cors show -g $rg -n $dstApp --query "allowedOrigins[]" -o tsv)
foreach ($o in $currentOrigins) {
    if ($o -and $o -ne $frontOrigin) {
        az functionapp cors remove -g $rg -n $dstApp --allowed-origins $o --only-show-errors | Out-Null
    }
}
if (-not ($currentOrigins -contains $frontOrigin)) {
    az functionapp cors add -g $rg -n $dstApp --allowed-origins $frontOrigin --only-show-errors | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "az functionapp cors add sie nie powiodl." }
}
# supportCredentials = false (Bearer, nie cookie) - to default ale jawnie ustawiamy
az resource update -g $rg -n "$dstApp/web" --resource-type "Microsoft.Web/sites/config" `
    --set properties.cors.supportCredentials=false --only-show-errors | Out-Null

az functionapp restart -g $rg -n $dstApp | Out-Null

Write-Host ""
Write-Host "Gotowe. Easy Auth + CORS skonfigurowane."
Write-Host "Smoke test (z innego okna - moze trwac 30s zanim restart zakonczy):"
Write-Host "  curl -i https://$dstApp.azurewebsites.net/api/health"
Write-Host "  -> oczekiwany 401 (Easy Auth Return401 bo brak tokenu)"
Write-Host "  -> po Task 3 (health endpoint) i z tokenem z /.auth/me App Service -> 200"
