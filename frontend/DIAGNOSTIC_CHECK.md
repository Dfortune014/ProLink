# Frontend Database Retrieval Diagnostic Guide

## Issue: Frontend cannot retrieve information from database

## Quick Checks

### 1. Check if API Gateway URL is configured

Open browser console and look for:
```
API Configuration: { baseURL: "...", hasBaseURL: true/false }
```

If `hasBaseURL: false`, you need to set `VITE_API_GATEWAY_URL`.

### 2. Get API Gateway URL

Run this command in the terraform directory:
```bash
cd terraform
terraform output api_gateway_url
```

### 3. Create .env file

Create `frontend/.env` file with:
```env
VITE_API_GATEWAY_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com
VITE_S3_BUCKET_NAME=your-bucket-name
```

### 4. Restart Dev Server

After creating/updating `.env` file:
```bash
cd frontend
npm run dev
```

## Common Issues

### Issue 1: VITE_API_GATEWAY_URL not set
**Symptoms:**
- Console shows: `⚠️ VITE_API_GATEWAY_URL is not set!`
- API calls fail with network errors
- baseURL is `undefined`

**Fix:**
1. Get API Gateway URL: `terraform output api_gateway_url`
2. Create `frontend/.env` with the URL
3. Restart dev server

### Issue 2: CORS Errors
**Symptoms:**
- Browser console shows CORS errors
- Network tab shows preflight (OPTIONS) requests failing

**Fix:**
1. Check `terraform.tfvars` - ensure your frontend URL is in `cors_origins`
2. Verify API Gateway CORS configuration
3. Check CloudWatch logs for Lambda CORS issues

### Issue 3: 401 Unauthorized
**Symptoms:**
- API calls return 401
- User appears logged in but API rejects requests

**Fix:**
1. Check if JWT token is being sent (check Network tab headers)
2. Verify token is valid (not expired)
3. Check API Gateway authorizer configuration
4. Check CloudWatch logs for authentication errors

### Issue 4: 404 Not Found
**Symptoms:**
- Profile not found errors
- User exists but profile doesn't

**Fix:**
1. Verify profile exists in DynamoDB
2. Check username matches exactly (case-sensitive)
3. Verify API route is correct: `/profiles/{username}`

### Issue 5: 500 Internal Server Error
**Symptoms:**
- API returns 500 errors
- Generic error messages

**Fix:**
1. Check CloudWatch logs for Lambda errors
2. Verify DynamoDB tables exist
3. Check IAM permissions for Lambda
4. Verify environment variables in Lambda

## Diagnostic Steps

### Step 1: Check Browser Console
Open browser DevTools (F12) and check:
- Console tab for errors
- Network tab for failed requests
- Application tab > Local Storage for tokens

### Step 2: Check Network Requests
In Network tab:
1. Find the failed API request
2. Check Request URL (should include API Gateway URL)
3. Check Request Headers (should include Authorization)
4. Check Response (status code and error message)

### Step 3: Check CloudWatch Logs
```bash
# Check profiles Lambda logs
aws logs tail /aws/lambda/prolink-profiles --follow

# Or check via AWS Console
# CloudWatch > Log Groups > /aws/lambda/prolink-profiles
```

### Step 4: Test API Directly
```bash
# Get API Gateway URL
API_URL=$(terraform output -raw api_gateway_url)

# Test public endpoint
curl "$API_URL/profiles/your-username"

# Test authenticated endpoint (requires token)
TOKEN="your-jwt-token"
curl -H "Authorization: Bearer $TOKEN" "$API_URL/users/me"
```

## Next Steps

After running diagnostics, check:
1. ✅ Is VITE_API_GATEWAY_URL set?
2. ✅ Are API calls reaching the server? (check Network tab)
3. ✅ What status code is returned?
4. ✅ What error message is in the response?
5. ✅ Are there any CloudWatch log errors?

Share the results and we can fix the specific issue!

