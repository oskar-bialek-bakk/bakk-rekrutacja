# Konfiguracja sekretow Traffit dla Function App `bakk-rekrutacja-api`.
#
# Wymagane app settings:
#  - TRAFFIT_BASE_URL   np. https://intrum.traffit.com
#  - TRAFFIT_USERNAME   email konta technicznego BAKK w Traffit
#  - TRAFFIT_PASSWORD   haslo konta technicznego BAKK
#
# Function App robi HTTP form login (Symfony Security) w trybie konta
# technicznego. Cookie sesji jest cache'owany w pamieci modulu z TTL ~7h,
# auto-relogin na 401/403. Skrypt uruchamiasz JEDEN RAZ przy setupie - nie
# trzeba odnawiac cookie co miesiac jak w pierwotnym pre-shared cookie design.
#
# Opcjonalne:
#  - TRAFFIT_LOGIN_PATH        default /login (jesli Traffit ma inna sciezke)
#  - TRAFFIT_LOGIN_CHECK_PATH  default /login_check (form action)
#
# Uzycie:
#  ./set-traffit-secrets.ps1 -BaseUrl 'https://intrum.traffit.com' `
#    -Username 'bakk-bot@bakk.com' -Password '<haslo>'

param(
    [Parameter(Mandatory = $true)] [string]$BaseUrl,
    [Parameter(Mandatory = $true)] [string]$Username,
    [Parameter(Mandatory = $true)] [string]$Password,
    [string]$LoginPath = '',
    [string]$LoginCheckPath = ''
)

$ErrorActionPreference = 'Stop'

$rg   = 'rg-bakk-docs'
$func = 'bakk-rekrutacja-api'
$sub  = '28b7c9a4-317a-495c-99ed-6a6cec116a44'

$tempDir = [System.IO.Path]::GetTempPath()
$env:AZURE_EXTENSION_DIR = Join-Path $tempDir 'azext-empty'
New-Item -ItemType Directory -Force -Path $env:AZURE_EXTENSION_DIR | Out-Null

az account set --subscription $sub | Out-Null

# `az functionapp config appsettings set` przyjmuje KEY=VALUE jako pojedyncze
# argumenty PowerShell. PowerShell przekazuje stringi w cudzyslowach poprawnie
# nawet dla wartosci z `*[(` itp. (haslo). Tu UNIKAMY `az rest PUT` ktore
# zastepuje WSZYSTKIE settings - to risky bo Azure ma ukryte internal settings
# (m.in. WEBSITE_CONTENT* connection string z key-vault references), ktore
# `az rest list` zwraca w innym formacie niz wymaga PUT, co zostawia Function
# App w broken state (SCM 503 dla zawsze).
#
# Set komenda dodaje/aktualizuje pojedyncze klucze, zachowujac wszystkie inne
# Azure-managed settings bez ich dotykania. To safe.

$args = @("TRAFFIT_BASE_URL=$BaseUrl", "TRAFFIT_USERNAME=$Username", "TRAFFIT_PASSWORD=$Password")
if ($LoginPath)      { $args += "TRAFFIT_LOGIN_PATH=$LoginPath" }
if ($LoginCheckPath) { $args += "TRAFFIT_LOGIN_CHECK_PATH=$LoginCheckPath" }

az functionapp config appsettings set -g $rg -n $func --settings @args --only-show-errors | Out-Null
if ($LASTEXITCODE -ne 0) { throw "az functionapp config appsettings set sie nie powiodl." }

# Usun stary TRAFFIT_SESSION_COOKIE (pre-shared cookie z poprzedniej wersji)
az functionapp config appsettings delete -g $rg -n $func --setting-names TRAFFIT_SESSION_COOKIE --only-show-errors 2>&1 | Out-Null

Write-Host "Gotowe. Restart Function App zeby pickupowac nowe env vars..."
az functionapp restart -g $rg -n $func --only-show-errors | Out-Null
Write-Host "Done. Test: w UI bakk-rekrutacja -> 'Wyslij do Traffit'."
Write-Host "Konto techniczne: $Username @ $BaseUrl"
