# Włącza Easy Auth (Microsoft Entra) na App Service `bakk-rekrutacja`.
# Zgodne ze standardem BAKK z artykułu Confluence pageId=159417649:
#  - Reuse Enterprise Application `BAKK Int Apps` (id 5d588d76-2173-49d8-ad6e-4c50b0ca6983)
#    bo użytkownicy to pracownicy BAKK (rekruterzy).
#  - DEDYKOWANY secret per App Service (zabronione współdzielenie).
#  - Rejestracja redirect URI w istniejącej Enterprise App.
#
# Wymagania:
#  - az CLI zalogowany na subskrypcję 28b7c9a4-317a-495c-99ed-6a6cec116a44.
#  - Konto musi mieć uprawnienia do aktualizacji `BAKK Int Apps` (standardowy
#    BAKK dev je ma — w odróżnieniu od `BAKK Ext Apps` która jest tighter).
#  - PowerShell 5.1+ lub pwsh 7+.
#
# Idempotentny: ponowne uruchomienie nie powiela redirect URI, dorzuca tylko
# nowy secret (append) — stare credentiale per `bakk-rekrutacja` można
# usunąć ręcznie po weryfikacji.

$ErrorActionPreference = 'Stop'

$rg          = 'rg-bakk-docs'
$dstApp      = 'bakk-rekrutacja'
$sub         = '28b7c9a4-317a-495c-99ed-6a6cec116a44'
$sharedAppId = '5d588d76-2173-49d8-ad6e-4c50b0ca6983'   # BAKK Int Apps (pracownicy BAKK)
$secretName  = 'MICROSOFT_PROVIDER_AUTHENTICATION_SECRET'
$secretDisplay = $dstApp
$redirectUri = "https://$dstApp.azurewebsites.net/.auth/login/aad/callback"

# Bypass uszkodzonego rozszerzenia authV2 jeśli istnieje
$env:AZURE_EXTENSION_DIR = Join-Path $env:TEMP 'azext-empty'
New-Item -ItemType Directory -Force -Path $env:AZURE_EXTENSION_DIR | Out-Null

az account set --subscription $sub | Out-Null

Write-Host "1/4 Dodaje redirect URI do BAKK Int Apps ($sharedAppId)..."
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

Write-Host "2/4 Generuje dedykowany client secret '$secretDisplay' (per standard BAKK: kazda App Service ma wlasny)..."
$secret = az ad app credential reset --id $sharedAppId --display-name $secretDisplay --years 2 --append --query password -o tsv 2>$null
if ($LASTEXITCODE -ne 0 -or -not $secret) { throw "Nie udalo sie wygenerowac sekretu." }
Write-Host "    Wygenerowany (dlugosc: $($secret.Length) znakow)"

Write-Host "3/4 Wpinam secret do app settings $dstApp jako $secretName..."
az webapp config appsettings set -g $rg -n $dstApp --settings "$secretName=$secret" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Nie udalo sie ustawic app setting." }

Write-Host "4/4 Konfiguruje authsettingsV2 i restartuje..."
$tenantId = az account show --query tenantId -o tsv

$auth = @{
    properties = @{
        globalValidation = @{
            requireAuthentication       = $true
            unauthenticatedClientAction = "RedirectToLoginPage"
            redirectToProvider          = "azureActiveDirectory"
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

$tmp = Join-Path $env:TEMP "authV2-$([Guid]::NewGuid()).json"
$auth | Out-File -Encoding utf8 -NoNewline $tmp

try {
    az rest --method put `
        --uri "https://management.azure.com/subscriptions/$sub/resourceGroups/$rg/providers/Microsoft.Web/sites/$dstApp/config/authsettingsV2?api-version=2022-03-01" `
        --body "@$tmp" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "authsettingsV2 PUT sie nie powiodl." }
} finally {
    Remove-Item -Force $tmp -ErrorAction SilentlyContinue
}

az webapp restart -g $rg -n $dstApp | Out-Null

Write-Host ""
Write-Host "Gotowe. Otworz https://$dstApp.azurewebsites.net/ z konta BAKK - powinno przekierowac na login Entra i wpuscic."
