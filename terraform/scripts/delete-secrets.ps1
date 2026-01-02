# Delete OAuth Secrets from AWS Secrets Manager
# WARNING: This will delete the secret and all versions

param(
    [Parameter(Mandatory=$false)]
    [string]$SecretId = "prolink/oauth/secrets",
    
    [Parameter(Mandatory=$false)]
    [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host "⚠️  WARNING: This will delete the secret and ALL versions!" -ForegroundColor Red
Write-Host "Secret ID: $SecretId" -ForegroundColor Yellow
Write-Host ""

if (-not $Force) {
    $confirm = Read-Host "Type 'DELETE' to confirm deletion"
    if ($confirm -ne "DELETE") {
        Write-Host "Deletion cancelled." -ForegroundColor Green
        exit 0
    }
}

Write-Host "Deleting secret..." -ForegroundColor Yellow

try {
    # Check if secret exists
    aws secretsmanager describe-secret --secret-id $SecretId 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Secret does not exist. Nothing to delete." -ForegroundColor Yellow
        exit 0
    }

    # Delete the secret (this removes all versions)
    aws secretsmanager delete-secret `
        --secret-id $SecretId `
        --force-delete-without-recovery

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Secret deleted successfully" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next step: Run bootstrap-secrets.ps1 to create and populate a new secret" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Failed to delete secret" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error deleting secret: $_" -ForegroundColor Red
    exit 1
}