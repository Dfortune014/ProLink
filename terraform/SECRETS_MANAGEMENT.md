# Secrets Management for ProLynk

This document describes how to securely manage OAuth secrets for ProLynk.

## Current Status

⚠️ **SECURITY WARNING**: OAuth secrets are currently stored in `terraform.tfvars`, which should NOT be committed to version control.

## Recommended Approach: AWS Secrets Manager

For production deployments, use AWS Secrets Manager to store OAuth secrets securely.

### Step 1: Create Secrets in AWS Secrets Manager

Create a secret in AWS Secrets Manager with the following JSON structure:

```json
{
  "google_client_secret": "YOUR_GOOGLE_CLIENT_SECRET",
  "linkedin_client_secret": "YOUR_LINKEDIN_CLIENT_SECRET"
}
```

**AWS CLI Command**:
```bash
aws secretsmanager create-secret \
  --name prolink/oauth/secrets \
  --description "ProLynk OAuth client secrets" \
  --secret-string '{"google_client_secret":"YOUR_GOOGLE_CLIENT_SECRET","linkedin_client_secret":"YOUR_LINKEDIN_CLIENT_SECRET"}' \
  --region us-east-1
```

### Step 2: Update Terraform to Use Secrets Manager

Add the following to `terraform/main.tf` or create a new file `terraform/secrets.tf`:

```terraform
# Data source to fetch secrets from AWS Secrets Manager
data "aws_secretsmanager_secret_version" "oauth_secrets" {
  secret_id = "prolink/oauth/secrets"
}

locals {
  # Parse the JSON secret
  oauth_secrets = jsondecode(data.aws_secretsmanager_secret_version.oauth_secrets.secret_string)
  
  # Use secrets from Secrets Manager if available, otherwise use variables (for dev)
  google_client_secret = local.oauth_secrets["google_client_secret"] != "" ? local.oauth_secrets["google_client_secret"] : var.google_client_secret
  linkedin_client_secret = local.oauth_secrets["linkedin_client_secret"] != "" ? local.oauth_secrets["linkedin_client_secret"] : var.linkedin_client_secret
}
```

### Step 3: Update Auth Module to Use Local Values

Update `terraform/modules/auth/main.tf` to use `local.google_client_secret` and `local.linkedin_client_secret` instead of `var.google_client_secret` and `var.linkedin_client_secret`.

### Step 4: IAM Permissions

Ensure the Terraform execution role has permissions to read from Secrets Manager:

```terraform
# Add to your Terraform execution role policy
{
  "Effect": "Allow",
  "Action": [
    "secretsmanager:GetSecretValue",
    "secretsmanager:DescribeSecret"
  ],
  "Resource": "arn:aws:secretsmanager:us-east-1:*:secret:prolink/oauth/secrets*"
}
```

## Alternative: Environment Variables (CI/CD)

For CI/CD pipelines, you can use environment variables:

```bash
export TF_VAR_google_client_secret="YOUR_GOOGLE_CLIENT_SECRET"
export TF_VAR_linkedin_client_secret="YOUR_LINKEDIN_CLIENT_SECRET"
```

Then run Terraform:
```bash
terraform apply
```

## Development vs Production

### Development
- Use `terraform.tfvars` (but ensure it's in `.gitignore`)
- Keep secrets local to your machine
- Use localhost URLs for callbacks

### Production
- **MUST** use AWS Secrets Manager
- Do NOT store secrets in `terraform.tfvars`
- Use production URLs for callbacks and CORS

## Security Best Practices

1. ✅ **DO**: Store secrets in AWS Secrets Manager for production
2. ✅ **DO**: Use separate secrets for dev/staging/production
3. ✅ **DO**: Rotate secrets regularly (every 90 days recommended)
4. ✅ **DO**: Use least privilege IAM policies
5. ✅ **DO**: Enable secret versioning in Secrets Manager
6. ❌ **DON'T**: Commit secrets to version control
7. ❌ **DON'T**: Share secrets in plain text (email, Slack, etc.)
8. ❌ **DON'T**: Use the same secrets across environments

## Rotating Compromised Secrets

If secrets are compromised (e.g., committed to Git):

1. **IMMEDIATELY** rotate secrets in Google and LinkedIn OAuth consoles
2. Update the secret in AWS Secrets Manager
3. Run `terraform apply` to update Cognito configuration
4. Remove secrets from Git history using `git filter-branch` or BFG Repo-Cleaner
5. Audit who had access to the compromised secrets

## Git History Cleanup

If secrets were committed to Git history:

### Option 1: Using git filter-branch (deprecated but works)
```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch terraform/terraform.tfvars" \
  --prune-empty --tag-name-filter cat -- --all
```

### Option 2: Using BFG Repo-Cleaner (Recommended)
```bash
# Install BFG
# Download from https://rtyley.github.io/bfg-repo-cleaner/

# Remove sensitive file from history
java -jar bfg.jar --delete-files terraform.tfvars

# Clean up and force push (WARNING: This rewrites history)
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push origin --force --all
```

**⚠️ WARNING**: Rewriting Git history affects all collaborators. Coordinate before doing this.

## Monitoring

- Enable CloudTrail logging for Secrets Manager API calls
- Monitor for unauthorized access to secrets
- Set up alerts for secret access from unusual locations
- Review secret access logs regularly

