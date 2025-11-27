# Test Authentication Script
# Tests Cognito sign up and sign in functionality using AWS CLI

param(
    [string]$Email = "test@example.com",
    [string]$Password = "Test123!@#",
    [switch]$SignUp,
    [switch]$SignIn,
    [switch]$DeleteUser,
    [switch]$ConfirmUser
)

$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Cognito Authentication Test Script" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if AWS CLI is installed
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    throw "AWS CLI is not installed. Please install it first."
}

Push-Location $PSScriptRoot\..

try {
    # Get Terraform outputs
    Write-Host "Getting Terraform outputs..." -ForegroundColor Yellow
    $outputs = terraform output -json | ConvertFrom-Json
    
    $userPoolId = $outputs.cognito_user_pool_id.value
    $clientId = $outputs.cognito_user_pool_client_id.value

    if (-not $userPoolId -or -not $clientId) {
        throw "Could not get Cognito configuration from Terraform outputs"
    }

    Write-Host "User Pool ID: $userPoolId" -ForegroundColor Green
    Write-Host "Client ID: $clientId" -ForegroundColor Green
    Write-Host ""

    if ($SignUp) {
        Write-Host "Testing Sign Up..." -ForegroundColor Cyan
        Write-Host "Email: $Email" -ForegroundColor Yellow
        
        # Sign up user
        $signUpResult = aws cognito-idp sign-up `
            --client-id $clientId `
            --username $Email `
            --password $Password `
            --user-attributes Name=email,Value=$Email `
            2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "[SUCCESS] Sign up successful!" -ForegroundColor Green
            Write-Host $signUpResult
            
            # Check if email verification is required
            Write-Host "`nNote: Email verification may be required." -ForegroundColor Yellow
            Write-Host "You may need to confirm the user in AWS Console or via email." -ForegroundColor Yellow
        } else {
            Write-Host "[ERROR] Sign up failed:" -ForegroundColor Red
            Write-Host $signUpResult
        }
    }

    if ($SignIn) {
        Write-Host "`nTesting Sign In..." -ForegroundColor Cyan
        Write-Host "Email: $Email" -ForegroundColor Yellow

        # Temporarily change error action to continue so we can capture AWS CLI errors
        $oldErrorAction = $ErrorActionPreference
        $ErrorActionPreference = "Continue"

        try {
            # Sign in user (using USER_PASSWORD_AUTH which is enabled in the client)
            # Capture both stdout and stderr
            $signInOutput = & aws cognito-idp initiate-auth `
                --client-id $clientId `
                --auth-flow USER_PASSWORD_AUTH `
                --auth-parameters USERNAME=$Email,PASSWORD=$Password `
                2>&1

            $exitCode = $LASTEXITCODE
            $ErrorActionPreference = $oldErrorAction

            if ($exitCode -eq 0) {
                try {
                    # Filter out non-JSON output (like warnings)
                    $jsonOutput = $signInOutput | Where-Object { $_ -match '^\s*[\{\[]' } | Out-String
                    if (-not $jsonOutput) {
                        $jsonOutput = $signInOutput | Out-String
                    }
                    $signInResult = $jsonOutput | ConvertFrom-Json
                    
                    if ($signInResult.AuthenticationResult) {
                        Write-Host "[SUCCESS] Sign in successful!" -ForegroundColor Green
                        Write-Host "Access Token: $($signInResult.AuthenticationResult.AccessToken.Substring(0, 50))..." -ForegroundColor Gray
                        Write-Host "ID Token: $($signInResult.AuthenticationResult.IdToken.Substring(0, 50))..." -ForegroundColor Gray
                        Write-Host "Refresh Token: $($signInResult.AuthenticationResult.RefreshToken.Substring(0, 50))..." -ForegroundColor Gray
                    } else {
                        Write-Host "[ERROR] Sign in failed - unexpected response:" -ForegroundColor Red
                        Write-Host ($signInResult | ConvertTo-Json -Depth 5)
                    }
                } catch {
                    Write-Host "[ERROR] Failed to parse response:" -ForegroundColor Red
                    Write-Host ($signInOutput | Out-String)
                }
            } else {
                Write-Host "[ERROR] Sign in failed (Exit Code: $exitCode):" -ForegroundColor Red
                
                # Convert output to string for display
                $errorText = $signInOutput | Out-String
                Write-Host $errorText
                
                # Try to extract JSON error if present
                $errorJson = $null
                try {
                    # Look for JSON in the output
                    $jsonMatch = [regex]::Match($errorText, '\{.*\}', [System.Text.RegularExpressions.RegexOptions]::Singleline)
                    if ($jsonMatch.Success) {
                        $errorJson = $jsonMatch.Value | ConvertFrom-Json
                    }
                } catch {
                    # Not JSON, that's okay
                }
                
                if ($errorJson) {
                    if ($errorJson.__type) {
                        Write-Host "`nError Type: $($errorJson.__type)" -ForegroundColor Yellow
                    }
                    if ($errorJson.message) {
                        Write-Host "Error Message: $($errorJson.message)" -ForegroundColor Yellow
                    }
                }
                
                # Check for common errors in the text
                if ($errorText -match "UserNotConfirmedException") {
                    Write-Host "`n[INFO] User is not confirmed. Use -ConfirmUser to confirm the user first." -ForegroundColor Yellow
                } elseif ($errorText -match "NotAuthorizedException") {
                    Write-Host "`n[INFO] Invalid credentials or user not found." -ForegroundColor Yellow
                } elseif ($errorText -match "UserNotFoundException") {
                    Write-Host "`n[INFO] User not found. Sign up first using -SignUp." -ForegroundColor Yellow
                } elseif ($errorText -match "Incorrect username or password") {
                    Write-Host "`n[INFO] Incorrect username or password." -ForegroundColor Yellow
                }
            }
        } catch {
            $ErrorActionPreference = $oldErrorAction
            Write-Host "[ERROR] Sign in failed with exception:" -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Red
            Write-Host "Exception Type: $($_.Exception.GetType().FullName)" -ForegroundColor Red
            if ($_.Exception.InnerException) {
                Write-Host "Inner Exception: $($_.Exception.InnerException.Message)" -ForegroundColor Red
            }
            Write-Host "Stack Trace: $($_.ScriptStackTrace)" -ForegroundColor Gray
        }
    }

    if ($ConfirmUser) {
        Write-Host "`nConfirming user..." -ForegroundColor Cyan
        Write-Host "Email: $Email" -ForegroundColor Yellow

        $confirmResult = aws cognito-idp admin-confirm-sign-up `
            --user-pool-id $userPoolId `
            --username $Email `
            2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "[SUCCESS] User confirmed successfully!" -ForegroundColor Green
        } else {
            Write-Host "[ERROR] User confirmation failed:" -ForegroundColor Red
            Write-Host $confirmResult
        }
    }

    if ($DeleteUser) {
        Write-Host "`nDeleting test user..." -ForegroundColor Cyan
        $deleteResult = aws cognito-idp admin-delete-user `
            --user-pool-id $userPoolId `
            --username $Email `
            2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "[SUCCESS] User deleted successfully" -ForegroundColor Green
        } else {
            Write-Host "[WARNING] Delete failed (user may not exist):" -ForegroundColor Yellow
            Write-Host $deleteResult
        }
    }

    if (-not $SignUp -and -not $SignIn -and -not $DeleteUser -and -not $ConfirmUser) {
        Write-Host "Usage examples:" -ForegroundColor Yellow
        Write-Host "  .\test-auth.ps1 -SignUp -Email test@example.com -Password 'Test123!@#'"
        Write-Host "  .\test-auth.ps1 -ConfirmUser -Email test@example.com"
        Write-Host "  .\test-auth.ps1 -SignIn -Email test@example.com -Password 'Test123!@#'"
        Write-Host "  .\test-auth.ps1 -DeleteUser -Email test@example.com"
        Write-Host "  .\test-auth.ps1 -SignUp -ConfirmUser -SignIn -Email test@example.com -Password 'Test123!@#'"
    }

} catch {
    Write-Host "`n[ERROR] $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  Test completed" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan