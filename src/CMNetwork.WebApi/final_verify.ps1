$baseUrl = 'http://localhost:5128'
$email = 'superadmin@cmnetwork.com'
$password = 'Cmnetwork123!'
$loginResponse = Invoke-RestMethod -Method POST -Uri "$baseUrl/api/auth/login" -Body (@{email=$email;password=$password}|ConvertTo-Json) -ContentType 'application/json'
$headers = @{'Authorization' = "Bearer $($loginResponse.token)"; 'Content-Type' = 'application/json'}

# 1. Update with dummy credentials
$dummy = @{ publicKey = "pk_test_1"; secretKey = "sk_test_1" } | ConvertTo-Json
Invoke-RestMethod -Method PUT -Uri "$baseUrl/api/admin/paymongo-settings" -Headers $headers -Body $dummy | Out-Null

# 2. Check mask
$check = Invoke-RestMethod -Method GET -Uri "$baseUrl/api/admin/paymongo-settings" -Headers $headers
Write-Host "PublicKey: $($check.publicKey)"
Write-Host "SecretKey: '$($check.secretKey)'"
Write-Host "SecretKeyConfigured: $($check.secretKeyConfigured)"

if ($check.secretKey -match '\*') {
    Write-Host "VERDICT: SUCCESS - Secret is masked."
} elseif ($check.secretKey -eq "") {
    Write-Host "VERDICT: INCONCLUSIVE - Secret is empty (check API implementation)."
} else {
    Write-Host "VERDICT: FAILURE - Secret is visible: $($check.secretKey)"
}
