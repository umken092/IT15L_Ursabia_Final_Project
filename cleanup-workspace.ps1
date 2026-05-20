param(
    [switch]$WhatIfMode
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

$targets = @(
    'artifacts',
    'src/CMNetwork.ClientApp/dist',
    'src/CMNetwork.ClientApp/node_modules',
    'src/CMNetwork.ClientApp/playwright-report',
    'src/CMNetwork.ClientApp/test-results'
)

foreach ($target in $targets) {
    if (Test-Path $target) {
        Write-Host "Removing $target"
        Remove-Item -Path $target -Recurse -Force -WhatIf:$WhatIfMode
    }
}

Get-ChildItem -Path 'src' -Include 'bin','obj' -Recurse -Directory -Force |
    ForEach-Object {
        Write-Host "Removing $($_.FullName)"
        Remove-Item -Path $_.FullName -Recurse -Force -WhatIf:$WhatIfMode
    }

Write-Host 'Cleanup completed.'
