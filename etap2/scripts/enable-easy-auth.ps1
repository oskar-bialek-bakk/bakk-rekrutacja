# Włącza Easy Auth (Microsoft Entra) na App Service `bakk-rekrutacja`.
# Lustro konfiguracji `intrum-documentation`.
#
# Wymagania:
#  - az CLI zalogowany na subskrypcję 28b7c9a4-317a-495c-99ed-6a6cec116a44.
#  - Rola **Application Administrator** (lub Application Developer) na
#    tenant `bakk.com` — `az ad app create` jej wymaga.
#  - gh CLI nie jest potrzebny (sekrety App Service trzymane jako app
#    settings, nie GitHub).
#
# Idempotentny: ponowne uruchomienie zresetuje client secret i przepisze
# konfigurację authsettingsV2. Stara aplikacja Entra pozostaje (nowy
# secret jest aktywny, stary unieważniony).

$ErrorActionPreference = 'Stop'

$rg = 'rg-bakk-docs'
$app = 'bakk-rekrutacja'
$sub = '28b7c9a4-317a-495c-99ed-6a6cec116a44'

# Bypass uszkodzonego rozszerzenia authV2 jeśli istnieje
$env:AZURE_EXTENSION_DIR = Join-Path $env:TEMP 'azext-empty'
New-Item -ItemType Directory -Force -Path $env:AZURE_EXTENSION_DIR | Out-Null

Write-Host "1/5 Sprawdzam App Registration $app..."
$appId = az ad app list --display-name $app --query "[0].appId" -o tsv
if (-not $appId) {
    Write-Host "    Tworzę nową app registration..."
    $appId = az ad app create `
        --display-name $app `
        --sign-in-audience AzureADMyOrg `
        --web-redirect-uris "https://$app.azurewebsites.net/.auth/login/aad/callback" `
        --query appId -o tsv
} else {
    Write-Host "    Istnieje: $appId — aktualizuję redirect URI..."
    az ad app update --id $appId `
        --web-redirect-uris "https://$app.azurewebsites.net/.auth/login/aad/callback" | Out-Null
}
Write-Host "    appId = $appId"

Write-Host "2/5 Generuję nowy client secret (2 lata)..."
$secret = az ad app credential reset --id $appId --display-name "easy-auth" --years 2 --query password -o tsv

Write-Host "3/5 Wpinam secret jako MICROSOFT_PROVIDER_AUTHENTICATION_SECRET..."
az webapp config appsettings set -g $rg -n $app `
    --settings "MICROSOFT_PROVIDER_AUTHENTICATION_SECRET=$secret" | Out-Null

Write-Host "4/5 Konfiguruję authsettingsV2..."
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
                    clientId                = $appId
                    clientSecretSettingName = "MICROSOFT_PROVIDER_AUTHENTICATION_SECRET"
                    openIdIssuer            = "https://login.microsoftonline.com/$tenantId/v2.0"
                }
            }
        }
        login = @{
            cookieExpiration = @{
                convention         = "FixedTime"
                timeToExpiration   = "08:00:00"
            }
            tokenStore       = @{ enabled = $true }
        }
    }
} | ConvertTo-Json -Depth 10

$tmp = Join-Path $env:TEMP "authV2-$([Guid]::NewGuid()).json"
$auth | Out-File -Encoding utf8 -NoNewline $tmp

try {
    az rest --method put `
        --uri "https://management.azure.com/subscriptions/$sub/resourceGroups/$rg/providers/Microsoft.Web/sites/$app/config/authsettingsV2?api-version=2022-03-01" `
        --body "@$tmp" | Out-Null
} finally {
    Remove-Item -Force $tmp -ErrorAction SilentlyContinue
}

Write-Host "5/5 Restartuję App Service..."
az webapp restart -g $rg -n $app | Out-Null

Write-Host ""
Write-Host "Gotowe. Otwórz https://$app.azurewebsites.net/ — powinien przekierować na login Entra."
Write-Host "Klient: $appId"
