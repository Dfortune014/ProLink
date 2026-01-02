# GitHub Actions Workflow Troubleshooting Guide

## Current Issue
Workflows are failing after commit `57d9f3b` pushed to `main` branch.

## How to Check Workflow Errors

### Step 1: View Error Logs on GitHub
1. Go to: `https://github.com/Dfortune014/LinkPro/actions`
2. Click on the failed workflow run
3. Click on the failed job (red X)
4. Expand the failed step to see the error message

### Step 2: Common Failure Points

#### Main Build Workflow
**Possible Issues:**
- ❌ Missing `VITE_API_GATEWAY_URL` secret
- ❌ ESLint errors in code
- ❌ Build failures (npm errors, TypeScript errors)
- ❌ Missing dependencies

**Check:**
```bash
# Test locally
cd frontend
npm ci
npm run lint
npm run build
```

#### PR Terraform Workflow
**Possible Issues:**
- ❌ Missing `AWS_TERRAFORM_PLAN_ROLE_ARN` secret
- ❌ Missing `TF_VAR_google_client_secret` or `TF_VAR_linkedin_client_secret`
- ❌ AWS OIDC authentication failure
- ❌ Terraform validation errors
- ❌ Terraform format issues

**Check:**
```bash
# Test locally
cd terraform
terraform fmt -check -recursive
terraform init -backend=false
terraform validate
```

#### DAST Workflow
**Note:** This should NOT run on push to main (it's manual only)
- ❌ Missing `STAGING_URL` secret (if manually triggered)

## Quick Fixes

### Verify Secrets Are Set
1. Go to: `https://github.com/Dfortune014/LinkPro/settings/secrets/actions`
2. Verify these secrets exist:
   - ✅ `AWS_TERRAFORM_PLAN_ROLE_ARN`
   - ✅ `TF_VAR_google_client_secret`
   - ✅ `TF_VAR_linkedin_client_secret`
   - ✅ `VITE_API_GATEWAY_URL`
   - ✅ `STAGING_URL` (optional)

### Get Missing Values

#### Get AWS Terraform Plan Role ARN
```powershell
cd terraform
terraform output -raw module.ci_roles.terraform_plan_role_arn
```

#### Get API Gateway URL
```powershell
cd terraform
terraform output -raw api_gateway_url
```

## Next Steps
1. Check the actual error message in GitHub Actions
2. Fix the specific issue (missing secret, code error, etc.)
3. Re-run the workflow or push a new commit

