# Complete DevSecOps Setup Script
# This script orchestrates the entire setup process

param(
    [Parameter(Mandatory=$false)]
    [string]$GitHubOrg = "",
    
    [Parameter(Mandatory=$false)]
    [string]$GitHubRepo = "LinkPro",
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "us-east-1",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipOIDC,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipRoles,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipSecrets
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 DevSecOps Pipeline Setup" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Create OIDC Provider
if (-not $SkipOIDC) {
    Write-Host "Step 1: Creating OIDC Provider..." -ForegroundColor Yellow
    Write-Host ""
    & "$PSScriptRoot\setup-oidc.ps1" -Region $Region
    Write-Host ""
} else {
    Write-Host "⏭️  Skipping OIDC provider setup" -ForegroundColor Yellow
    Write-Host ""
}

# Step 2: Get GitHub Org if not provided
if ([string]::IsNullOrEmpty($GitHubOrg) -and -not $SkipRoles) {
    $GitHubOrg = Read-Host "Enter your GitHub organization/username"
}

# Step 3: Create IAM Roles via Terraform
if (-not $SkipRoles) {
    Write-Host "Step 2: Creating IAM Roles with Terraform..." -ForegroundColor Yellow
    Write-Host ""
    
    # Get terraform directory (one level up from scripts directory)
    $terraformDir = Split-Path $PSScriptRoot -Parent
    Push-Location $terraformDir
    
    # Check if module is already in main.tf
    $mainTf = Get-Content "main.tf" -Raw
    if ($mainTf -notmatch "module\s+`"ci_roles`"") {
        Write-Host "Adding CI roles module to main.tf..." -ForegroundColor Yellow
        
        $moduleBlock = @"

# CI/CD IAM Roles for GitHub Actions
module "ci_roles" {
  source = "./modules/ci-roles"
  
  github_org  = "$GitHubOrg"
  github_repo = "$GitHubRepo"
  
  s3_backend_bucket    = "prolink-terraform-state"
  s3_backend_key       = "terraform.tfstate"
  dynamodb_lock_table  = "terraform-state-lock"
}

"@
        Add-Content -Path "main.tf" -Value $moduleBlock
        Write-Host "✅ Module added to main.tf" -ForegroundColor Green
    }
    
    # Initialize and apply
    Write-Host "Running terraform init..." -ForegroundColor Cyan
    terraform init
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Running terraform plan..." -ForegroundColor Cyan
        terraform plan -target module.ci_roles
        
        $confirm = Read-Host "Apply these changes? (yes/no)"
        if ($confirm -eq "yes") {
            terraform apply -target module.ci_roles -auto-approve
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ IAM roles created successfully" -ForegroundColor Green
                
                # Get role ARNs from outputs (module outputs need module prefix)
                Write-Host "Retrieving role ARNs..." -ForegroundColor Cyan
                $ErrorActionPreference = "SilentlyContinue"
                
                $planArn = terraform output -raw module.ci_roles.terraform_plan_role_arn 2>$null
                $applyArn = terraform output -raw module.ci_roles.terraform_apply_role_arn 2>$null
                $scanArn = terraform output -raw module.ci_roles.security_scan_role_arn 2>$null
                
                $ErrorActionPreference = "Stop"
                
                if ($planArn) {
                    Write-Host "  Terraform Plan Role ARN: $planArn" -ForegroundColor Green
                }
                if ($applyArn) {
                    Write-Host "  Terraform Apply Role ARN: $applyArn" -ForegroundColor Green
                }
                if ($scanArn) {
                    Write-Host "  Security Scan Role ARN: $scanArn" -ForegroundColor Green
                }
            }
        }
    }
    
    Pop-Location
    Write-Host ""
} else {
    Write-Host "⏭️  Skipping IAM roles creation" -ForegroundColor Yellow
    Write-Host ""
}

# Step 4: Setup GitHub Secrets
if (-not $SkipSecrets) {
    Write-Host "Step 3: Setting up GitHub Secrets..." -ForegroundColor Yellow
    Write-Host ""
    
    $secretsScript = "$PSScriptRoot\setup-github-secrets.ps1"
    & $secretsScript -Interactive
    
    Write-Host ""
} else {
    Write-Host "⏭️  Skipping GitHub secrets setup" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "✅ DevSecOps setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Verify GitHub secrets are set correctly" -ForegroundColor White
Write-Host "2. Push your code to trigger the pipeline" -ForegroundColor White
Write-Host "3. Monitor the Actions tab for pipeline runs" -ForegroundColor White
Write-Host ""