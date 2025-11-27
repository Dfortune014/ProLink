# Authentication Process Documentation

## Table of Contents
1. [Overview](#overview)
2. [Authentication Flow](#authentication-flow)
3. [Architecture Components](#architecture-components)
4. [Problems Encountered](#problems-encountered)
5. [Solutions Implemented](#solutions-implemented)
6. [Key Learnings](#key-learnings)

---

## Overview

This document describes the complete authentication process for the ProLink application, including OAuth social login, profile completion checks, token management, and the various issues encountered during implementation along with their solutions.

---

## Authentication Flow

### 1. Social Login (OAuth) Flow

```
User clicks "Sign in with Google"
    ↓
Redirect to Cognito OAuth endpoint
    ↓
User authenticates with Google
    ↓
Cognito redirects to /auth/callback with authorization code
    ↓
AuthCallback component exchanges code for tokens
    ↓
Tokens stored in localStorage
    ↓
AuthContext refreshed to update isAuthenticated state
    ↓
Check profile completion status
    ↓
If complete → Redirect to /dashboard
If incomplete → Redirect to /auth/complete-profile
```

### 2. Profile Completion Check Flow

```
User lands on /auth/complete-profile
    ↓
CompleteProfile component checks:
    1. User authentication (access token)
    2. Profile completion from users table (GET /users/me)
    ↓
If profile_complete === true AND username exists:
    → Redirect to /dashboard
Else:
    → Show profile completion form
```

### 3. Dashboard Access Flow

```
User navigates to /dashboard
    ↓
ProtectedRoute checks isAuthenticated
    ↓
If not authenticated → Redirect to /auth
If authenticated:
    ↓
Dashboard checks profile completion
    ↓
If not complete → Redirect to /auth/complete-profile
If complete:
    ↓
Fetch full profile from profiles table
    ↓
Display dashboard with user data
```

---

## Architecture Components

### Frontend Components

#### 1. **AuthContext** (`frontend/src/contexts/AuthContext.tsx`)
- Manages global authentication state
- Provides `isAuthenticated`, `user`, `isLoading` to all components
- Handles token refresh and auth state initialization
- **Key Methods:**
  - `initializeAuth()`: Checks for existing session on app load
  - `refreshAuth()`: Refreshes auth state after OAuth callback
  - `signIn()`, `signOut()`: Handle authentication actions

#### 2. **AuthCallback** (`frontend/src/pages/AuthCallback.tsx`)
- Handles OAuth callback from Cognito
- Exchanges authorization code for tokens
- Checks profile completion status
- Redirects to appropriate page based on profile status

#### 3. **CompleteProfile** (`frontend/src/pages/CompleteProfile.tsx`)
- Displays profile completion form
- Checks if profile is already complete
- Submits profile data to backend
- Redirects to dashboard after completion

#### 4. **Dashboard** (`frontend/src/pages/Dashboard.tsx`)
- Main user dashboard
- Checks profile completion on mount
- Fetches full profile data from profiles table
- Displays user information

#### 5. **ProtectedRoute** (`frontend/src/components/ProtectedRoute.tsx`)
- Route guard component
- Checks `isAuthenticated` state
- Redirects to `/auth` if not authenticated
- Shows loading state while checking auth

### Backend Components

#### 1. **API Gateway** (`terraform/modules/api/main.tf`)
- HTTP API v2 with CORS configuration
- JWT authorizer for protected routes
- Routes:
  - `GET /username/check` (public)
  - `GET /users/me` (protected)
  - `GET /profiles/{username}` (public)
  - `POST /profiles` (protected)

#### 2. **Profiles Lambda** (`terraform/modules/lambda/profiles/main.py`)
- Handles profile-related API endpoints
- Functions:
  - `get_current_user_profile()`: Returns user data from users table
  - `get_public_profile()`: Returns public profile from profiles table
  - `create_or_update_profile()`: Creates/updates profile

#### 3. **DynamoDB Tables**
- **`prolink-users`**: User authentication data
  - `user_id` (primary key)
  - `username`, `email`, `profile_complete`, `date_of_birth`, `fullname`
- **`prolink-profiles`**: Public profile data
  - `username` (primary key)
  - `full_name`, `bio`, `title`, `skills`, `social_links`, etc.

---

## Problems Encountered

### Problem 1: CORS Preflight Request Failure

**Symptom:**
```
Access to XMLHttpRequest at 'https://api.../username/check' from origin 'http://localhost:8080' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check: 
It does not have HTTP ok status.
```

**Root Cause:**
- OPTIONS preflight request for `/username/check` had no integration in API Gateway
- HTTP API v2 requires explicit OPTIONS route with integration
- Lambda wasn't returning proper CORS headers for OPTIONS requests

**Solution:**
1. Added explicit `OPTIONS /username/check` route in API Gateway
2. Lambda handles OPTIONS requests and returns CORS headers
3. Enabled `allow_credentials = true` in API Gateway CORS config
4. Lambda dynamically sets `Access-Control-Allow-Origin` based on request origin

---

### Problem 2: 401 Unauthorized on Profile Submission

**Symptom:**
- Profile submission after social login returned 401 Unauthorized
- CloudWatch logs showed "missing: token not provided"

**Root Cause:**
1. Frontend was sending ID token instead of access token
2. API Gateway JWT authorizer expects access token, not ID token
3. Access token had `aud: undefined`, causing validation issues
4. JWT authorizer was configured incorrectly for Cognito access tokens

**Solution:**
1. Changed frontend to use `accessToken` instead of `idToken` for Authorization header
2. Set JWT authorizer `audience = []` (empty array) because Cognito access tokens don't have `aud` claim
3. Reverted `identity_sources` to `["$request.header.Authorization"]` to let API Gateway handle "Bearer " prefix automatically
4. Fixed `get_user_id_from_event()` to correctly extract claims from HTTP API v2 event structure

---

### Problem 3: Profile Complete Check Not Working

**Symptom:**
- Profile completion check was using Cognito attributes
- Social logins don't have `custom:username` or `custom:date_of_birth` in Cognito
- Check was unreliable and inconsistent

**Root Cause:**
- Profile completion was checked using Cognito custom attributes
- Social logins store profile data in DynamoDB, not Cognito attributes
- Multiple components were checking different sources

**Solution:**
1. Created `GET /users/me` endpoint that queries `prolink-users` table
2. All components now check `profile_complete` from users table (single source of truth)
3. Updated `AuthCallback`, `CompleteProfile`, and `Dashboard` to use API endpoint
4. Consistent profile completion logic across all components

---

### Problem 4: Redirect Loop After OAuth

**Symptom:**
- After OAuth callback, user was redirected to dashboard
- Dashboard immediately redirected back to `/auth`
- Infinite redirect loop

**Root Cause:**
1. `AuthContext` wasn't updated after OAuth callback
2. `ProtectedRoute` checked `isAuthenticated` before state updated
3. `getCurrentUser()` only checked Cognito session, not localStorage tokens
4. React state updates are asynchronous, causing timing issues

**Solution:**
1. Added `refreshAuth()` call after OAuth callback
2. Modified `getCurrentUser()` to fallback to localStorage tokens when Cognito session unavailable
3. Added `getCurrentUserFromStorage()` helper that decodes ID token from localStorage
4. Used `window.location.href` instead of `navigate()` to force full page reload
5. Added delays to allow React state to update before navigation

---

### Problem 5: Dashboard Not Using Profiles Table Data

**Symptom:**
- Dashboard was only using data from users table
- Missing profile information like bio, title, skills, social links

**Root Cause:**
- Dashboard only fetched from `/users/me` endpoint
- Didn't fetch full profile data from profiles table

**Solution:**
1. Dashboard now fetches full profile from `/profiles/{username}` after checking completion
2. Uses profile data from profiles table for display
3. Falls back to users table data if profile doesn't exist yet

---

## Solutions Implemented

### Solution 1: CORS Configuration

**API Gateway CORS Config:**
```terraform
cors_configuration {
  allow_origins = ["http://localhost:8080", "http://localhost:3000"]
  allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  allow_headers = ["content-type", "authorization"]
  allow_credentials = true
  max_age = 300
  expose_headers = []
}
```

**Lambda CORS Headers:**
```python
def get_cors_headers():
    origin = event.get('headers', {}).get('origin', '')
    allowed_origins = ['http://localhost:8080', 'http://localhost:3000']
    
    # If origin is in allowed list, use it; otherwise use first allowed origin
    if origin in allowed_origins:
        allow_origin = origin
    elif any(o in origin for o in ['http://localhost']):
        allow_origin = origin
    else:
        allow_origin = allowed_origins[0] if allowed_origins else '*'
    
    return {
        'Access-Control-Allow-Origin': allow_origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true'
    }
```

---

### Solution 2: Token Management

**Frontend Token Storage:**
```typescript
// Tokens stored in localStorage after OAuth callback
localStorage.setItem("cognito_access_token", accessToken);
localStorage.setItem("cognito_id_token", idToken);
localStorage.setItem("cognito_refresh_token", refreshToken);
```

**Fallback User Retrieval:**
```typescript
// If Cognito session unavailable, decode ID token from localStorage
const getCurrentUserFromStorage = (): User | null => {
  const idToken = localStorage.getItem("cognito_id_token");
  if (!idToken) return null;
  
  const payload = JSON.parse(atob(idToken.split(".")[1]));
  return {
    email: payload.email || payload["cognito:username"],
    username: payload["cognito:username"] || payload.sub
  };
};
```

---

### Solution 3: Profile Completion Check

**Unified Check Endpoint:**
```python
# GET /users/me - Returns profile completion status
def get_current_user_profile(event, cors_headers):
    user_id = get_user_id_from_event(event)
    user = users_table.get_item(Key={'user_id': user_id})
    
    return {
        'user_id': user_item.get('user_id'),
        'username': user_item.get('username'),
        'email': user_item.get('email'),
        'profile_complete': user_item.get('profile_complete', False),
        'date_of_birth': user_item.get('date_of_birth'),
        'fullname': user_item.get('fullname')
    }
```

**Frontend Check:**
```typescript
// All components use same check
const userProfile = await profilesApi.getCurrentUser();
if (userProfile.profile_complete && userProfile.username) {
  // Profile complete
} else {
  // Profile incomplete
}
```

---

### Solution 4: Auth State Management

**Refresh After OAuth:**
```typescript
// AuthCallback.tsx
const { idToken } = await authService.handleOAuthCallback(code);
await refreshAuth(); // Update AuthContext
await new Promise(resolve => setTimeout(resolve, 200)); // Wait for state update

// Check profile and redirect
if (profileComplete) {
  window.location.href = "/dashboard"; // Force full page reload
}
```

**ProtectedRoute Check:**
```typescript
// ProtectedRoute.tsx
const { isAuthenticated, isLoading } = useAuth();

if (isLoading) {
  return <LoadingScreen />;
}

if (!isAuthenticated) {
  return <Navigate to="/auth" replace />;
}

return <>{children}</>;
```

---

### Solution 5: Dashboard Profile Data

**Fetch Full Profile:**
```typescript
// Dashboard.tsx
const userProfileData = await profilesApi.getCurrentUser(); // Check completion
if (userProfileData.profile_complete && userProfileData.username) {
  // Fetch full profile from profiles table
  const fullProfile = await profilesApi.getByUsername(userProfileData.username);
  setUserProfile({
    full_name: fullProfile.displayName || fullProfile.full_name,
    username: fullProfile.username
  });
}
```

---

## Key Learnings

### 1. HTTP API v2 CORS Requirements
- Must have explicit OPTIONS route with integration
- Lambda must return CORS headers even with API-level CORS enabled
- `Access-Control-Allow-Credentials: true` requires specific origin (not `*`)
- CORS changes require explicit API redeployment

### 2. Cognito Token Types
- **ID Token**: Contains user identity info, used for client-side identification
- **Access Token**: Used for API authorization, validated by API Gateway JWT authorizer
- **Refresh Token**: Used to get new access tokens
- Cognito access tokens don't have `aud` claim, so JWT authorizer must use empty audience array

### 3. API Gateway Event Structure
- HTTP API v2: Claims at `event.requestContext.authorizer.claims`
- API Gateway v1: Claims at `event.requestContext.authorizer.jwt.claims`
- Must handle both formats for compatibility

### 4. React State Updates
- State updates are asynchronous
- Navigation can happen before state updates complete
- Use `window.location.href` for critical redirects to force full page reload
- Add delays when necessary to allow state updates

### 5. Single Source of Truth
- Profile completion should be checked from one source (users table)
- Avoid checking Cognito attributes for social logins
- Use API endpoints for consistent data access

### 6. Token Storage Strategy
- Store tokens in localStorage after OAuth
- Implement fallback to read from localStorage when Cognito session unavailable
- Decode ID token to get user info when needed

---

## Best Practices

1. **Always check profile completion from users table**, not Cognito attributes
2. **Use access token for API calls**, not ID token
3. **Refresh auth context after OAuth callback** before navigation
4. **Use window.location.href for critical redirects** to avoid timing issues
5. **Implement fallback mechanisms** for token retrieval
6. **Log extensively during development** to trace authentication flow
7. **Handle both HTTP API v2 and v1 event structures** for compatibility
8. **Return CORS headers from Lambda** even with API-level CORS enabled

---

## Testing Checklist

- [ ] Social login redirects correctly after OAuth
- [ ] Profile completion check works for both new and existing users
- [ ] Dashboard loads with correct user data from profiles table
- [ ] Protected routes redirect unauthenticated users
- [ ] Token refresh works correctly
- [ ] CORS preflight requests succeed
- [ ] Profile submission works after social login
- [ ] No redirect loops occur
- [ ] Auth state persists across page reloads

---

## Future Improvements

1. Implement token refresh mechanism before expiration
2. Add retry logic for failed API calls
3. Implement proper error boundaries for auth failures
4. Add loading states for all auth operations
5. Implement session timeout handling
6. Add analytics for authentication flow
7. Implement remember me functionality
8. Add multi-factor authentication support

---

## Related Files

### Frontend
- `frontend/src/contexts/AuthContext.tsx` - Auth state management
- `frontend/src/services/auth.ts` - Auth service with token management
- `frontend/src/pages/AuthCallback.tsx` - OAuth callback handler
- `frontend/src/pages/CompleteProfile.tsx` - Profile completion form
- `frontend/src/pages/Dashboard.tsx` - User dashboard
- `frontend/src/components/ProtectedRoute.tsx` - Route guard
- `frontend/src/services/api.ts` - API client with auth interceptors

### Backend
- `terraform/modules/api/main.tf` - API Gateway configuration
- `terraform/modules/lambda/profiles/main.py` - Profile Lambda function
- `terraform/modules/lambda/post-confirmation/main.py` - Post-confirmation Lambda

---

## Conclusion

The authentication process involves multiple components working together: OAuth flow, token management, profile completion checks, and route protection. The key to a successful implementation is:

1. **Consistency**: Use single source of truth for profile completion
2. **Reliability**: Implement fallback mechanisms for token retrieval
3. **Timing**: Handle asynchronous state updates properly
4. **CORS**: Configure correctly for credentialed requests
5. **Debugging**: Add comprehensive logging to trace issues

By following these practices and learning from the problems encountered, we've built a robust authentication system that handles social logins, profile completion, and secure API access.

