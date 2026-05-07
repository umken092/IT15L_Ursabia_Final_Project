# MonsterAsp deployment package script.
#
# Builds quality gates locally, produces a self-contained IIS package, and
# writes a ZIP ready for upload to MonsterAsp.
#
# Usage (from repo root):
#   pwsh -File .\deploy-monsterasp.ps1
#   pwsh -File .\deploy-monsterasp.ps1 -VerifyBaseUrl http://cmnetwork.runasp.net -VerifyEmail admin@cmnetwork.com -VerifyPassword '<password>'

[CmdletBinding()]
param(
    [string]$Configuration = 'Release',
    [string]$Runtime = 'win-x64',
    [string]$PublishDir = "$PSScriptRoot\publish-sc",
    [string]$ZipPath = "$PSScriptRoot\publish-sc.zip",
    [string]$VerifyBaseUrl,
    [string]$VerifyEmail,
    [string]$VerifyPassword
)

$ErrorActionPreference = 'Stop'

$repoRoot = $PSScriptRoot
$solution = Join-Path $repoRoot 'CMNetwork.sln'
$webApiProj = Join-Path $repoRoot 'src\CMNetwork.WebApi\CMNetwork.WebApi.csproj'
$spaRoot = Join-Path $repoRoot 'src\CMNetwork.ClientApp'
$smokeScript = Join-Path $repoRoot 'smoke-test.ps1'

function Invoke-Step {
    param(
        [string]$Label,
        [scriptblock]$Action
    )

    Write-Host "== $Label ==" -ForegroundColor Cyan
    & $Action
}

function Assert-PathExists {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Required path not found: $Path"
    }
}

function Set-MonsterAspWebConfig {
    param([string]$Path)

    $webConfig = @'
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <location path="." inheritInChildApplications="false">
    <system.webServer>
      <handlers>
        <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
      </handlers>
      <aspNetCore processPath=".\CMNetwork.WebApi.exe" stdoutLogEnabled="false" stdoutLogFile=".\logs\stdout" hostingModel="inprocess" />
    </system.webServer>
  </location>
</configuration>
'@

    Set-Content -Path $Path -Value $webConfig -Encoding UTF8
}

Assert-PathExists $solution
Assert-PathExists $webApiProj
Assert-PathExists $spaRoot
Assert-PathExists $smokeScript

Invoke-Step 'Quality gate: frontend install' {
    Push-Location $spaRoot
    try {
        & npm ci
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed (exit $LASTEXITCODE)" }
    }
    finally {
        Pop-Location
    }
}

Invoke-Step 'Quality gate: frontend lint' {
    Push-Location $spaRoot
    try {
        & npm run lint
        if ($LASTEXITCODE -ne 0) { throw "npm run lint failed (exit $LASTEXITCODE)" }
    }
    finally {
        Pop-Location
    }
}

Invoke-Step 'Quality gate: frontend build' {
    Push-Location $spaRoot
    try {
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build failed (exit $LASTEXITCODE)" }
    }
    finally {
        Pop-Location
    }
}

Invoke-Step 'Quality gate: backend build' {
    & dotnet build $solution
    if ($LASTEXITCODE -ne 0) { throw "dotnet build failed (exit $LASTEXITCODE)" }
}

Invoke-Step 'Prepare publish output' {
    if (Test-Path $PublishDir) {
        Remove-Item -Recurse -Force $PublishDir
    }

    $publishParent = Split-Path -Parent $PublishDir
    if (-not (Test-Path $publishParent)) {
        New-Item -ItemType Directory -Path $publishParent | Out-Null
    }
}

Invoke-Step 'Self-contained publish for MonsterAsp' {
    & dotnet publish $webApiProj `
        -c $Configuration `
        -o $PublishDir `
        --self-contained true `
        -r $Runtime `
        /p:SkipSpaBuild=true

    if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed (exit $LASTEXITCODE)" }
}

Invoke-Step 'Rewrite web.config for self-contained IIS hosting' {
    Set-MonsterAspWebConfig -Path (Join-Path $PublishDir 'web.config')
}

Invoke-Step 'Sanity check publish contents' {
    $requiredFiles = @(
        (Join-Path $PublishDir 'CMNetwork.WebApi.exe'),
        (Join-Path $PublishDir 'CMNetwork.WebApi.dll'),
        (Join-Path $PublishDir 'web.config'),
        (Join-Path $PublishDir 'wwwroot\index.html')
    )

    foreach ($file in $requiredFiles) {
        Assert-PathExists $file
        Write-Host "  OK  $file" -ForegroundColor Green
    }

    $assetsDir = Join-Path $PublishDir 'wwwroot\assets'
    Assert-PathExists $assetsDir
}

Invoke-Step 'Package deployment zip' {
    if (Test-Path $ZipPath) {
        Remove-Item -Force $ZipPath
    }

    Compress-Archive -Path (Join-Path $PublishDir '*') -DestinationPath $ZipPath -Force
    Write-Host "  OK  $ZipPath" -ForegroundColor Green
}

if ($VerifyBaseUrl -and $VerifyPassword) {
    Invoke-Step 'Post-deploy smoke verification' {
        $smokeArgs = @(
            '-File', $smokeScript,
            '-BaseUrl', $VerifyBaseUrl,
            '-Password', $VerifyPassword
        )

        if ($VerifyEmail) {
            $smokeArgs += @('-Email', $VerifyEmail)
        }

        & pwsh @smokeArgs
        if ($LASTEXITCODE -ne 0) { throw "smoke-test.ps1 failed (exit $LASTEXITCODE)" }
    }
}

Write-Host ''
Write-Host '== MonsterAsp package ready ==' -ForegroundColor Green
Write-Host "Publish directory: $PublishDir"
Write-Host "Zip package: $ZipPath"
Write-Host ''
Write-Host 'MonsterAsp environment variables required:' -ForegroundColor Yellow
Write-Host '  Jwt__Secret'
Write-Host '  ConnectionStrings__MonsterAspConnection'
Write-Host '  Database__UseMonsterAsp=true'
Write-Host '  ASPNETCORE_ENVIRONMENT=Production'
Write-Host '  BootstrapAdmin__Email  (required on first production deploy / recovery)'
Write-Host '  BootstrapAdmin__Password  (required on first production deploy / recovery)'
Write-Host '  BootstrapAdmin__FirstName  (optional)'
Write-Host '  BootstrapAdmin__LastName  (optional)'
Write-Host ''
Write-Host 'MonsterAsp deployment steps:' -ForegroundColor Yellow
Write-Host '  1. Upload the ZIP contents or extract the ZIP into /wwwroot.'
Write-Host '  2. Ensure /wwwroot/logs exists.'
Write-Host '  3. Restart the MonsterAsp app pool.'
Write-Host '  4. Run this script again with -VerifyBaseUrl/-VerifyPassword for smoke verification.'
