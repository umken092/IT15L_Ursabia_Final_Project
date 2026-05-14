$baseUrl = 'http://localhost:5128'
$email = 'superadmin@cmnetwork.com'
$password = 'Cmnetwork123!'
$loginResponse = Invoke-RestMethod -Method POST -Uri "$baseUrl/api/auth/login" -Body (@{email=$email;password=$password}|ConvertTo-Json) -ContentType 'application/json'
$headers = @{'Authorization' = "Bearer $($loginResponse.token)"; 'Content-Type' = 'application/json'}

# 1. Check GET response structure more deeply
$res = Invoke-WebRequest -Method GET -Uri "$baseUrl/api/admin/paymongo-settings" -Headers $headers
Write-Host "GET Raw Content: $($res.Content)"

# 2. Try POST with some valid-looking (but fake) keys
$testCreds = @{
    publicKey = ""
    secretKey = ""
} | ConvertTo-Json
try {
    Invoke-RestMethod -Method POST -Uri "$baseUrl/api/admin/paymongo-settings/test" -Headers $headers -Body $testCreds
} catch {
    Write-Host "POST Test Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Error Body: $($reader.ReadToEnd())"
    }
}
