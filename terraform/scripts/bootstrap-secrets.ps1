# Force UTF-8 output (prevents emoji corruption on Windows)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Bootstrap OAuth Secrets in AWS Secrets Manager from terraform.tfvars
param(
    [Parameter(Mandatory = $false)]
    [string]$TfvarsPath,
    
    [Parameter(Mandatory = $false)]
    [string]$SecretId
)

# Set defaults if not provided
if (-not $TfvarsPath) { $TfvarsPath = "terraform.tfvars" }
if (-not $SecretId) { $SecretId = "prolink/oauth/secrets" }

$ErrorActionPreference = "Stop"

Write-Host "Bootstrapping OAuth Secrets from terraform.tfvars" -ForegroundColor Cyan
Write-Host ""

# Resolve paths
$scriptDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$terraformDir = Split-Path -Parent $scriptDir
$tfvarsFile   = Join-Path $terraformDir $TfvarsPath

if (-not (Test-Path $tfvarsFile)) {
    Write-Host "terraform.tfvars not found at: $tfvarsFile" -ForegroundColor Red
    exit 1
}

Write-Host "Reading terraform.tfvars..." -ForegroundColor Yellow
$tfvarsContent = Get-Content $tfvarsFile -Raw

# -------------------------------
# SAFE tfvars parser
# -------------------------------
function Get-TfVarValue {
    param(
        [string]$Content,
        [string]$VarName
    )

    # Match quoted values: key = "value"
    $quotedPattern = '(?m)^\s*' + [regex]::Escape($VarName) + '\s*=\s*"([^"]+)"'
    if ($Content -match $quotedPattern) {
        return $matches[1]
    }

    # Match unquoted values: key = value
    $unquotedPattern = '(?m)^\s*' + [regex]::Escape($VarName) + '\s*=\s*([^\s]+)'
    if ($Content -match $unquotedPattern) {
        return $matches[1]
    }

    return $null
}

# -------------------------------
# Extract secrets
# -------------------------------
$googleSecret   = Get-TfVarValue -Content $tfvarsContent -VarName "google_client_secret"
$linkedinSecret = Get-TfVarValue -Content $tfvarsContent -VarName "linkedin_client_secret"

$set1Google   = Get-TfVarValue -Content $tfvarsContent -VarName "set1_google_client_secret"
$set1LinkedIn = Get-TfVarValue -Content $tfvarsContent -VarName "set1_linkedin_client_secret"
$set2Google   = Get-TfVarValue -Content $tfvarsContent -VarName "set2_google_client_secret"
$set2LinkedIn = Get-TfVarValue -Content $tfvarsContent -VarName "set2_linkedin_client_secret"
$set3Google   = Get-TfVarValue -Content $tfvarsContent -VarName "set3_google_client_secret"
$set3LinkedIn = Get-TfVarValue -Content $tfvarsContent -VarName "set3_linkedin_client_secret"

# Fallback logic
if (-not $set1Google)   { $set1Google   = $googleSecret }
if (-not $set1LinkedIn) { $set1LinkedIn = $linkedinSecret }
if (-not $set2Google)   { $set2Google   = $googleSecret }
if (-not $set2LinkedIn) { $set2LinkedIn = $linkedinSecret }
if (-not $set3Google)   { $set3Google   = $googleSecret }
if (-not $set3LinkedIn) { $set3LinkedIn = $linkedinSecret }

if (-not $googleSecret -or -not $linkedinSecret) {
    Write-Host "Required secrets not found in terraform.tfvars" -ForegroundColor Red
    exit 1
}

Write-Host "Secrets found in terraform.tfvars" -ForegroundColor Green
Write-Host ""

# -------------------------------
# Ensure secret exists (or create it)
# -------------------------------
Write-Host "Checking if secret exists in AWS..." -ForegroundColor Yellow

$null = aws secretsmanager describe-secret --secret-id $SecretId 2>&1
$secretExists = $LASTEXITCODE -eq 0

if (-not $secretExists) {
    Write-Host "Secret does not exist. Creating it..." -ForegroundColor Yellow
    
    # Create the secret (Terraform will manage it, but we need it to exist first)
    aws secretsmanager create-secret `
        --name $SecretId `
        --description "OAuth client secrets for Google and LinkedIn with rotation support"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create secret. You may need to run 'terraform apply' first to create the secret resource." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Secret resource created" -ForegroundColor Green
    Write-Host ""
}

# -------------------------------
# Build secret JSON
# -------------------------------
$secretJson = @{
    current_index = 0
    google_client_secret   = $set1Google
    linkedin_client_secret = $set1LinkedIn
    secret_sets = @(
        @{
            google_client_secret   = $set1Google
            linkedin_client_secret = $set1LinkedIn
        },
        @{
            google_client_secret   = $set2Google
            linkedin_client_secret = $set2LinkedIn
        },
        @{
            google_client_secret   = $set3Google
            linkedin_client_secret = $set3LinkedIn
        }
    )
} | ConvertTo-Json -Depth 10 -Compress

# -------------------------------
# Push to Secrets Manager
# -------------------------------
Write-Host "Populating secret..." -ForegroundColor Yellow

aws secretsmanager put-secret-value `
    --secret-id $SecretId `
    --secret-string $secretJson

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Secret bootstrapped successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Run terraform apply"
    Write-Host "2. Rotation Lambda will manage secrets going forward"
} else {
    Write-Host "FAILED to populate secret" -ForegroundColor Red
    exit 1
}
