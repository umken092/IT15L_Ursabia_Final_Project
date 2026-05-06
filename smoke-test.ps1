#!/usr/bin/env pwsh
<#
.SYNOPSIS
    CMNetwork API smoke test script.
    Authenticates as accountant, then calls all critical endpoints.
    Exits with code 1 if any call fails.

.PARAMETER BaseUrl
    Base URL of the API. Default: http://localhost:5128

.PARAMETER Email
    Login email. Default: accountant@cmnetwork.com

.PARAMETER Password
    Login password. Required (or set env var CMNETWORK_SMOKE_PASSWORD).
#>
param(
    [string]$BaseUrl = $env:CMNETWORK_API_URL ?? 'http://localhost:5128',
    [string]$Email = $env:CMNETWORK_SMOKE_EMAIL ?? 'accountant@cmnetwork.com',
    [string]$Password = $env:CMNETWORK_SMOKE_PASSWORD
)

$ErrorActionPreference = 'Stop'
$failures = 0

function Invoke-SmokeCheck {
    param(
        [string]$Label,
        [string]$Uri,
        [string]$Method = 'GET',
        [hashtable]$Headers = @{},
        [object]$Body = $null,
        [int]$ExpectedStatus = 200
    )
    try {
        $params = @{
            Uri     = $Uri
            Method  = $Method
            Headers = $Headers
        }
        if ($Body) {
            $params.Body        = ($Body | ConvertTo-Json -Depth 5)
            $params.ContentType = 'application/json'
        }
        $response = Invoke-WebRequest @params -SkipHttpErrorCheck
        $status   = $response.StatusCode

        if ($status -eq $ExpectedStatus) {
            Write-Host "  [PASS] $Label → $status" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] $Label → got $status, expected $ExpectedStatus" -ForegroundColor Red
            Write-Host "         Body: $($response.Content | Select-Object -First 500)" -ForegroundColor DarkRed
            $script:failures++
        }
    } catch {
        Write-Host "  [FAIL] $Label → exception: $_" -ForegroundColor Red
        $script:failures++
    }
}

Write-Host "`nCMNetwork Smoke Test — $BaseUrl`n" -ForegroundColor Cyan

# ── 1. Health (unauthenticated) ──────────────────────────────────────────────
Invoke-SmokeCheck -Label 'Health check (unauthenticated)' `
    -Uri "$BaseUrl/api/auth/health"

Invoke-SmokeCheck -Label 'Dashboard health (unauthenticated)' `
    -Uri "$BaseUrl/api/dashboard/health"

# ── 2. Auth ──────────────────────────────────────────────────────────────────
if (-not $Password) {
    Write-Host "`n[SKIP] No password provided. Set -Password or CMNETWORK_SMOKE_PASSWORD env var." -ForegroundColor Yellow
    Write-Host "       Skipping all authenticated tests.`n"
    exit 0
}

Write-Host "`nAuthenticating as $Email..." -ForegroundColor Cyan

$loginBody = @{ email = $Email; password = $Password }
try {
    $loginResponse = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" `
        -Method POST -Body ($loginBody | ConvertTo-Json) -ContentType 'application/json'
} catch {
    Write-Host "[FAIL] Login failed: $_" -ForegroundColor Red
    exit 1
}

$token = $loginResponse.accessToken
if (-not $token) {
    Write-Host "[FAIL] No accessToken in login response." -ForegroundColor Red
    exit 1
}

Write-Host "  [PASS] Login → 200 (token received)" -ForegroundColor Green
$authHeaders = @{ Authorization = "Bearer $token" }

# ── 3. Dashboard ─────────────────────────────────────────────────────────────
Invoke-SmokeCheck -Label 'Dashboard metrics — accountant' `
    -Uri "$BaseUrl/api/dashboard/accountant/metrics" -Headers $authHeaders

Invoke-SmokeCheck -Label 'Dashboard metrics — unknown role (expect 400)' `
    -Uri "$BaseUrl/api/dashboard/unknown-role/metrics" -Headers $authHeaders -ExpectedStatus 400

Invoke-SmokeCheck -Label 'Dashboard charts' `
    -Uri "$BaseUrl/api/dashboard/charts" -Headers $authHeaders

Invoke-SmokeCheck -Label 'Dashboard approvals' `
    -Uri "$BaseUrl/api/dashboard/approvals" -Headers $authHeaders

# ── 4. Expense Claims ────────────────────────────────────────────────────────
Invoke-SmokeCheck -Label 'Expense claims list' `
    -Uri "$BaseUrl/api/expense-claims" -Headers $authHeaders

# ── 5. AP Invoices ───────────────────────────────────────────────────────────
Invoke-SmokeCheck -Label 'AP invoices list' `
    -Uri "$BaseUrl/api/apinvoices" -Headers $authHeaders

# ── 6. AR Invoices ───────────────────────────────────────────────────────────
Invoke-SmokeCheck -Label 'AR invoices list' `
    -Uri "$BaseUrl/api/arinvoices" -Headers $authHeaders

# ── 7. General Ledger ────────────────────────────────────────────────────────
Invoke-SmokeCheck -Label 'GL accounts list' `
    -Uri "$BaseUrl/api/general-ledger/accounts" -Headers $authHeaders

Invoke-SmokeCheck -Label 'GL journal entries list' `
    -Uri "$BaseUrl/api/general-ledger/journals" -Headers $authHeaders

Invoke-SmokeCheck -Label 'GL trial balance' `
    -Uri "$BaseUrl/api/general-ledger/trial-balance" -Headers $authHeaders

# ── 8. Approvals ─────────────────────────────────────────────────────────────
Invoke-SmokeCheck -Label 'Approval queue list' `
    -Uri "$BaseUrl/api/approvals" -Headers $authHeaders

# ── 9. Unbalanced journal entry (expect 400) ─────────────────────────────────
$unbalancedEntry = @{
    entryDate   = (Get-Date).ToString('yyyy-MM-dd')
    description = 'Smoke test — unbalanced (should fail)'
    lines       = @(
        @{ accountId = '00000000-0000-0000-0000-000000000001'; debit = 100.00; credit = 0 }
        @{ accountId = '00000000-0000-0000-0000-000000000002'; debit = 0; credit = 50.00 }
    )
}
Invoke-SmokeCheck -Label 'Unbalanced journal entry (expect 400)' `
    -Uri "$BaseUrl/api/general-ledger/journals" -Method POST `
    -Headers $authHeaders -Body $unbalancedEntry -ExpectedStatus 400

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host "`n── Smoke test complete ──────────────────────────────────────────────────────"
if ($failures -eq 0) {
    Write-Host "All checks passed." -ForegroundColor Green
    exit 0
} else {
    Write-Host "$failures check(s) FAILED." -ForegroundColor Red
    exit 1
}
