# Get Terraform Outputs and Update .env.local
# This script extracts Terraform outputs and updates the frontend .env.local file

$ErrorActionPreference = "Stop"

Write-Host "Getting Terraform outputs..." -ForegroundColor Cyan

Push-Location $PSScriptRoot\..

try {
    # Get outputs as JSON
    $outputs = terraform output -json | ConvertFrom-Json
    
    if (-not $outputs) {
        throw "No Terraform outputs found. Make sure infrastructure is deployed."
    }

    # Extract values
    $userPoolId = $outputs.cognito_user_pool_id.value
    $clientId = $outputs.cognito_user_pool_client_id.value
    $domain = $outputs.cognito_domain.value
    $apiUrl = $outputs.api_gateway_url.value

    Write-Host "`nTerraform Outputs:" -ForegroundColor Green
    Write-Host "  User Pool ID: $userPoolId"
    Write-Host "  Client ID: $clientId"
    Write-Host "  Domain: $domain"
    Write-Host "  API Gateway URL: $apiUrl"

    # Update .env.local file
    $envFile = "..\frontend\.env.local"
    $envExample = "..\frontend\.env.example"

    Write-Host "`nUpdating $envFile..." -ForegroundColor Yellow

    $envContent = @"
# AWS Cognito Configuration
# Generated from Terraform outputs
VITE_COGNITO_USER_POOL_ID=$userPoolId
VITE_COGNITO_CLIENT_ID=$clientId
VITE_COGNITO_DOMAIN=$domain

# API Gateway Configuration
VITE_API_GATEWAY_URL=$apiUrl

# OAuth Redirect URI
VITE_REDIRECT_URI=http://localhost:3000/auth/callback
"@

    Set-Content -Path $envFile -Value $envContent -Force
    Write-Host "✓ .env.local updated successfully" -ForegroundColor Green

    Write-Host "`n✓ Configuration complete!" -ForegroundColor Green
    Write-Host "  You can now start the frontend with: cd frontend && npm run dev" -ForegroundColor Cyan

} catch {
    Write-Host "`n✗ Error: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}