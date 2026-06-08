# Konfiguracja sekretow Traffit dla Function App `bakk-rekrutacja-api`.
#
# Wymagane app settings:
#  - TRAFFIT_BASE_URL        np. https://intrum.traffit.com
#  - TRAFFIT_SESSION_COOKIE  pelny header Cookie z aktywnej sesji Traffit
#                            (skopiuj z DevTools -> Network -> jakikolwiek
#                            request do /api/v2/* -> Request Headers -> Cookie).
#
# Cookie wygasa po ~30 dniach - raz na miesiac odpal ten skrypt ponownie z
# nowym cookie. Nie ma auto-login (wymagalby Chromium w Function App -
# nie wspierane na Linux Consumption).
#
# Uzycie:
#  - Edytuj zmienne $traffitBaseUrl i $traffitCookie ponizej
#  - LUB ustaw je przez parametry: ./set-traffit-secrets.ps1 -BaseUrl X -Cookie Y
#
# Wymagania:
#  - az CLI zalogowany na sub 28b7c9a4-...
#  - Function App `bakk-rekrutacja-api` istnieje.

param(
    [string]$BaseUrl = '',
    [string]$Cookie = ''
)

$ErrorActionPreference = 'Stop'

$rg   = 'rg-bakk-docs'
$func = 'bakk-rekrutacja-api'
$sub  = '28b7c9a4-317a-495c-99ed-6a6cec116a44'

if (-not $BaseUrl) {
    Write-Host "Brak parametru -BaseUrl. Podaj URL Traffit (np. https://intrum.traffit.com)."
    exit 1
}
if (-not $Cookie) {
    Write-Host "Brak parametru -Cookie. Skopiuj z DevTools -> Network -> Request Headers -> Cookie z aktywnej sesji Traffit."
    Write-Host "Przyklad: ./set-traffit-secrets.ps1 -BaseUrl 'https://intrum.traffit.com' -Cookie 'PHPSESSID=abc; traffit_user_id=123; ...'"
    exit 1
}

$tempDir = [System.IO.Path]::GetTempPath()
$env:AZURE_EXTENSION_DIR = Join-Path $tempDir 'azext-empty'
New-Item -ItemType Directory -Force -Path $env:AZURE_EXTENSION_DIR | Out-Null

az account set --subscription $sub | Out-Null

Write-Host "Wpinam TRAFFIT_BASE_URL i TRAFFIT_SESSION_COOKIE do app settings $func..."
az functionapp config appsettings set `
    -g $rg -n $func `
    --settings "TRAFFIT_BASE_URL=$BaseUrl" "TRAFFIT_SESSION_COOKIE=$Cookie" `
    --only-show-errors | Out-Null
if ($LASTEXITCODE -ne 0) { throw "az functionapp config appsettings set sie nie powiodlo." }

Write-Host "Gotowe. Restart Function App zeby pickupowac nowe env vars..."
az functionapp restart -g $rg -n $func | Out-Null
Write-Host "Gotowe. Test: w UI bakk-rekrutacja -> przycisk 'Wyslij do Traffit' powinien dzialac."
