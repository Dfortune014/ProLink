# Test OPTIONS endpoint directly
$apiUrl = "https://3ru1qftlea.execute-api.us-east-1.amazonaws.com"

Write-Host "Testing OPTIONS endpoint..." -ForegroundColor Cyan
Write-Host "URL: $apiUrl/username/check" -ForegroundColor Gray

try {
    $headers = @{
        "Origin" = "http://localhost:8080"
        "Access-Control-Request-Method" = "GET"
        "Access-Control-Request-Headers" = "content-type,authorization"
    }
    
    $response = Invoke-WebRequest -Uri "$apiUrl/username/check" -Method OPTIONS -Headers $headers -ErrorAction Stop
    
    Write-Host "`n[SUCCESS] OPTIONS request succeeded!" -ForegroundColor Green
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "`nResponse Headers:" -ForegroundColor Cyan
    $response.Headers.GetEnumerator() | ForEach-Object {
        if ($_.Key -like "*Access-Control*" -or $_.Key -like "*Content-Type*") {
            Write-Host "  $($_.Key): $($_.Value)" -ForegroundColor White
        }
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "`n[ERROR] OPTIONS request failed!" -ForegroundColor Red
    Write-Host "Status Code: $statusCode" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            if ($responseBody) {
                Write-Host "`nResponse Body:" -ForegroundColor Yellow
                Write-Host $responseBody -ForegroundColor White
            }
        } catch {
            # Ignore stream reading errors
        }
    }
    
    Write-Host "`nThis status code tells us:" -ForegroundColor Yellow
    switch ($statusCode) {
        404 { Write-Host "  - Route doesn't exist (OPTIONS route not deployed)" -ForegroundColor White }
        403 { Write-Host "  - Forbidden (CORS or authorization issue)" -ForegroundColor White }
        429 { Write-Host "  - Rate limited (wait a few minutes)" -ForegroundColor White }
        500 { Write-Host "  - Lambda error (check CloudWatch logs)" -ForegroundColor White }
        default { Write-Host "  - Unknown error (check CloudWatch logs)" -ForegroundColor White }
    }
}

