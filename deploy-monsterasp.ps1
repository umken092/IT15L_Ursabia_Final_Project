# Clean MonsterAsp deploy script.
#
# Produces a publish folder at .\artifacts\monsterasp-api ready to upload
# to MonsterAsp via FTP / File Manager.
#
# Usage (from repo root):
#   pwsh -File .\deploy-monsterasp.ps1
#   pwsh -File .\deploy-monsterasp.ps1 -SkipSpaBuild   # only if dist is already up to date
#
[CmdletBinding()]
param(
    [string]$Configuration = 'Release',
    [string]$OutputDir    = "$PSScriptRoot\artifacts\monsterasp-api",
    [switch]$SkipSpaBuild
)

$ErrorActionPreference = 'Stop'

$repoRoot   = $PSScriptRoot
$webApiProj = Join-Path $repoRoot 'src\CMNetwork.WebApi\CMNetwork.WebApi.csproj'
$spaRoot    = Join-Path $repoRoot 'src\CMNetwork.ClientApp'

if (-not (Test-Path $webApiProj)) {
    throw "WebApi project not found at $webApiProj"
}

Write-Host '== Step 1: Wipe previous publish output ==' -ForegroundColor Cyan
if (Test-Path $OutputDir) {
    Remove-Item -Recurse -Force $OutputDir
}
New-Item -ItemType Directory -Path $OutputDir | Out-Null

Write-Host '== Step 2: Stop any running WebApi (releases file locks) ==' -ForegroundColor Cyan
Get-Process -Name 'CMNetwork.WebApi' -ErrorAction SilentlyContinue |
    ForEach-Object { Write-Host "  Killing PID $($_.Id)"; $_ | Stop-Process -Force }

Write-Host '== Step 3: dotnet publish (will also build the SPA) ==' -ForegroundColor Cyan
$publishArgs = @(
    'publish', $webApiProj,
    '-c', $Configuration,
    '-o', $OutputDir,
    '/p:UseAppHost=false'
)
if ($SkipSpaBuild) {
    $publishArgs += '/p:SkipSpaBuild=true'
}
& dotnet @publishArgs
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed (exit $LASTEXITCODE)" }

Write-Host '== Step 4: Sanity check ==' -ForegroundColor Cyan
$indexHtml = Join-Path $OutputDir 'wwwroot\index.html'
$webConfig = Join-Path $OutputDir 'web.config'
$mainDll   = Join-Path $OutputDir 'CMNetwork.WebApi.dll'
foreach ($f in @($indexHtml, $webConfig, $mainDll)) {
    if (-not (Test-Path $f)) { throw "Missing expected file: $f" }
    Write-Host "  OK  $f"
}

# Verify the new ExpenseClaims dialog made it into the SPA bundle
$placeholderJs = Get-ChildItem -Path (Join-Path $OutputDir 'wwwroot\assets') `
    -Filter 'ModulePlaceholderPage-*.js' -ErrorAction SilentlyContinue
if ($placeholderJs) {
    $hit = Select-String -Path $placeholderJs.FullName -Pattern 'Create Expense Claim' -SimpleMatch -Quiet
    if ($hit) {
        Write-Host "  OK  SPA bundle contains 'Create Expense Claim' dialog ($($placeholderJs.Name))" -ForegroundColor Green
    } else {
        Write-Warning "SPA bundle does NOT contain 'Create Expense Claim'. Did you skip the SPA build?"
    }
}

Write-Host ''
Write-Host '== Done ==' -ForegroundColor Green
Write-Host "Publish output: $OutputDir"
Write-Host ''
Write-Host 'Next steps:' -ForegroundColor Yellow
Write-Host '  1. Open MonsterAsp File Manager (or FTP).'
Write-Host '  2. In your site root (httpdocs / wwwroot for the IIS site), DELETE the existing files'
Write-Host '     (especially the entire /wwwroot/assets folder so old hashed bundles are gone).'
Write-Host "  3. Upload the ENTIRE contents of '$OutputDir' to the site root."
Write-Host '  4. Restart the site (Application Pool / Restart) from MonsterAsp control panel.'
Write-Host '  5. Open the site in incognito and Ctrl+F5.'
