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
#  ./set-traffit-secrets.ps1 -BaseUrl 'https://intrum.traffit.com' \
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

# Uzywamy az rest zeby uniknac CMD escapowania ampersandow w hasle/URL.
# 1. Pobierz aktualne app settings
$listJson = az rest --method post --uri "https://management.azure.com/subscriptions/$sub/resourceGroups/$rg/providers/Microsoft.Web/sites/$func/config/appsettings/list?api-version=2022-03-01" --only-show-errors
$settings = ($listJson | ConvertFrom-Json).properties
$hash = @{}
foreach ($p in $settings.PSObject.Properties) { $hash[$p.Name] = $p.Value }

# 2. Wpis nowe Traffit settings
$hash['TRAFFIT_BASE_URL']  = $BaseUrl
$hash['TRAFFIT_USERNAME']  = $Username
$hash['TRAFFIT_PASSWORD']  = $Password
if ($LoginPath)      { $hash['TRAFFIT_LOGIN_PATH']       = $LoginPath }
if ($LoginCheckPath) { $hash['TRAFFIT_LOGIN_CHECK_PATH'] = $LoginCheckPath }

# 3. Usun stary TRAFFIT_SESSION_COOKIE (pre-shared cookie wymagal manualnego renew)
$hash.Remove('TRAFFIT_SESSION_COOKIE') | Out-Null

$body = @{ properties = $hash } | ConvertTo-Json -Depth 5
$tmp = Join-Path $tempDir "traffit-settings-$([Guid]::NewGuid()).json"
$body | Out-File -Encoding utf8 -NoNewline $tmp

az rest --method put --uri "https://management.azure.com/subscriptions/$sub/resourceGroups/$rg/providers/Microsoft.Web/sites/$func/config/appsettings?api-version=2022-03-01" --body "@$tmp" --only-show-errors | Out-Null
if ($LASTEXITCODE -ne 0) { throw "az rest PUT appsettings sie nie powiodl." }
Remove-Item $tmp -Force

Write-Host "Gotowe. Restart Function App zeby pickupowac nowe env vars..."
az functionapp restart -g $rg -n $func --only-show-errors | Out-Null
Write-Host "Done. Test: w UI bakk-rekrutacja -> 'Wyslij do Traffit'."
Write-Host "Konto techniczne: $Username @ $BaseUrl"
