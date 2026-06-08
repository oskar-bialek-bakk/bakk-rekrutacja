# Provisioning Cosmos DB serverless dla etap2 (Faza 5).
#
# Tworzy:
#  - konto Cosmos `bakk-rekrutacja-db` (serverless, Session consistency, polandcentral)
#  - baze `etap2`
#  - kontenery: assessments (partition /userPrincipalName), variantUsage (partition /scope),
#    settings (partition /userPrincipalName)
#
# Po wykonaniu zapisuje COSMOS_ENDPOINT + COSMOS_KEY do pliku tymczasowego i wypisuje TYLKO sciezke.
# Klucz w stdout/historii konsoli/logach CI jest ryzykowny - uzyj flag -ShowSecrets zeby
# wymusic wypisanie kluczy do stdout (np. dla rcznego copy-paste w lokalnej sesji).
# Seed `variantUsage.global` (counts: A[4]/B[3]/C[5]/D[3] z zerami) bedzie wykonany przez
# health endpoint Function App w Task 3 (lazy init) - NIE w tym skrypcie.
#
# Wymagania:
#  - az CLI zalogowany na sub 28b7c9a4-317a-495c-99ed-6a6cec116a44.
#  - PowerShell 5.1+ lub pwsh 7+.
#
# Idempotencja: kazdy krok robi --only-show-errors i sprawdza istnienie zasobu.

param(
    [switch]$ShowSecrets
)

$ErrorActionPreference = 'Stop'

$tempDir = [System.IO.Path]::GetTempPath()

$rg   = 'rg-bakk-docs'
$sub  = '28b7c9a4-317a-495c-99ed-6a6cec116a44'
$loc  = 'polandcentral'  # westeurope notorycznie odrzuca jako "high demand", polandcentral + RODO data residency PL
$acct = 'bakk-rekrutacja-db'
$db   = 'etap2'

# Bypass uszkodzonego rozszerzenia authV2 jesli istnieje (zgodnie z notatka z poprzednich sesji)
$env:AZURE_EXTENSION_DIR = Join-Path $tempDir 'azext-empty'
New-Item -ItemType Directory -Force -Path $env:AZURE_EXTENSION_DIR | Out-Null

az account set --subscription $sub | Out-Null

Write-Host "0/6 Sprawdzam rejestracje resource provider Microsoft.DocumentDB..."
$provState = az provider show -n Microsoft.DocumentDB --query registrationState -o tsv
if ($provState -ne 'Registered') {
    Write-Host "    Stan: $provState - rejestruje (moze trwac do 2 min)..."
    az provider register --namespace Microsoft.DocumentDB | Out-Null
    $tries = 0
    while ($provState -ne 'Registered' -and $tries -lt 60) {
        Start-Sleep -Seconds 5
        $provState = az provider show -n Microsoft.DocumentDB --query registrationState -o tsv
        $tries++
    }
    if ($provState -ne 'Registered') { throw "Provider Microsoft.DocumentDB nie zarejestrowal sie w 5 min. Stan: $provState" }
    Write-Host "    Zarejestrowany."
} else {
    Write-Host "    Juz Registered."
}

Write-Host "1/6 Sprawdzam czy konto Cosmos $acct juz istnieje w $rg..."
$accts = @(az cosmosdb list -g $rg --query "[].name" -o tsv)
if ($accts -contains $acct) {
    Write-Host "    Konto istnieje w $rg - pomijam tworzenie."
} else {
    $existsAcct = az cosmosdb check-name-exists --name $acct -o tsv
    if ($existsAcct -eq 'true') {
        throw "Nazwa $acct zajeta przez inne konto Cosmos poza $rg. Wybierz inna nazwe i zmien w skrypcie."
    }
    Write-Host "    Tworze konto Cosmos $acct (serverless, Session, $loc)..."
    # isZoneRedundant=False - niektore regiony (m.in. westeurope) zwracaja ServiceUnavailable
    # przy domyslnej zone-redundancy; rekrutacja nie potrzebuje multi-AZ, wiec zawsze single-zone.
    az cosmosdb create `
        -g $rg -n $acct `
        --capabilities EnableServerless `
        --default-consistency-level Session `
        --locations regionName=$loc failoverPriority=0 isZoneRedundant=False `
        --only-show-errors | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "az cosmosdb create sie nie powiodlo." }
    Write-Host "    Utworzone."
}

Write-Host "2/6 Tworze baze SQL $db (jesli nie ma)..."
$dbs = @(az cosmosdb sql database list -g $rg -a $acct --query "[].name" -o tsv)
if ($dbs -contains $db) {
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

$existingConts = @(az cosmosdb sql container list -g $rg -a $acct -d $db --query "[].name" -o tsv)
if ($LASTEXITCODE -ne 0) { throw "az cosmosdb sql container list sie nie powiodlo." }

$stepIdx = 3
foreach ($c in $containers) {
    Write-Host "$stepIdx/6 Tworze kontener $($c.name) (partition $($c.pk)) jesli nie ma..."
    if ($existingConts -contains $c.name) {
        Write-Host "    Istnieje - pomijam."
    } else {
        az cosmosdb sql container create `
            -g $rg -a $acct -d $db `
            -n $c.name `
            --partition-key-path $c.pk `
            --only-show-errors | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "az cosmosdb sql container create $($c.name) sie nie powiodlo." }
        $existingConts += $c.name
        Write-Host "    Utworzony."
    }
    $stepIdx++
}

Write-Host "6/6 Zapisuje endpoint + primary key do pliku tymczasowego..."
$endpoint = az cosmosdb show -g $rg -n $acct --query documentEndpoint -o tsv
if ($LASTEXITCODE -ne 0) { throw "Nie udalo sie pobrac documentEndpoint." }
$key = az cosmosdb keys list -g $rg -n $acct --type keys --query primaryMasterKey -o tsv
if ($LASTEXITCODE -ne 0) { throw "Nie udalo sie pobrac primaryMasterKey." }

$secretsFile = Join-Path $tempDir 'bakk-cosmos-secrets.txt'
@"
COSMOS_ENDPOINT=$endpoint
COSMOS_KEY=$key
COSMOS_DB=$db
"@ | Out-File -Encoding utf8 -FilePath $secretsFile

Write-Host ""
Write-Host "Sekrety zapisane do: $secretsFile"
Write-Host "Endpoint: $endpoint"
Write-Host "Klucz NIE pokazany w stdout (uzyj -ShowSecrets aby wymusic)."
if ($ShowSecrets) {
    Write-Host ""
    Write-Host "COSMOS_KEY=$key"
}
Write-Host ""
Write-Host "Gotowe. W Task 2 wpisz wartosci z pliku do app settings Function App:"
Write-Host "  az functionapp config appsettings set -g $rg -n bakk-rekrutacja-api ``"
Write-Host "    --settings COSMOS_ENDPOINT=`$endpoint COSMOS_KEY=`$key COSMOS_DB=`$db"
Write-Host ""
Write-Host "Seed variantUsage.global zostanie wykonany lazy przez health endpoint Function App w Task 3."
