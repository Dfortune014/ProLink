# Setup GitHub Actions OIDC Provider for AWS
# Run this script BEFORE running terraform apply for CI roles

param(
    [Parameter(Mandatory = $false)]
    [string]$Region = "us-east-1",

    [Parameter(Mandatory = $false)]
    [switch]$UpdateExisting
)

$ErrorActionPreference = "Stop"

Write-Host "Setting up GitHub Actions OIDC Provider for AWS"
Write-Host ""

# --------------------------------------------------------------------
# GitHub Actions OIDC thumbprints (AWS recommended)
# --------------------------------------------------------------------
$thumbprints = @(
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd"
)

$oidcUrl = "https://token.actions.githubusercontent.com"

# --------------------------------------------------------------------
# Get AWS Account ID
# --------------------------------------------------------------------
Write-Host "Getting AWS account ID..."

$accountId = aws sts get-caller-identity --query Account --output text

if (-not $accountId) {
    Write-Host "Failed to get AWS account ID. Ensure AWS CLI is configured."
    exit 1
}

$providerArn = "arn:aws:iam::${accountId}:oidc-provider/token.actions.githubusercontent.com"

# --------------------------------------------------------------------
# Check if OIDC provider already exists (SAFE for PowerShell)
# --------------------------------------------------------------------
Write-Host "Checking if OIDC provider already exists..."

$providerExists = $false

try {
    aws iam get-open-id-connect-provider `
        --open-id-connect-provider-arn $providerArn `
        *> $null

    if ($LASTEXITCODE -eq 0) {
        $providerExists = $true
    }
}
catch {
    # Expected when provider does not exist
    $providerExists = $false
}

# --------------------------------------------------------------------
# Provider exists
# --------------------------------------------------------------------
if ($providerExists) {
    Write-Host "OIDC provider already exists."

    if ($UpdateExisting) {
        Write-Host "Updating OIDC thumbprints..."

        aws iam update-open-id-connect-provider-thumbprint `
            --open-id-connect-provider-arn $providerArn `
            --thumbprint-list $thumbprints

        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to update thumbprints."
            exit 1
        }

        Write-Host "Thumbprints updated successfully."
    }
    else {
        Write-Host "Provider exists. Use -UpdateExisting to rotate thumbprints."
    }

    Write-Host ""
    Write-Host "OIDC Provider ARN:"
    Write-Host $providerArn
    exit 0
}

# --------------------------------------------------------------------
# Create OIDC provider
# --------------------------------------------------------------------
Write-Host "OIDC provider does not exist. Creating..."

aws iam create-open-id-connect-provider `
    --url $oidcUrl `
    --client-id-list "sts.amazonaws.com" `
    --thumbprint-list $thumbprints `
    --region $Region

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create OIDC provider."
    exit 1
}

Write-Host ""
Write-Host "OIDC provider created successfully."
Write-Host "OIDC Provider ARN:"
Write-Host $providerArn
Write-Host ""

# --------------------------------------------------------------------
# Next steps (Terraform module)
# --------------------------------------------------------------------
Write-Host "Next steps:"
Write-Host ""

$terraformBlock = @'
module "ci_roles" {
  source      = "./modules/ci-roles"
  github_org  = "Dfortune014"
  github_repo = "LinkPro"
}
'@

Write-Host "1. Add the following to terraform/main.tf:"
Write-Host ""
Write-Host $terraformBlock
Write-Host ""
Write-Host "2. Run:"
Write-Host "   terraform init"
Write-Host "   terraform plan"
Write-Host "   terraform apply"
Write-Host ""
Write-Host "OIDC setup complete."
