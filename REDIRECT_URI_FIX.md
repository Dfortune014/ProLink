# Fixing Redirect URI Mismatch Error

## Error
```
GET https://prolink-auth.auth.us-east-1.amazoncognito.com/error?error=redirect_mismatch
```

## Root Cause
The redirect URI in the OAuth authorization request doesn't match what's configured in AWS Cognito User Pool.

## Solution Steps

### Step 1: Verify Terraform Configuration
Your `terraform/terraform.tfvars` should have:
```hcl
callback_urls = ["http://localhost:3000/auth/callback", "http://localhost:8080/auth/callback"]
```

### Step 2: Apply Terraform Changes
If you've updated the callback URLs, you MUST apply the changes:

```powershell
cd terraform
terraform plan
terraform apply
```

**Important:** Cognito callback URLs are configured in the User Pool Client. After applying Terraform, the new callback URLs will be active.

### Step 3: Verify Current Cognito Configuration
Check what's actually configured in AWS:

1. Go to AWS Console → Cognito → User Pools
2. Select your user pool (`prolink-user-pool`)
3. Go to "App integration" tab
4. Click on your app client
5. Check "Allowed callback URLs" section
6. Ensure `http://localhost:8080/auth/callback` is listed

### Step 4: Manual Fix (If Terraform Apply Doesn't Work)
If Terraform doesn't update the callback URLs, you can manually add them:

1. AWS Console → Cognito → User Pools → `prolink-user-pool`
2. App integration → App clients → Your client
3. Edit "Hosted UI" settings
4. Add to "Allowed callback URLs":
   ```
   http://localhost:3000/auth/callback
   http://localhost:8080/auth/callback
   ```
5. Save changes

### Step 5: Test the Fix
1. Clear browser cache/cookies
2. Try Google sign-in again
3. Check browser console for the redirect URI being used
4. The redirect URI should be: `http://localhost:8080/auth/callback` (if running on port 8080)

## Debugging

The code now logs the redirect URI being used. Check browser console for:
```
OAuth Redirect URL Generation: {
  provider: "Google",
  currentOrigin: "http://localhost:8080",
  redirectUriRaw: "http://localhost:8080/auth/callback",
  ...
}
```

This must match EXACTLY what's in Cognito (case-sensitive, no trailing slashes).

## Common Issues

1. **Terraform not applied**: Changes in `.tfvars` don't take effect until `terraform apply`
2. **Case sensitivity**: `http://localhost:8080` vs `http://Localhost:8080` - must match exactly
3. **Trailing slashes**: `http://localhost:8080/auth/callback/` vs `http://localhost:8080/auth/callback` - must match exactly
4. **Protocol**: `http://` vs `https://` - must match exactly
5. **Port**: `8080` vs `3000` - must match the port you're actually using

## Quick Check Command

To verify your Terraform state matches your config:
```powershell
cd terraform
terraform show | Select-String -Pattern "callback"
```

