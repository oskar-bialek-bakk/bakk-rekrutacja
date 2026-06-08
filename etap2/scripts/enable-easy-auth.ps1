# Włącza Easy Auth (Microsoft Entra) na App Service `bakk-rekrutacja`.
# Reuse istniejącego app registration `BAKK Ext Apps`
# (appId 45198913-b9a9-4ef8-96a2-b6b19a4179d3) — dokładnie tak samo jak
# `intrum-documentation` i `kz-test1`. Konfiguracja authsettingsV2 lustro
# `intrum-documentation`.
#
# Wymagania:
#  - az CLI zalogowany na subskrypcję 28b7c9a4-317a-495c-99ed-6a6cec116a44
#    Twoim kontem (musi mieć dostęp do `BAKK Ext Apps` jako owner oraz do
#    obu App Services w `rg-bakk-docs`).
#  - PowerShell 5.1+ lub pwsh 7+.
#
# Idempotentny: ponowne uruchomienie nie powiela redirect URI ani app
# settingu. Nie generuje nowych sekretów — kopiuje istniejący z
# `intrum-documentation`.

$ErrorActionPreference = 'Stop'

$rg          = 'rg-bakk-docs'
$srcApp      = 'intrum-documentation'   # źródło sekretu Easy Auth
$dstApp      = 'bakk-rekrutacja'
$sub         = '28b7c9a4-317a-495c-99ed-6a6cec116a44'
$sharedAppId = '45198913-b9a9-4ef8-96a2-b6b19a4179d3'   # BAKK Ext Apps
$secretName  = 'MICROSOFT_PROVIDER_AUTHENTICATION_SECRET'
$redirectUri = "https://$dstApp.azurewebsites.net/.auth/login/aad/callback"

# Bypass uszkodzonego rozszerzenia authV2 jeśli istnieje
$env:AZURE_EXTENSION_DIR = Join-Path $env:TEMP 'azext-empty'
New-Item -ItemType Directory -Force -Path $env:AZURE_EXTENSION_DIR | Out-Null

az account set --subscription $sub | Out-Null

Write-Host "1/4 Dodaję redirect URI do BAKK Ext Apps ($sharedAppId)..."
$existing = az ad app show --id $sharedAppId --query "web.redirectUris" -o json | ConvertFrom-Json
if ($existing -contains $redirectUri) {
    Write-Host "    Już jest: $redirectUri"
} else {
    $merged = @($existing) + @($redirectUri)
    az ad app update --id $sharedAppId --web-redirect-uris @merged | Out-Null
    Write-Host "    Dodane: $redirectUri"
}

Write-Host "2/4 Kopiuję $secretName z $srcApp do $dstApp..."
$secret = az webapp config appsettings list -g $rg -n $srcApp `
    --query "[?name=='$secretName'].value | [0]" -o tsv
if (-not $secret) {
    throw "Nie znalazłem $secretName w $srcApp. Easy Auth na $srcApp musi być włączone z tym providerem."
}
az webapp config appsettings set -g $rg -n $dstApp `
    --settings "$secretName=$secret" | Out-Null
Write-Host "    Wpięte (długość sekretu: $($secret.Length) znaków)"

Write-Host "3/4 Konfiguruję authsettingsV2 (lustro $srcApp)..."
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
} finally {
    Remove-Item -Force $tmp -ErrorAction SilentlyContinue
}

Write-Host "4/4 Restartuję App Service..."
az webapp restart -g $rg -n $dstApp | Out-Null

Write-Host ""
Write-Host "Gotowe. Otwórz https://$dstApp.azurewebsites.net/ — powinno przekierować na login BAKK Entra."
