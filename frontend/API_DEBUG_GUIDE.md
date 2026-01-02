# Frontend API Debugging Guide

## Current Status
✅ `.env.local` file exists (configured)
✅ API Gateway URL should be set: `VITE_API_GATEWAY_URL`
✅ Enhanced logging added to `api.ts`

## Diagnostic Steps

### 1. Check Browser Console
Open your browser DevTools (F12) and look for:

**On page load, you should see:**
```
API Configuration: {
  baseURL: "https://3ru1qftlea.execute-api.us-east-1.amazonaws.com",
  hasBaseURL: true,
  env: "development"
}
```

**If you see:**
```
⚠️ VITE_API_GATEWAY_URL is not set! API calls will fail.
```
→ The environment variable is not being loaded. Restart your dev server.

### 2. Check Network Tab
1. Open DevTools > Network tab
2. Filter by "Fetch/XHR"
3. Look for API calls to `/profiles/...` or `/users/me`
4. Check:
   - **Request URL**: Should include the API Gateway URL
   - **Status Code**: 
     - 200 = Success
     - 401 = Authentication error
     - 404 = Not found
     - 500 = Server error
   - **Response**: Click on the request to see the response body

### 3. Common Issues

#### Issue: API calls return 401 Unauthorized
**Symptoms:**
- Status: 401
- Error: "Unauthorized" or "No user_id found in JWT claims"

**Possible Causes:**
1. User not logged in
2. JWT token expired
3. Token not being sent in Authorization header

**Check:**
- Application tab > Local Storage > Look for `CognitoIdentityServiceProvider.*.accessToken`
- Network tab > Request Headers > Should have `Authorization: Bearer <token>`

**Fix:**
- Log out and log back in
- Check if token refresh is working

#### Issue: API calls return 404 Not Found
**Symptoms:**
- Status: 404
- Error: "Profile not found" or "User not found"

**Possible Causes:**
1. Profile doesn't exist in DynamoDB
2. Username mismatch (case-sensitive)
3. Wrong API endpoint

**Check:**
- Verify username is correct
- Check if profile exists in DynamoDB
- Verify API route: `/profiles/{username}`

#### Issue: API calls return 500 Internal Server Error
**Symptoms:**
- Status: 500
- Error: "Internal server error"

**Possible Causes:**
1. Lambda function error
2. DynamoDB connection issue
3. Missing environment variables in Lambda

**Check:**
- CloudWatch Logs: `/aws/lambda/prolink-profiles`
- Look for error messages in logs

#### Issue: CORS Errors
**Symptoms:**
- Console shows: "CORS policy: No 'Access-Control-Allow-Origin' header"
- Network tab shows OPTIONS request failing

**Possible Causes:**
1. Frontend origin not in `cors_origins`
2. CORS not configured in API Gateway

**Check:**
- `terraform.tfvars` → `cors_origins` should include your frontend URL
- API Gateway CORS configuration

#### Issue: Network Error / Failed to Fetch
**Symptoms:**
- Console shows: "Network Error" or "Failed to fetch"
- Request shows as "failed" in Network tab

**Possible Causes:**
1. API Gateway URL incorrect
2. API Gateway not deployed
3. Network connectivity issue

**Check:**
- Verify `VITE_API_GATEWAY_URL` in `.env.local`
- Test API Gateway URL directly in browser
- Check if API Gateway is deployed

### 4. Test API Directly

Test the API Gateway URL directly:

```bash
# Get your API Gateway URL
API_URL="https://3ru1qftlea.execute-api.us-east-1.amazonaws.com"

# Test public endpoint (no auth needed)
curl "$API_URL/profiles/your-username"

# Test authenticated endpoint (requires token)
TOKEN="your-jwt-token-here"
curl -H "Authorization: Bearer $TOKEN" "$API_URL/users/me"
```

### 5. Check CloudWatch Logs

```bash
# Check profiles Lambda logs
aws logs tail /aws/lambda/prolink-profiles --follow

# Or check via AWS Console:
# CloudWatch > Log Groups > /aws/lambda/prolink-profiles
```

Look for:
- Error messages
- Database query results
- Response status codes

### 6. Verify Data Format

The API should return JSON. Check if the response is being parsed correctly:

**Expected Response Format:**
```json
{
  "username": "john_doe",
  "full_name": "John Doe",
  "title": "Software Engineer",
  "bio": "...",
  "skills": ["JavaScript", "Python"],
  "projects": [...],
  "social_links": {...},
  "avatar_url": "...",
  "resume_url": "..."
}
```

## Quick Fixes

### Fix 1: Restart Dev Server
If you just updated `.env.local`:
```bash
cd frontend
# Stop the dev server (Ctrl+C)
npm run dev
```

### Fix 2: Clear Browser Cache
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Or clear browser cache

### Fix 3: Check Environment Variable
In browser console, run:
```javascript
console.log(import.meta.env.VITE_API_GATEWAY_URL)
```

Should show: `https://3ru1qftlea.execute-api.us-east-1.amazonaws.com`

## Next Steps

1. **Open browser console** and check for the API Configuration log
2. **Check Network tab** for failed API requests
3. **Share the specific error** you're seeing:
   - What status code?
   - What error message?
   - Which API endpoint is failing?
   - What does the response body say?

With this information, I can provide a targeted fix!

