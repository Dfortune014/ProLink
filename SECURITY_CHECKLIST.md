# ProLynk Security Checklist for Production Deployment

This document provides a comprehensive security checklist for deploying ProLynk to production. Each item should be verified before deployment and regularly reviewed post-deployment.

**Last Updated**: 2025  
**Deployment Environment**: Production  
**Review Frequency**: Quarterly

---

## Table of Contents

1. [Pre-Deployment Security Checks](#pre-deployment-security-checks)
2. [Infrastructure Security](#infrastructure-security)
3. [Application Security](#application-security)
4. [Data Security](#data-security)
5. [Network Security](#network-security)
6. [Secrets Management](#secrets-management)
7. [Monitoring and Alerting](#monitoring-and-alerting)
8. [Cognito Security](#cognito-security)
9. [Post-Deployment Verification](#post-deployment-verification)
10. [Compliance and Audit](#compliance-and-audit)
11. [Security Recommendations](#security-recommendations)

---

## Pre-Deployment Security Checks

### Configuration and Variables

- [ ] **CRITICAL**: Verify all Terraform variables are set correctly (no defaults in production)
  - **Location**: `terraform/terraform.tfvars`
  - **Check**: No default values from `variables.tf` are used in production
  - **Verification**: `terraform plan` should show all variables explicitly set

- [ ] **CRITICAL**: Confirm OAuth client secrets are stored securely
  - **Location**: `terraform/variables.tf` (marked as `sensitive = true`)
  - **Options**: 
    - AWS Secrets Manager (recommended)
    - Secure environment variables
    - Terraform Cloud/Enterprise variable store
  - **Verification**: Secrets should NOT appear in Terraform state or logs

- [ ] **HIGH**: Validate CORS origins list (remove localhost for production)
  - **Location**: `terraform/modules/api/main.tf` (line ~565)
  - **Check**: `cors_origins` should only include production domains
  - **Current**: `["http://localhost:3000", "http://localhost:8080"]` - MUST be updated
  - **Verification**: `terraform plan` shows production domains only

- [ ] **HIGH**: Review callback URLs (must match production domain)
  - **Location**: `terraform/variables.tf` and `terraform.tfvars`
  - **Check**: `callback_urls` must match actual production frontend URL
  - **Format**: `https://yourdomain.com/auth/callback`
  - **Verification**: Test OAuth flow in staging environment first

- [ ] **MEDIUM**: Verify environment variable is set to "production"
  - **Location**: `terraform/variables.tf` (line ~62)
  - **Check**: `environment = "production"` in `terraform.tfvars`
  - **Impact**: Affects resource naming and tagging

- [ ] **HIGH**: Check that sensitive Terraform variables are marked as `sensitive = true`
  - **Location**: `terraform/variables.tfvars`
  - **Variables to check**:
    - `google_client_secret` (line ~45)
    - `linkedin_client_secret` (line ~58)
  - **Verification**: `terraform plan` should not display these values

### Code Security

- [ ] **CRITICAL**: Confirm no hardcoded credentials in code
  - **Locations to check**:
    - `terraform/modules/lambda/**/*.py`
    - `frontend/src/**/*.ts`
    - `frontend/src/**/*.tsx`
  - **Search for**: API keys, passwords, tokens, secrets
  - **Tool**: Use `grep -r "password\|secret\|key\|token"` (excluding node_modules)

- [ ] **HIGH**: Review Lambda function code for security vulnerabilities
  - **Files to review**:
    - `terraform/modules/lambda/profiles/main.py`
    - `terraform/modules/lambda/upload/main.py`
    - `terraform/modules/lambda/links/main.py`
  - **Check for**:
    - SQL injection (N/A for DynamoDB, but check query construction)
    - Path traversal (check file upload paths)
    - XSS (check input sanitization)
    - Authorization bypass (verify user_id checks)

- [ ] **MEDIUM**: Verify all dependencies are up to date (no known CVEs)
  - **Frontend**: `frontend/package.json` - run `npm audit`
  - **Backend**: Python dependencies in Lambda (boto3, etc.)
  - **Tool**: 
    - `npm audit` for frontend
    - `pip list --outdated` for Python
    - Check AWS Lambda runtime updates

---

## Infrastructure Security

### IAM Roles and Policies

- [ ] **CRITICAL**: Verify IAM roles follow principle of least privilege
  - **Location**: `terraform/modules/api/main.tf` (lines 193-415)
  
  - [ ] **Profiles Lambda Role** (lines 194-244)
    - **Allowed**: DynamoDB GetItem, PutItem, UpdateItem, Query, Scan on profiles and users tables only
    - **NOT Allowed**: DeleteItem, access to other tables, S3 access
    - **Verification**: Review `aws_iam_role_policy.profiles_lambda` policy JSON

  - [ ] **Links Lambda Role** (lines 247-293)
    - **Allowed**: DynamoDB GetItem, PutItem, UpdateItem, DeleteItem, Query on links table only
    - **NOT Allowed**: Access to profiles or users tables
    - **Verification**: Review `aws_iam_role_policy.links_lambda` policy JSON

  - [ ] **Upload Lambda Role** (lines 296-350)
    - **Allowed**: S3 PutObject, GetObject on `users/*` prefix only
    - **Allowed**: S3 ListBucket with `users/*` prefix condition
    - **NOT Allowed**: DeleteObject, access to other prefixes
    - **Verification**: Review `aws_iam_role_policy.upload_lambda` policy JSON

  - [ ] **Post-Confirmation Lambda Role** (lines 353-415)
    - **Allowed**: DynamoDB PutItem, GetItem, UpdateItem, Query on users and profiles tables
    - **Allowed**: Cognito ListUsers (for account linking)
    - **NOT Allowed**: S3 access, other DynamoDB tables
    - **Verification**: Review `aws_iam_role_policy.post_confirmation_lambda` policy JSON

### API Gateway Security

- [ ] **CRITICAL**: Confirm API Gateway JWT authorizer is configured correctly
  - **Location**: `terraform/modules/api/main.tf` (lines 574-593)
  - **Check**:
    - Issuer matches Cognito User Pool: `https://cognito-idp.{region}.amazonaws.com/{pool-id}`
    - Identity source: `$request.header.Authorization`
    - Audience validation skipped (correct for Cognito access tokens)
  - **Verification**: Test with invalid token - should return 401

- [ ] **HIGH**: Verify API Gateway rate limiting is appropriate for production
  - **Location**: `terraform/modules/api/main.tf` (lines 787-792)
  - **Current**: Burst 100, Rate 50 req/sec
  - **Check**: Adjust based on expected traffic
  - **Verification**: Test rate limiting with load testing

- [ ] **HIGH**: Verify protected routes require JWT authorization
  - **Location**: `terraform/modules/api/main.tf` (routes section)
  - **Protected routes** (should have `authorizer_id`):
    - `POST /profiles` (line 610)
    - `GET /users/me` (line 618)
    - `POST /links` (line 644)
    - `DELETE /links/{id}` (line 652)
    - `POST /upload-url` (line 671)
  - **Public routes** (should NOT have `authorizer_id`):
    - `GET /profiles/{username}` (line 625)
    - `GET /username/check` (line 801)
  - **Verification**: Test each route with/without token

### S3 Bucket Security

- [ ] **CRITICAL**: Check S3 bucket policies restrict public access appropriately
  - **Location**: `terraform/modules/api/main.tf` (lines 128-174)
  - **Public Read Allowed**:
    - `users/*/profile/*` - Profile images
    - `users/*/projects/*` - Project images
    - `users/*/resume/*` - Resume files
  - **Public Write**: DENIED (only presigned URLs)
  - **Verification**: Test public URL access, verify upload requires presigned URL

- [ ] **CRITICAL**: Confirm S3 bucket denies insecure (HTTP) uploads
  - **Location**: `terraform/modules/api/main.tf` (lines 160-171)
  - **Policy**: Deny PutObject if `aws:SecureTransport = false`
  - **Verification**: Attempt HTTP upload - should fail

- [ ] **MEDIUM**: Verify S3 bucket versioning is enabled
  - **Location**: `terraform/modules/api/main.tf` (lines 99-104)
  - **Check**: `aws_s3_bucket_versioning.assets` status = "Enabled"
  - **Purpose**: Data recovery and audit trail

- [ ] **MEDIUM**: Check S3 bucket CORS configuration
  - **Location**: `terraform/modules/api/main.tf` (lines 176-187)
  - **Allowed Origins**: Should match API Gateway CORS origins
  - **Allowed Methods**: GET, PUT, POST, HEAD
  - **Verification**: Test CORS preflight from frontend

### DynamoDB Security

- [ ] **CRITICAL**: Verify DynamoDB tables are not publicly accessible
  - **Location**: `terraform/modules/api/main.tf` (tables section)
  - **Check**: No public access policies on tables
  - **Access**: Only via Lambda functions with IAM roles
  - **Verification**: Attempt direct DynamoDB access - should fail

- [ ] **HIGH**: Confirm DynamoDB encryption at rest is enabled
  - **Default**: AWS managed encryption (enabled by default)
  - **Verification**: Check table encryption settings in AWS Console
  - **Note**: Can be explicitly set in Terraform if needed

### CloudTrail and Logging

- [ ] **CRITICAL**: Check CloudTrail is enabled and logging to secure S3 bucket
  - **Location**: `terraform/modules/audit/main.tf` (lines 40-57)
  - **Check**:
    - `enable_logging = true`
    - `is_multi_region_trail = true`
    - `enable_log_file_validation = true`
    - S3 bucket has encryption enabled (line 21-29)
  - **Verification**: Check CloudTrail in AWS Console, verify logs are being written

- [ ] **MEDIUM**: Verify CloudWatch Log Groups have appropriate retention periods
  - **Location**: `terraform/modules/api/main.tf` (various log groups)
  - **Current**: 7 days for Lambda logs, 30 days for audit logs
  - **Check**: Adjust based on compliance requirements
  - **Verification**: Check log group retention settings

- [ ] **MEDIUM**: Confirm Lambda functions have appropriate timeout values
  - **Location**: `terraform/modules/api/main.tf` (Lambda function resources)
  - **Current**: 30 seconds for most, 10 seconds for pre-signup
  - **Check**: Balance between security (shorter) and functionality
  - **Verification**: Review timeout values in Terraform config

### Network Configuration

- [ ] **MEDIUM**: Check VPC configuration (if applicable) for network isolation
  - **Location**: `terraform/modules/networking/main.tf`
  - **Current**: VPC module exists but may not be used
  - **Check**: If VPC is used, verify:
    - Private subnets for Lambda (if VPC-enabled)
    - Security groups restrict traffic
    - NAT Gateway for outbound internet access
  - **Verification**: Review VPC configuration if Lambda functions are VPC-enabled

---

## Application Security

### CORS Configuration

- [ ] **HIGH**: Verify CORS configuration allows only production domains
  - **Location**: `terraform/modules/api/main.tf` (lines 564-571)
  - **Check**: `allow_origins` should NOT include localhost in production
  - **Check**: `allow_credentials = true` (required for Authorization header)
  - **Check**: `allow_headers` includes "authorization"
  - **Verification**: Test CORS from production frontend, verify preflight works

### JWT Token Validation

- [ ] **CRITICAL**: Confirm JWT token validation is working correctly
  - **Location**: API Gateway JWT Authorizer (lines 574-593)
  - **Check**: 
    - Token signature validated
    - Issuer matches Cognito User Pool
    - Token not expired
  - **Verification**: Test with expired token, invalid token, valid token

- [ ] **CRITICAL**: Check that user_id is extracted correctly from JWT claims
  - **Location**: `terraform/modules/lambda/profiles/main.py` (lines 60-91)
  - **Function**: `get_user_id_from_event()`
  - **Check**: Handles both HTTP API v2 and v1 formats
  - **Check**: Extracts `sub` claim correctly
  - **Verification**: Test Lambda with valid JWT, verify user_id in logs

### Authorization Checks

- [ ] **CRITICAL**: Verify authorization checks prevent users from accessing other users' data
  - **Location**: `terraform/modules/lambda/profiles/main.py`
  - **Check Points**:
    - `create_or_update_profile()`: Verifies username ownership (line 243-249)
    - `get_current_user_profile()`: Uses user_id from JWT (line 512)
    - Profile updates: Only user can update their own profile
  - **Verification**: Attempt to access/modify another user's profile - should fail

- [ ] **HIGH**: Confirm username uniqueness validation is working
  - **Location**: `terraform/modules/lambda/profiles/main.py` (lines 241-249)
  - **Check**: Username check verifies user_id matches if username exists
  - **Check**: Pre-signup Lambda validates username availability
  - **Verification**: Test username conflict scenarios

### Input Validation

- [ ] **HIGH**: Check input validation on all API endpoints
  - **Locations**: All Lambda functions
  - **Check**:
    - Required fields validated (username, etc.)
    - Data types validated (strings, arrays, etc.)
    - Length limits enforced
    - Special characters sanitized
  - **Verification**: Test with invalid inputs, verify proper error responses

- [ ] **HIGH**: Verify file type validation for uploads (MIME type checking)
  - **Location**: `terraform/modules/lambda/upload/main.py` (lines 13-15, 186-222)
  - **Allowed Images**: `image/png`, `image/jpeg`, `image/jpg`, `image/webp`
  - **Allowed Resumes**: `application/pdf`
  - **Check**: Content-Type validated before presigned URL generation
  - **Verification**: Test with invalid file types - should reject

### File Upload Security

- [ ] **HIGH**: Confirm presigned URLs expire after 5 minutes
  - **Location**: `terraform/modules/lambda/upload/main.py` (line 243)
  - **Current**: `ExpiresIn=300` (5 minutes)
  - **Check**: Balance between security and usability
  - **Verification**: Generate URL, wait 6 minutes, attempt upload - should fail

- [ ] **HIGH**: Check that Content-Type is included in S3 presigned URL signature
  - **Location**: `terraform/modules/lambda/upload/main.py` (lines 236-245)
  - **Check**: `ContentType` parameter included in `Params` dict
  - **Purpose**: Prevents content type spoofing
  - **Verification**: Test upload with mismatched Content-Type - should fail

### Error Handling

- [ ] **MEDIUM**: Verify error messages don't leak sensitive information
  - **Locations**: All Lambda functions
  - **Check**:
    - No stack traces in production responses
    - No database errors exposed to users
    - No file paths or internal structure revealed
    - Generic error messages for users, detailed logs for debugging
  - **Verification**: Test error scenarios, verify user-friendly messages

---

## Data Security

### Encryption

- [ ] **CRITICAL**: Confirm DynamoDB encryption at rest is enabled (AWS managed)
  - **Default**: Enabled by default for all DynamoDB tables
  - **Verification**: Check table encryption settings in AWS Console
  - **Note**: Can be explicitly configured in Terraform if needed

- [ ] **MEDIUM**: Verify S3 bucket versioning is enabled
  - **Location**: `terraform/modules/api/main.tf` (lines 99-104)
  - **Status**: Enabled
  - **Purpose**: Data recovery and audit trail
  - **Verification**: Check bucket versioning in AWS Console

### Access Controls

- [ ] **CRITICAL**: Check that sensitive data (email, phone) respects visibility flags
  - **Location**: `terraform/modules/lambda/profiles/main.py` (lines 652-664)
  - **Check**:
    - Owner always sees their own contact info
    - Public view only shows if `show_email` or `show_phone` is true
  - **Verification**: Test public profile with visibility flags off - should not show email/phone

- [ ] **HIGH**: Confirm resume files are only accessible when show_resume is true
  - **Location**: `terraform/modules/lambda/profiles/main.py` (lines 666-667)
  - **Check**: Resume URL only included if `show_resume` is true
  - **Note**: S3 URLs are public, but not exposed in API response if flag is false
  - **Verification**: Test public profile with `show_resume=false` - resume_url should not be in response

- [ ] **CRITICAL**: Verify user data isolation (users can only access their own data)
  - **Location**: All Lambda functions
  - **Check**:
    - Profile updates: Username ownership verified
    - Links: Filtered by user_id
    - Uploads: Stored in user-specific S3 paths
  - **Verification**: Attempt cross-user data access - should fail

- [ ] **MEDIUM**: Check that soft-deleted links are not returned in queries
  - **Location**: `terraform/modules/lambda/links/main.py`
  - **Check**: Links with `is_deleted=true` should be filtered out
  - **Note**: Currently soft-delete only, verify filtering logic
  - **Verification**: Create and soft-delete link, verify it's not returned

### Data Sanitization

- [ ] **MEDIUM**: Confirm profile data is properly sanitized before storage
  - **Location**: `terraform/modules/lambda/profiles/main.py`
  - **Check**:
    - HTML/script tags stripped from text fields
    - URL validation for links
    - Array validation for skills/projects
  - **Verification**: Test with malicious input, verify sanitization

- [ ] **HIGH**: Verify no PII is logged in CloudWatch Logs
  - **Locations**: All Lambda functions
  - **Check**: 
    - Email addresses not logged
    - Phone numbers not logged
    - Passwords never logged (not applicable - Cognito handles)
    - User IDs and usernames OK to log
  - **Verification**: Review CloudWatch Logs, search for PII

---

## Network Security

### HTTPS Enforcement

- [ ] **CRITICAL**: Confirm API Gateway only accepts HTTPS traffic
  - **Default**: API Gateway HTTP API v2 uses HTTPS by default
  - **Verification**: Attempt HTTP request - should redirect or fail
  - **Note**: API Gateway doesn't support HTTP, only HTTPS

- [ ] **CRITICAL**: Verify S3 bucket policy enforces HTTPS for uploads
  - **Location**: `terraform/modules/api/main.tf` (lines 160-171)
  - **Policy**: Denies PutObject if `aws:SecureTransport = false`
  - **Verification**: Attempt HTTP upload - should be denied

### CORS and Preflight

- [ ] **HIGH**: Check that CORS preflight requests are handled correctly
  - **Location**: `terraform/modules/lambda/profiles/main.py` (lines 135-152)
  - **Check**: OPTIONS requests return proper CORS headers
  - **Check**: All Lambda functions handle OPTIONS
  - **Verification**: Test CORS preflight from frontend

### Logging

- [ ] **HIGH**: Verify API Gateway access logging is enabled
  - **Location**: `terraform/modules/api/main.tf` (lines 767-785)
  - **Check**: Access log settings configured with detailed format
  - **Check**: Logs written to CloudWatch Log Group
  - **Verification**: Check CloudWatch Logs for API Gateway access logs

- [ ] **CRITICAL**: Confirm CloudTrail logs all API calls
  - **Location**: `terraform/modules/audit/main.tf` (lines 40-57)
  - **Check**: 
    - `enable_logging = true`
    - `include_management_events = true`
    - `read_write_type = "All"`
  - **Verification**: Check CloudTrail logs in S3, verify API calls are logged

### Network Isolation

- [ ] **MEDIUM**: Check network ACLs if VPC is used
  - **Location**: `terraform/modules/networking/main.tf`
  - **Check**: If Lambda functions are VPC-enabled:
    - Security groups restrict inbound/outbound traffic
    - Network ACLs provide additional layer
    - Private subnets for Lambda functions
  - **Verification**: Review VPC configuration if applicable

---

## Secrets Management

### OAuth Secrets

- [ ] **CRITICAL**: Verify OAuth client secrets are not in code or Terraform state
  - **Location**: `terraform/variables.tf` (lines 42-46, 55-59)
  - **Check**: Secrets marked as `sensitive = true`
  - **Check**: Not committed to version control
  - **Verification**: Search codebase for secret values

- [ ] **CRITICAL**: Confirm secrets are stored in AWS Secrets Manager or secure environment variables
  - **Options**:
    - AWS Secrets Manager (recommended for production)
    - Terraform Cloud/Enterprise variable store
    - Secure CI/CD environment variables
  - **Verification**: Check secret storage method, verify access controls

### Terraform State

- [ ] **HIGH**: Check that Terraform state file is stored securely (S3 backend with encryption)
  - **Location**: `terraform/backend.tf` (if configured)
  - **Check**:
    - State stored in S3 bucket (not local)
    - S3 bucket has encryption enabled
    - State file access restricted via IAM
    - State locking enabled (DynamoDB table)
  - **Verification**: Review backend configuration

### Log Security

- [ ] **HIGH**: Verify no secrets are exposed in CloudWatch Logs
  - **Locations**: All Lambda functions
  - **Check**: 
    - No OAuth secrets logged
    - No API keys logged
    - No tokens logged (except for debugging, then remove)
  - **Verification**: Review CloudWatch Logs, search for sensitive data

### Secret Rotation

- [ ] **MEDIUM**: Confirm API keys and tokens are rotated regularly
  - **Items to rotate**:
    - OAuth client secrets (Google, LinkedIn)
    - Cognito User Pool secrets (if using)
    - Any API keys for external services
  - **Schedule**: Document rotation schedule
  - **Verification**: Check last rotation date, verify process

---

## Monitoring and Alerting

### CloudWatch Alarms

- [ ] **HIGH**: Verify CloudWatch alarms are configured for:
  - **Location**: Create alarms in Terraform or AWS Console
  
  - [ ] Lambda function errors
    - **Metric**: Lambda Errors
    - **Threshold**: > 0 errors in 5 minutes
    - **Action**: SNS notification to security team
  
  - [ ] API Gateway 4xx/5xx errors
    - **Metric**: 4XXError, 5XXError
    - **Threshold**: > 10 errors in 5 minutes
    - **Action**: SNS notification
  
  - [ ] Unusual API call patterns
    - **Metric**: Count of requests
    - **Threshold**: > 2x normal baseline
    - **Action**: Investigate potential attack
  
  - [ ] DynamoDB throttling
    - **Metric**: UserErrors (throttles)
    - **Threshold**: > 0 throttles in 5 minutes
    - **Action**: Scale or investigate

### CloudTrail Validation

- [ ] **HIGH**: Confirm CloudTrail log file validation is enabled
  - **Location**: `terraform/modules/audit/main.tf` (line 48)
  - **Check**: `enable_log_file_validation = true`
  - **Purpose**: Detects tampering with log files
  - **Verification**: Check CloudTrail configuration

### Log Retention

- [ ] **MEDIUM**: Check that CloudWatch Logs retention is appropriate (cost vs. compliance)
  - **Current**:
    - Lambda logs: 7 days
    - API Gateway logs: 7 days
    - Audit logs: 30 days
  - **Check**: Adjust based on compliance requirements
  - **Verification**: Review log group retention settings

### Access Logs

- [ ] **MEDIUM**: Verify access logs are being written correctly
  - **Location**: API Gateway stage configuration (lines 767-785)
  - **Check**: Logs appear in CloudWatch Log Group
  - **Check**: Log format includes necessary fields
  - **Verification**: Check CloudWatch Logs after API calls

### Error Tracking

- [ ] **MEDIUM**: Confirm error tracking is in place
  - **Options**:
    - CloudWatch Logs Insights queries
    - Third-party error tracking (Sentry, etc.)
    - Custom Lambda function to parse logs
  - **Verification**: Test error scenario, verify it's tracked

---

## Cognito Security

### Password Policy

- [ ] **HIGH**: Verify password policy is enforced (8+ chars, complexity requirements)
  - **Location**: `terraform/modules/auth/main.tf` (lines 11-17)
  - **Check**:
    - Minimum length: 8 characters
    - Require lowercase: true
    - Require uppercase: true
    - Require numbers: true
    - Require symbols: true
  - **Verification**: Attempt to create weak password - should fail

### Multi-Factor Authentication

- [ ] **MEDIUM**: Confirm MFA is configured appropriately (currently OFF, verify if needed)
  - **Location**: `terraform/modules/auth/main.tf` (line 9)
  - **Current**: `mfa_configuration = "OFF"`
  - **Decision**: Enable if required by compliance or security policy
  - **Note**: Enabling MFA requires PinpointSmsVoiceV2 subscription or TOTP setup

### Email Verification

- [ ] **HIGH**: Check that email verification is required
  - **Location**: `terraform/modules/auth/main.tf` (line 8)
  - **Check**: `auto_verified_attributes = ["email"]`
  - **Check**: Post-confirmation Lambda only runs after email verification
  - **Verification**: Test signup flow, verify email verification required

### OAuth Providers

- [ ] **HIGH**: Verify OAuth providers are configured correctly
  - **Location**: `terraform/modules/auth/main.tf` (lines 87-91)
  - **Check**:
    - Google OAuth: Client ID and secret configured
    - LinkedIn OAuth: Client ID and secret configured
    - Callback URLs match production domain
  - **Verification**: Test OAuth login flow for each provider

### Callback URLs

- [ ] **CRITICAL**: Confirm callback URLs match production domain exactly
  - **Location**: `terraform/variables.tf` and `terraform.tfvars`
  - **Check**: `callback_urls` includes production frontend URL
  - **Format**: `https://yourdomain.com/auth/callback`
  - **Verification**: Test OAuth callback in production

### Token Configuration

- [ ] **MEDIUM**: Check that token expiration times are appropriate
  - **Location**: Cognito User Pool Client settings
  - **Default**: Access tokens: 1 hour, Refresh tokens: 30 days
  - **Check**: Adjust based on security requirements
  - **Verification**: Check token expiration in JWT claims

### Account Recovery

- [ ] **MEDIUM**: Verify account recovery settings are configured
  - **Location**: `terraform/modules/auth/main.tf` (lines 59-64)
  - **Check**: `account_recovery_setting` configured with verified email
  - **Verification**: Test password reset flow

---

## Post-Deployment Verification

### Authentication Testing

- [ ] **CRITICAL**: Test authentication flow (email/password, OAuth)
  - **Test Cases**:
    - Sign up with email/password
    - Sign in with email/password
    - Sign in with Google OAuth
    - Sign in with LinkedIn OAuth
    - Sign out
  - **Verification**: All flows work correctly, tokens are received

- [ ] **CRITICAL**: Verify JWT tokens are validated correctly
  - **Test Cases**:
    - Valid token: Request succeeds
    - Expired token: Request fails with 401
    - Invalid token: Request fails with 401
    - Missing token: Request fails with 401
  - **Verification**: Test each scenario, verify correct responses

### Authorization Testing

- [ ] **CRITICAL**: Test authorization (users can only access their own data)
  - **Test Cases**:
    - User A tries to update User B's profile: Should fail
    - User A tries to access User B's profile via /users/me: Should return User A's data
    - User A tries to delete User B's link: Should fail
  - **Verification**: All cross-user access attempts fail

- [ ] **HIGH**: Confirm public profiles are accessible without authentication
  - **Test Case**: Access `/profiles/{username}` without token
  - **Verification**: Profile data returned, no authentication required

### File Upload Testing

- [ ] **HIGH**: Verify file uploads work and files are stored correctly
  - **Test Cases**:
    - Upload profile image: Should succeed, URL returned
    - Upload project image: Should succeed, URL returned
    - Upload resume: Should succeed, URL returned
    - Upload invalid file type: Should fail
    - Upload with expired presigned URL: Should fail
  - **Verification**: Files appear in S3, URLs are accessible

- [ ] **MEDIUM**: Test that presigned URLs expire after 5 minutes
  - **Test Case**: Generate presigned URL, wait 6 minutes, attempt upload
  - **Verification**: Upload fails with expiration error

- [ ] **MEDIUM**: Confirm S3 public URLs are accessible for images/resumes
  - **Test Case**: Access S3 URL directly in browser
  - **Verification**: Image/resume displays correctly

### Error Handling Testing

- [ ] **MEDIUM**: Verify error handling doesn't expose sensitive information
  - **Test Cases**:
    - Invalid request: Generic error message
    - Database error: Generic error message
    - Internal error: Generic error message
  - **Verification**: Error messages are user-friendly, no stack traces

### Performance Testing

- [ ] **MEDIUM**: Test rate limiting on API Gateway
  - **Test Case**: Send 100+ requests in short time
  - **Verification**: Requests throttled after limit

### Logging Verification

- [ ] **HIGH**: Confirm CloudTrail is logging events
  - **Test Case**: Make API calls, check CloudTrail logs
  - **Verification**: Events appear in CloudTrail S3 bucket

- [ ] **HIGH**: Verify CloudWatch Logs are being written
  - **Test Case**: Make API calls, check CloudWatch Logs
  - **Verification**: Log entries appear in log groups

### CORS Testing

- [ ] **HIGH**: Test CORS with production frontend domain
  - **Test Case**: Make API request from production frontend
  - **Verification**: CORS headers present, preflight works

---

## Compliance and Audit

### CloudTrail Configuration

- [ ] **CRITICAL**: Verify CloudTrail is enabled for all regions (multi-region trail)
  - **Location**: `terraform/modules/audit/main.tf` (line 47)
  - **Check**: `is_multi_region_trail = true`
  - **Purpose**: Track API calls across all regions
  - **Verification**: Check CloudTrail configuration in AWS Console

- [ ] **HIGH**: Confirm audit logs are stored in encrypted S3 bucket
  - **Location**: `terraform/modules/audit/main.tf` (lines 21-29)
  - **Check**: S3 bucket encryption enabled (AES256)
  - **Check**: Bucket is private (no public access)
  - **Verification**: Check S3 bucket encryption settings

### Log Retention

- [ ] **MEDIUM**: Check that log retention meets compliance requirements
  - **Current**:
    - CloudTrail: Indefinite (S3 lifecycle policy can be added)
    - CloudWatch Logs: 7-30 days
  - **Check**: Adjust based on compliance needs (GDPR, HIPAA, etc.)
  - **Verification**: Review retention policies

### Access Control

- [ ] **HIGH**: Verify access to audit logs is restricted
  - **Check**:
    - CloudTrail S3 bucket: Private, IAM access only
    - CloudWatch Logs: IAM access only
    - No public read access
  - **Verification**: Attempt public access - should fail

### Documentation

- [ ] **MEDIUM**: Confirm data retention policies are documented
  - **Document**:
    - How long data is retained
    - How data is deleted
    - User data deletion process
  - **Location**: Create data retention policy document

- [ ] **HIGH**: Check that security incidents can be traced via logs
  - **Test Case**: Simulate security incident, trace via logs
  - **Verification**: Can identify:
    - Who accessed what
    - When access occurred
    - What actions were taken
    - Source IP addresses

---

## Security Recommendations

### Short-Term Improvements

1. **Enable MFA for Cognito** (if required by compliance)
   - Configure TOTP-based MFA
   - Or enable SMS MFA (requires PinpointSmsVoiceV2 subscription)
   - Update `terraform/modules/auth/main.tf` to enable MFA

2. **Implement WAF Rules for API Gateway**
   - Add AWS WAF in front of API Gateway
   - Configure rate-based rules
   - Add IP whitelist/blacklist rules
   - Block common attack patterns

3. **Add DDoS Protection**
   - Enable AWS Shield Standard (automatic)
   - Consider AWS Shield Advanced for additional protection
   - Configure CloudFront in front of API Gateway (if needed)

4. **Set Up Security Monitoring Dashboard**
   - Create CloudWatch Dashboard with:
     - Failed authentication attempts
     - API error rates
     - Unusual traffic patterns
     - Lambda function errors
   - Set up automated reports

### Medium-Term Improvements

5. **Regular Security Audits**
   - Schedule: Quarterly
   - Review: IAM policies, S3 bucket policies, Lambda code
   - Tools: AWS Security Hub, AWS Config
   - Action: Document findings and remediation

6. **Penetration Testing Schedule**
   - Schedule: Annually or after major changes
   - Scope: API endpoints, authentication, authorization
   - Action: Fix identified vulnerabilities

7. **Incident Response Plan**
   - Document: Security incident response procedures
   - Include: Contact information, escalation paths, recovery steps
   - Test: Run tabletop exercises

### Long-Term Improvements

8. **Implement Secrets Rotation**
   - Automate OAuth secret rotation
   - Rotate Cognito secrets regularly
   - Document rotation procedures

9. **Add Security Scanning**
   - Static code analysis (SAST)
   - Dependency vulnerability scanning
   - Container scanning (if using containers)
   - Integrate into CI/CD pipeline

10. **Compliance Certifications**
    - Pursue SOC 2, ISO 27001, or other certifications if needed
    - Implement required controls
    - Regular compliance audits

---

## Checklist Usage

### Before Deployment

1. Review all **CRITICAL** items
2. Complete all **HIGH** priority items
3. Review **MEDIUM** items based on risk assessment
4. Document any exceptions or deferred items

### During Deployment

1. Use this checklist as a guide
2. Check off items as they are verified
3. Document any issues found
4. Do not proceed if critical items are not met

### After Deployment

1. Complete post-deployment verification section
2. Review monitoring and alerting
3. Schedule regular security reviews
4. Update checklist based on lessons learned

### Regular Reviews

- **Weekly**: Review CloudWatch alarms and logs
- **Monthly**: Review IAM policies and access
- **Quarterly**: Full security audit using this checklist
- **Annually**: Penetration testing and compliance review

---

## Notes

- Items marked **CRITICAL** must be completed before production deployment
- Items marked **HIGH** should be completed before production deployment
- Items marked **MEDIUM** can be completed post-deployment but should be prioritized
- Document any exceptions or risk acceptance decisions
- Keep this checklist updated as infrastructure evolves

---

**Document Owner**: Security Team  
**Review Date**: Quarterly  
**Next Review**: [Date]

