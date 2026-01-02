# Setup Frontend Environment Variables
# This script creates a .env file with the API Gateway URL from Terraform

Write-Host "Setting up frontend environment variables..." -ForegroundColor Cyan

# Get the API Gateway URL from Terraform
$terraformDir = Join-Path (Split-Path -Parent $PSScriptRoot) "terraform"
$apiUrl = ""

if (Test-Path $terraformDir) {
    Push-Location $terraformDir
    try {
        $apiUrl = terraform output -raw api_gateway_url 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Warning: Could not get API Gateway URL from Terraform" -ForegroundColor Yellow
            Write-Host "You may need to run 'terraform apply' first" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Warning: Error getting API Gateway URL: $_" -ForegroundColor Yellow
    } finally {
        Pop-Location
    }
} else {
    Write-Host "Warning: Terraform directory not found at: $terraformDir" -ForegroundColor Yellow
}

# Get S3 Bucket Name
$s3Bucket = ""
if (Test-Path $terraformDir) {
    Push-Location $terraformDir
    try {
        $s3Bucket = terraform output -raw s3_bucket_name 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Warning: Could not get S3 bucket name from Terraform" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Warning: Error getting S3 bucket name: $_" -ForegroundColor Yellow
    } finally {
        Pop-Location
    }
}

# Create .env file
$envFile = Join-Path $PSScriptRoot ".env"
$envContent = @"
# API Gateway URL
# Generated automatically - do not edit manually
VITE_API_GATEWAY_URL=$apiUrl

# S3 Bucket Name
VITE_S3_BUCKET_NAME=$s3Bucket
"@

if ($apiUrl -and $apiUrl -notmatch "Error|Warning") {
    Set-Content -Path $envFile -Value $envContent
    Write-Host "✓ Created .env file with:" -ForegroundColor Green
    Write-Host "  VITE_API_GATEWAY_URL=$apiUrl" -ForegroundColor Green
    if ($s3Bucket -and $s3Bucket -notmatch "Error|Warning") {
        Write-Host "  VITE_S3_BUCKET_NAME=$s3Bucket" -ForegroundColor Green
    }
    Write-Host "`nPlease restart your dev server for changes to take effect." -ForegroundColor Cyan
} else {
    Write-Host "✗ Could not automatically create .env file" -ForegroundColor Red
    Write-Host "Please create frontend/.env manually with:" -ForegroundColor Yellow
    Write-Host '  VITE_API_GATEWAY_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com' -ForegroundColor Yellow
    Write-Host '  VITE_S3_BUCKET_NAME=your-bucket-name' -ForegroundColor Yellow
}

