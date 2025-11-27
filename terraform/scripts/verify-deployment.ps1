# Script to verify API Gateway deployment and test OPTIONS endpoint
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "API Gateway Deployment Verification" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan

# Get API Gateway URL from Terraform outputs
Write-Host "`nChecking Terraform outputs..." -ForegroundColor Yellow
$apiUrl = terraform output -raw api_gateway_url 2>$null

if (-not $apiUrl) {
    Write-Host "[WARNING] Could not get API Gateway URL from Terraform outputs" -ForegroundColor Yellow
    Write-Host "Please run 'terraform apply' first, or manually set the API URL" -ForegroundColor Yellow
    $apiUrl = Read-Host "Enter API Gateway URL (e.g., https://xxxxx.execute-api.us-east-1.amazonaws.com)"
} else {
    Write-Host "[SUCCESS] API Gateway URL: $apiUrl" -ForegroundColor Green
}

# Test OPTIONS endpoint
Write-Host "`nTesting OPTIONS endpoint..." -ForegroundColor Yellow
Write-Host "Waiting 2 seconds to avoid rate limiting..." -ForegroundColor Gray
Start-Sleep -Seconds 2

try {
    $headers = @{
        "Origin" = "http://localhost:8080"
        "Access-Control-Request-Method" = "GET"
        "Access-Control-Request-Headers" = "content-type,authorization"
    }
    
    $response = Invoke-WebRequest -Uri "$apiUrl/username/check" -Method OPTIONS -Headers $headers -ErrorAction Stop
    
    Write-Host "[SUCCESS] OPTIONS request succeeded!" -ForegroundColor Green
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "`nResponse Headers:" -ForegroundColor Cyan
    $response.Headers.GetEnumerator() | Where-Object { $_.Key -like "*Access-Control*" -or $_.Key -like "*Content-Type*" } | ForEach-Object {
        Write-Host "  $($_.Key): $($_.Value)" -ForegroundColor White
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "[ERROR] OPTIONS request failed!" -ForegroundColor Red
    Write-Host "Status Code: $statusCode" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($statusCode -eq 429) {
        Write-Host "[INFO] Rate limited. Wait a few minutes and try again." -ForegroundColor Yellow
        Write-Host "The endpoint exists - this is just rate limiting from too many requests." -ForegroundColor Yellow
    } elseif ($statusCode -eq 404) {
        Write-Host "[WARNING] Route not found. Make sure Terraform changes have been applied." -ForegroundColor Yellow
    } elseif ($statusCode -eq 403) {
        Write-Host "[WARNING] Forbidden. Check CORS configuration." -ForegroundColor Yellow
    }
    
    if ($_.Exception.Response) {
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            if ($responseBody) {
                Write-Host "Response Body: $responseBody" -ForegroundColor Red
            }
        } catch {
            # Ignore stream reading errors
        }
    }
}

# Test GET endpoint
Write-Host "`nTesting GET endpoint..." -ForegroundColor Yellow
Write-Host "Waiting 2 seconds to avoid rate limiting..." -ForegroundColor Gray
Start-Sleep -Seconds 2

try {
    $response = Invoke-WebRequest -Uri "$apiUrl/username/check?username=testuser" -Method GET -ErrorAction Stop
    
    Write-Host "[SUCCESS] GET request succeeded!" -ForegroundColor Green
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor White
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "[ERROR] GET request failed!" -ForegroundColor Red
    Write-Host "Status Code: $statusCode" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($statusCode -eq 429) {
        Write-Host "[INFO] Rate limited. Wait a few minutes and try again." -ForegroundColor Yellow
    }
}

Write-Host "`n" + ("=" * 80) -ForegroundColor Cyan
Write-Host "Verification complete." -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. If you got 429 errors, wait a few minutes for rate limits to reset" -ForegroundColor White
Write-Host "2. Check CloudWatch logs: .\scripts\check-logs.ps1" -ForegroundColor White
Write-Host "3. Test from browser - the CORS error should show more details in console" -ForegroundColor White
Write-Host "=" * 80 -ForegroundColor Cyan

