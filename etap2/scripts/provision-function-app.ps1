# Provisioning Function App `bakk-rekrutacja-api` (Faza 5 Task 2).
#
# Tworzy:
#  - storage account `stbakkrekrutacjaapi` (Standard_LRS, germanywestcentral)
#  - Function App `bakk-rekrutacja-api` na Consumption plan (Linux, Node 24, Functions v4)
#    w germanywestcentral - Linux Consumption nie jest wspierany w polandcentral
#    (gdzie jest Cosmos), DE West Central jest najblizsze (~30ms do Cosmos).
#    Node 24, bo Node 20 osiagnal EOL 2026-04-30 i Azure odmawia tworzenia.
#  - wpina app settings: COSMOS_ENDPOINT / COSMOS_KEY / COSMOS_DB z pliku
#    %TEMP%/bakk-cosmos-secrets.txt utworzonego przez provision-cosmos.ps1.
#
# Easy Auth + CORS w osobnym skrypcie: configure-function-app-auth.ps1
# (uruchom go PO tym skrypcie).
#
# Wymagania:
#  - az CLI zalogowany na sub 28b7c9a4-317a-495c-99ed-6a6cec116a44.
#  - PowerShell 5.1+ lub pwsh 7+.
#  - Sekrety Cosmos w %TEMP%/bakk-cosmos-secrets.txt (provision-cosmos.ps1 musi byc puszczony pierwszy).
#
# Idempotencja: sprawdza istnienie zasobu przed `create`.

$ErrorActionPreference = 'Stop'

$tempDir = [System.IO.Path]::GetTempPath()

$rg   = 'rg-bakk-docs'
$sub  = '28b7c9a4-317a-495c-99ed-6a6cec116a44'
$loc  = 'northeurope'  # germanywestcentral mial chronic SCM 503; northeurope (Dublin) ma najsolidniejsze wsparcie Linux Consumption
$func = 'bakk-rekrutacja-api'
$stg  = 'stbakkrekrutacjaapi'

# Bypass uszkodzonego rozszerzenia authV2 jesli istnieje
$env:AZURE_EXTENSION_DIR = Join-Path $tempDir 'azext-empty'
New-Item -ItemType Directory -Force -Path $env:AZURE_EXTENSION_DIR | Out-Null

az account set --subscription $sub | Out-Null

# Preflight: provider registrations
Write-Host "0/5 Sprawdzam rejestracje resource providers..."
$providers = @('Microsoft.Web', 'Microsoft.Storage')
foreach ($p in $providers) {
    $state = az provider show -n $p --query registrationState -o tsv
    if ($state -ne 'Registered') {
        Write-Host "    $p stan: $state - rejestruje (do 2 min)..."
        az provider register --namespace $p | Out-Null
        $tries = 0
        while ($state -ne 'Registered' -and $tries -lt 60) {
            Start-Sleep -Seconds 5
            $state = az provider show -n $p --query registrationState -o tsv
            $tries++
        }
        if ($state -ne 'Registered') { throw "Provider $p nie zarejestrowal sie. Stan: $state" }
        Write-Host "    Zarejestrowany."
    } else {
        Write-Host "    $p juz Registered."
    }
}

Write-Host "1/5 Sprawdzam czy storage account $stg juz istnieje w $rg..."
$stgs = @(az storage account list -g $rg --query "[].name" -o tsv)
if ($stgs -contains $stg) {
    Write-Host "    Istnieje - pomijam tworzenie."
} else {
    $stgGlobalAvail = az storage account check-name --name $stg --query nameAvailable -o tsv
    if ($stgGlobalAvail -ne 'true') {
        throw "Nazwa storage $stg zajeta globalnie. Wybierz inna nazwe i zmien w skrypcie."
    }
    Write-Host "    Tworze storage $stg (Standard_LRS, $loc)..."
    az storage account create `
        -g $rg -n $stg -l $loc `
        --sku Standard_LRS `
        --kind StorageV2 `
        --only-show-errors | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "az storage account create sie nie powiodlo." }
    Write-Host "    Utworzony."
}

Write-Host "2/5 Sprawdzam czy Function App $func juz istnieje w $rg..."
$funcs = @(az functionapp list -g $rg --query "[].name" -o tsv)
if ($funcs -contains $func) {
    Write-Host "    Istnieje - pomijam tworzenie."
} else {
    Write-Host "    Tworze Function App $func (Linux Consumption, Node 24, Functions v4, $loc)..."
    az functionapp create `
        -g $rg -n $func `
        --consumption-plan-location $loc `
        --runtime node `
        --runtime-version 24 `
        --functions-version 4 `
        --storage-account $stg `
        --os-type Linux `
        --only-show-errors | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "az functionapp create sie nie powiodlo." }
    Write-Host "    Utworzony."
}

Write-Host "3/5 Wczytuje sekrety Cosmos z %TEMP%/bakk-cosmos-secrets.txt..."
$secretsFile = Join-Path $tempDir 'bakk-cosmos-secrets.txt'
if (-not (Test-Path $secretsFile)) {
    throw "Brak pliku $secretsFile. Uruchom najpierw provision-cosmos.ps1."
}
$lines = Get-Content $secretsFile
$cosmosEndpoint = ($lines | Where-Object { $_ -like 'COSMOS_ENDPOINT=*' }) -replace '^COSMOS_ENDPOINT=', ''
$cosmosKey      = ($lines | Where-Object { $_ -like 'COSMOS_KEY=*' })      -replace '^COSMOS_KEY=', ''
$cosmosDb       = ($lines | Where-Object { $_ -like 'COSMOS_DB=*' })       -replace '^COSMOS_DB=', ''
if (-not $cosmosEndpoint -or -not $cosmosKey -or -not $cosmosDb) {
    throw "Plik $secretsFile niepelny. Uruchom ponownie provision-cosmos.ps1."
}
Write-Host "    Endpoint: $cosmosEndpoint"
Write-Host "    Db: $cosmosDb"
Write-Host "    Key: (dlugosc $($cosmosKey.Length))"

Write-Host "4/5 Wpinam app settings Cosmos do $func..."
az functionapp config appsettings set `
    -g $rg -n $func `
    --settings "COSMOS_ENDPOINT=$cosmosEndpoint" "COSMOS_KEY=$cosmosKey" "COSMOS_DB=$cosmosDb" `
    --only-show-errors | Out-Null
if ($LASTEXITCODE -ne 0) { throw "az functionapp config appsettings set sie nie powiodlo." }
Write-Host "    Wpiete."

Write-Host "5/5 Smoke test - host status..."
$state = az functionapp show -g $rg -n $func --query state -o tsv
Write-Host "    Function App state: $state"
Write-Host "    URL: https://$func.azurewebsites.net"
Write-Host ""
Write-Host "Gotowe. Teraz uruchom configure-function-app-auth.ps1 zeby"
Write-Host "wlaczyc Easy Auth z BAKK Int Apps i ustawic CORS."
