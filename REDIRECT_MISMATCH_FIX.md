# Redirect Mismatch Error - Fixed

## Problem
Getting `redirect_mismatch` error when trying to login with Google OAuth.

## Root Cause
The redirect URI used in the **token exchange** didn't match the redirect URI used in the **authorization request**. Cognito requires these to match exactly.

## Solution Applied

### Before (The Problem)
- Authorization request: Used `window.location.origin + "/auth/callback"` (auto-detected)
- Token exchange: Used `import.meta.env.VITE_REDIRECT_URI` (from env variable)
- **Result**: Mismatch if env variable had different port or format

### After (The Fix)
- Authorization request: Uses `window.location.origin + "/auth/callback"` (auto-detected)
- Token exchange: **Now also uses** `window.location.origin + "/auth/callback"` (same logic)
- **Result**: Both use identical redirect URI, ensuring perfect match

## Code Changes

### `getOAuthRedirectUrl()` - Authorization Request
```typescript
const currentOrigin = window.location.origin;
const redirectUri = encodeURIComponent(`${currentOrigin}/auth/callback`.replace(/\/+$/, ''));
```

### `handleOAuthCallback()` - Token Exchange (FIXED)
```typescript
// Now uses same logic as authorization request
const currentOrigin = window.location.origin;
const redirectUri = `${currentOrigin}/auth/callback`.replace(/\/+$/, '');
// URLSearchParams will encode it automatically
```

## Verification

1. **Cognito Configuration** ✅
   - Verified via AWS CLI: Both callback URLs are configured:
     - `http://localhost:3000/auth/callback`
     - `http://localhost:8080/auth/callback`

2. **Code Consistency** ✅
   - Both authorization and token exchange now use identical redirect URI logic

## Testing

1. Clear browser cache/cookies
2. Try Google sign-in again
3. Check browser console for:
   ```
   OAuth Redirect URL Generation: {
     redirectUriRaw: "http://localhost:8080/auth/callback"
   }
   OAuth Token Exchange - Redirect URI: {
     redirectUri: "http://localhost:8080/auth/callback"
   }
   ```
4. Both should show the same redirect URI
5. The `redirect_mismatch` error should be resolved

## Why This Works

Cognito's OAuth flow requires:
1. Authorization request sends: `redirect_uri=http://localhost:8080/auth/callback`
2. Token exchange sends: `redirect_uri=http://localhost:8080/auth/callback` (must match exactly)
3. Both must also be in Cognito's allowed callback URLs (which they are)

By using the same auto-detection logic in both places, we guarantee they match exactly, regardless of which port the app is running on.

