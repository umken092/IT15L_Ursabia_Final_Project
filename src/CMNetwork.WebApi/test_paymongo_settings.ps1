$baseUrl = 'http://localhost:5128'
$email = 'superadmin@cmnetwork.com'
$password = 'Cmnetwork123!'

Write-Host "--- 1. Login ---"
$loginBody = @{email=$email;password=$password} | ConvertTo-Json
try {
    $loginResponse = Invoke-RestMethod -Method POST -Uri "$baseUrl/api/auth/login" -Body $loginBody -ContentType 'application/json'
    $token = $loginResponse.token
    Write-Host "Success: Token obtained."
} catch {
    Write-Host "Error during login: $_"
    exit
}

$headers = @{
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json'
}

Write-Host "`n--- 2. GET current PayMongo settings ---"
try {
    $currentSettings = Invoke-RestMethod -Method GET -Uri "$baseUrl/api/admin/paymongo-settings" -Headers $headers
    $currentSettings | ConvertTo-Json | Write-Host
} catch {
    Write-Host "Error GET settings: $_"
}

Write-Host "`n--- 3. POST /test connection ---"
$testCreds = @{
    publicKey = "pk_test_sample12345"
    secretKey = "sk_test_sample12345"
} | ConvertTo-Json
try {
    $testResponse = Invoke-RestMethod -Method POST -Uri "$baseUrl/api/admin/paymongo-settings/test" -Headers $headers -Body $testCreds
    $testResponse | ConvertTo-Json | Write-Host
} catch {
    Write-Host "Error POST test: $_"
}

Write-Host "`n--- 4. PUT to save settings ---"
try {
    $saveResponse = Invoke-RestMethod -Method PUT -Uri "$baseUrl/api/admin/paymongo-settings" -Headers $headers -Body $testCreds
    $saveResponse | ConvertTo-Json | Write-Host
} catch {
    Write-Host "Error PUT settings: $_"
}

Write-Host "`n--- 5. GET settings again (Verify masking) ---"
try {
    $finalSettings = Invoke-RestMethod -Method GET -Uri "$baseUrl/api/admin/paymongo-settings" -Headers $headers
    $finalSettings | ConvertTo-Json | Write-Host
    if ($finalSettings.secretKey -match '\*') {
        Write-Host "`nResult: Success - secretKey is masked."
    } else {
        Write-Host "`nResult: Failure - secretKey is NOT masked."
    }
} catch {
    Write-Host "Error GET final: $_"
}
