# Provisioning Cosmos DB serverless dla etap2 (Faza 5).
#
# Tworzy:
#  - konto Cosmos `bakk-rekrutacja-db` (serverless, Session consistency, westeurope)
#  - baze `etap2`
#  - kontenery: assessments (partition /userPrincipalName), variantUsage (partition /scope),
#    settings (partition /userPrincipalName)
#  - seed dokumentu variantUsage.global z licznikami 0
#
# Po wykonaniu wypisuje COSMOS_ENDPOINT + COSMOS_KEY do stdout - skopiuj je do
# app settings Function App `bakk-rekrutacja-api` w Task 2 (NIE App Service).
#
# Wymagania:
#  - az CLI zalogowany na sub 28b7c9a4-317a-495c-99ed-6a6cec116a44.
#  - PowerShell 5.1+ lub pwsh 7+.
#
# Idempotencja: kazdy krok robi --only-show-errors i sprawdza istnienie zasobu.

$ErrorActionPreference = 'Stop'

$tempDir = [System.IO.Path]::GetTempPath()

$rg   = 'rg-bakk-docs'
$sub  = '28b7c9a4-317a-495c-99ed-6a6cec116a44'
$loc  = 'westeurope'
$acct = 'bakk-rekrutacja-db'
$db   = 'etap2'

# Bypass uszkodzonego rozszerzenia authV2 jesli istnieje (zgodnie z notatka z poprzednich sesji)
$env:AZURE_EXTENSION_DIR = Join-Path $tempDir 'azext-empty'
New-Item -ItemType Directory -Force -Path $env:AZURE_EXTENSION_DIR | Out-Null

az account set --subscription $sub | Out-Null

Write-Host "1/6 Sprawdzam czy konto Cosmos $acct juz istnieje..."
$existsAcct = az cosmosdb check-name-exists --name $acct -o tsv
if ($existsAcct -eq 'true') {
    # check-name-exists zwraca true zarowno jak konto jest moje, jak i zajete przez innych.
    # Sprawdzam czy istnieje w mojej grupie zasobow.
    $myAcct = az cosmosdb show -g $rg -n $acct --query name -o tsv 2>$null
    if ($myAcct -eq $acct) {
        Write-Host "    Konto istnieje w $rg - pomijam tworzenie."
    } else {
        throw "Nazwa $acct zajeta przez inne konto Cosmos poza $rg. Wybierz inna nazwe i zmien w skrypcie."
    }
} else {
    Write-Host "    Tworze konto Cosmos $acct (serverless, Session, $loc)..."
    az cosmosdb create `
        -g $rg -n $acct `
        --capabilities EnableServerless `
        --default-consistency-level Session `
        --locations regionName=$loc `
        --only-show-errors | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "az cosmosdb create sie nie powiodlo." }
    Write-Host "    Utworzone."
}

Write-Host "2/6 Tworze baze SQL $db (jesli nie ma)..."
$dbExists = az cosmosdb sql database show -g $rg -a $acct -n $db --query name -o tsv 2>$null
if ($dbExists -eq $db) {
    Write-Host "    Baza $db istnieje - pomijam."
} else {
    az cosmosdb sql database create -g $rg -a $acct -n $db --only-show-errors | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "az cosmosdb sql database create sie nie powiodlo." }
    Write-Host "    Utworzona."
}

$containers = @(
    @{ name = 'assessments';  pk = '/userPrincipalName' },
    @{ name = 'variantUsage'; pk = '/scope' },
    @{ name = 'settings';     pk = '/userPrincipalName' }
)

$stepIdx = 3
foreach ($c in $containers) {
    Write-Host "$stepIdx/6 Tworze kontener $($c.name) (partition $($c.pk)) jesli nie ma..."
    $contExists = az cosmosdb sql container show -g $rg -a $acct -d $db -n $c.name --query name -o tsv 2>$null
    if ($contExists -eq $c.name) {
        Write-Host "    Istnieje - pomijam."
    } else {
        az cosmosdb sql container create `
            -g $rg -a $acct -d $db `
            -n $c.name `
            --partition-key-path $c.pk `
            --only-show-errors | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "az cosmosdb sql container create $($c.name) sie nie powiodlo." }
        Write-Host "    Utworzony."
    }
    $stepIdx++
}

Write-Host "6/6 Wypisuje endpoint + primary key (skopiuj do Function App settings w Task 2):"
$endpoint = az cosmosdb show -g $rg -n $acct --query documentEndpoint -o tsv
$key      = az cosmosdb keys list -g $rg -n $acct --type keys --query primaryMasterKey -o tsv
Write-Host ""
Write-Host "COSMOS_ENDPOINT=$endpoint"
Write-Host "COSMOS_KEY=$key"
Write-Host "COSMOS_DB=$db"
Write-Host ""
Write-Host "Gotowe. W Task 2 wpisz powyzsze do app settings Function App:"
Write-Host "  az functionapp config appsettings set -g $rg -n bakk-rekrutacja-api ``"
Write-Host "    --settings COSMOS_ENDPOINT=`$endpoint COSMOS_KEY=`$key COSMOS_DB=`$db"
Write-Host ""
Write-Host "Seed variantUsage.global zostanie wykonany w Task 3 (health endpoint po pierwszym ping)"
Write-Host "albo recznie po pierwszym deploy Function App."
