# OAuth Callback Debugging Guide

## Issue: Google Sign-In Callback Error

When trying to login with Google, you're getting an error at:
`http://localhost:8080/auth/callback?code=...`

## Common Causes

### 1. Redirect URI Mismatch (Most Common)

**Problem:** The `VITE_REDIRECT_URI` environment variable doesn't match:
- The port you're actually using (8080 vs 3000)
- What's configured in AWS Cognito

**Solution:**
1. Check your `.env.local` file in the `frontend` directory
2. Ensure `VITE_REDIRECT_URI` matches your actual port:
   ```
   VITE_REDIRECT_URI=http://localhost:8080/auth/callback
   ```
3. Verify this URL is in your Cognito callback URLs (check Terraform `terraform.tfvars`)

### 2. Invalid Authorization Code

**Problem:** The authorization code has expired or was already used.

**Solution:** Try logging in again - authorization codes are single-use and expire quickly.

### 3. CORS Issues

**Problem:** Browser blocking the token exchange request.

**Solution:** Check browser console for CORS errors. Ensure your Cognito domain allows your origin.

## How to Debug

### Step 1: Check Environment Variables

Open browser console and look for:
```
AuthCallback: Environment check: {
  hasClientId: true/false,
  hasRedirectUri: true/false,
  hasDomain: true/false,
  redirectUri: "...",
  domain: "..."
}
```

### Step 2: Check Token Exchange Request

Look for:
```
OAuth Token Exchange Request: {
  endpoint: "...",
  clientId: "...",
  redirectUri: "...",
  codeLength: ...,
  hasCode: true/false
}
```

### Step 3: Check Token Exchange Response

Look for:
```
OAuth Token Exchange Response: {
  status: ...,
  statusText: "...",
  ok: true/false
}
```

If `status` is not 200, check the error message.

## Quick Fixes

### Fix 1: Update Redirect URI

1. Edit `frontend/.env.local`:
   ```env
   VITE_REDIRECT_URI=http://localhost:8080/auth/callback
   ```

2. Restart your frontend dev server

3. Try logging in again

### Fix 2: Verify Cognito Configuration

1. Check `terraform/terraform.tfvars`:
   ```hcl
   callback_urls = ["http://localhost:3000/auth/callback", "http://localhost:8080/auth/callback"]
   ```

2. If port 8080 is missing, add it and run:
   ```bash
   terraform apply
   ```

### Fix 3: Check Google OAuth Configuration

1. Verify Google Client ID and Secret in `terraform.tfvars`
2. In Google Cloud Console, ensure the authorized redirect URI includes:
   ```
   https://<your-cognito-domain>/oauth2/idpresponse
   ```

## Error Messages Reference

| Error Message | Meaning | Solution |
|--------------|---------|----------|
| `redirect_uri_mismatch` | Redirect URI doesn't match | Update `VITE_REDIRECT_URI` to match your port |
| `invalid_grant` | Code expired or invalid | Try logging in again |
| `invalid_code` | Code already used | Try logging in again |
| `Missing OAuth configuration` | Environment variables not set | Check `.env.local` file |
| `CORS error` | Cross-origin request blocked | Check Cognito CORS settings |

## Next Steps

1. Open browser DevTools (F12)
2. Go to Console tab
3. Try logging in with Google
4. Look for error messages starting with "AuthCallback:" or "OAuth"
5. Share the error details for further debugging

