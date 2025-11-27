# Test Authentication via Direct API Calls
# This script tests sign up and sign in using direct HTTP requests to Cognito

param(
    [string]$Email = "test@example.com",
    [string]$Password = "Test123!@#",
    [switch]$SignUp,
    [switch]$SignIn
)

$ErrorActionPreference = "Stop"

Push-Location $PSScriptRoot\..

try {
    # Get Terraform outputs
    $outputs = terraform output -json | ConvertFrom-Json
    $userPoolId = $outputs.cognito_user_pool_id.value
    $clientId = $outputs.cognito_user_pool_client_id.value
    $region = (terraform output -json | ConvertFrom-Json).cognito_user_pool_id.value -split "_" | Select-Object -First 1

    Write-Host "Region: $region" -ForegroundColor Green
    Write-Host "User Pool ID: $userPoolId" -ForegroundColor Green
    Write-Host "Client ID: $clientId" -ForegroundColor Green
    Write-Host ""

    if ($SignUp) {
        Write-Host "Testing Sign Up via API..." -ForegroundColor Cyan
        
        $signUpUrl = "https://cognito-idp.$region.amazonaws.com/"
        $signUpBody = @{
            ClientId = $clientId
            Username = $Email
            Password = $Password
            UserAttributes = @(
                @{ Name = "email"; Value = $Email }
            )
        } | ConvertTo-Json -Depth 10

        $headers = @{
            "X-Amz-Target" = "AWSCognitoIdentityProviderService.SignUp"
            "Content-Type" = "application/x-amz-json-1.1"
        }

        try {
            $response = Invoke-RestMethod -Uri $signUpUrl -Method Post -Body $signUpBody -Headers $headers
            Write-Host "✓ Sign up successful!" -ForegroundColor Green
            Write-Host ($response | ConvertTo-Json -Depth 5)
        } catch {
            Write-Host "✗ Sign up failed:" -ForegroundColor Red
            $_.Exception.Response | Format-List
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host $responseBody
        }
    }

    if ($SignIn) {
        Write-Host "`nTesting Sign In via API..." -ForegroundColor Cyan
        
        # Note: Sign in requires SRP (Secure Remote Password) protocol
        # This is complex to implement. Use AWS CLI or SDK instead.
        Write-Host "Note: Direct API sign-in requires SRP protocol implementation." -ForegroundColor Yellow
        Write-Host "Use AWS CLI or the test-auth.ps1 script with -SignIn instead." -ForegroundColor Yellow
    }

} catch {
    Write-Host "`n✗ Error: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}