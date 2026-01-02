# ProLynk Technical Stack Documentation

Comprehensive technical documentation covering backend architecture, API design, database schema, and infrastructure.

## Table of Contents

1. [Backend Architecture Overview](#backend-architecture-overview)
2. [Lambda Functions](#lambda-functions)
3. [API Gateway Structure](#api-gateway-structure)
4. [API Endpoints](#api-endpoints)
5. [Database Schema](#database-schema)
6. [S3 Storage Architecture](#s3-storage-architecture)
7. [Authentication & Authorization](#authentication--authorization)
8. [File Upload Flow](#file-upload-flow)
9. [Infrastructure as Code](#infrastructure-as-code)
10. [Security & IAM](#security--iam)

## Backend Architecture Overview

ProLynk uses a serverless architecture built entirely on AWS services. The backend consists of:

- **API Gateway HTTP API v2**: RESTful API endpoint management
- **AWS Lambda (Python 3.11)**: Serverless compute for business logic
- **Amazon DynamoDB**: NoSQL database for user and profile data
- **Amazon S3**: Object storage for images and resume files
- **Amazon Cognito**: Managed authentication and user management
- **Terraform**: Infrastructure as Code for provisioning and management

### Architecture Pattern

```
Frontend (React)
    ↓
API Gateway HTTP API v2
    ↓
JWT Authorizer (Cognito)
    ↓
Lambda Functions
    ├── Profiles Lambda (Profile CRUD)
    ├── Links Lambda (Link Management)
    ├── Upload Lambda (Presigned URL Generation)
    ├── Post-Confirmation Lambda (User Onboarding)
    └── Pre-Signup Lambda (Username Validation)
    ↓
DynamoDB / S3
```

### Key Design Decisions

1. **Serverless First**: All compute is Lambda-based for automatic scaling and cost efficiency
2. **API Gateway HTTP API v2**: Lower latency and cost compared to REST API
3. **Direct S3 Uploads**: Presigned URLs enable client-to-S3 uploads, reducing Lambda execution time
4. **JWT Authorization**: Stateless authentication via Cognito tokens
5. **Infrastructure as Code**: Terraform ensures reproducible, version-controlled infrastructure

## Lambda Functions

### Profiles Lambda (`profiles`)

**Purpose**: Handles all profile-related operations including CRUD, public profile retrieval, and user status.

**Runtime**: Python 3.11  
**Timeout**: 30 seconds  
**Handler**: `main.handler`

**Environment Variables**:
- `PROFILES_TABLE`: DynamoDB profiles table name
- `USERS_TABLE`: DynamoDB users table name
- `S3_BUCKET`: S3 bucket name for asset storage

**IAM Permissions**:
- DynamoDB: `GetItem`, `PutItem`, `UpdateItem`, `Query`, `Scan` on profiles and users tables
- CloudWatch Logs: Full logging permissions

**Key Functions**:
- `handler()`: Main entry point, routes requests based on HTTP method and path
- `create_or_update_profile()`: Creates or updates user profiles with partial update support
- `get_current_user_profile()`: Returns current user's account status
- `get_public_profile()`: Retrieves public profile by username (no authentication required)
- `check_username_availability()`: Validates username uniqueness

**Request Routing**:
```python
GET /users/me → get_current_user_profile()
POST /profiles → create_or_update_profile()
GET /profiles/{username} → get_public_profile()
GET /username/check?username={username} → check_username_availability()
```

**Partial Update Strategy**:
The Lambda implements intelligent merging:
- If a field is provided in the request body, it updates that field
- If a field is not provided, it preserves the existing value from DynamoDB
- This allows frontend to send only changed fields without overwriting others

### Links Lambda (`links`)

**Purpose**: Manages external links associated with user profiles.

**Runtime**: Python 3.11  
**Timeout**: 30 seconds  
**Handler**: `index.handler`

**Environment Variables**:
- `LINKS_TABLE`: DynamoDB links table name

**IAM Permissions**:
- DynamoDB: `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, `Query` on links table
- CloudWatch Logs: Full logging permissions

**Key Functions**:
- `create_or_update_link()`: Creates or updates a link
- `delete_link()`: Soft deletes a link (sets `is_deleted` flag)

**Request Routing**:
```python
POST /links → create_or_update_link()
DELETE /links/{id} → delete_link()
```

### Upload Lambda (`upload`)

**Purpose**: Generates presigned URLs for direct S3 uploads.

**Runtime**: Python 3.11  
**Timeout**: 30 seconds  
**Handler**: `main.handler`

**Environment Variables**:
- `S3_BUCKET`: S3 bucket name

**IAM Permissions**:
- S3: `GetObject`, `PutObject`, `PutObjectAcl` on `users/*` prefix
- S3: `ListBucket` on bucket with `users/*` prefix condition
- CloudWatch Logs: Full logging permissions

**Key Functions**:
- `generate_presigned_url()`: Creates presigned PUT URL for file uploads

**Request Routing**:
```python
POST /upload-url → generate_presigned_url()
```

**Upload Types Supported**:
- `profile_image`: Profile pictures → `users/{user_id}/profile/`
- `project_image`: Project screenshots → `users/{user_id}/projects/`
- `resume`: PDF resumes → `users/{user_id}/resume/`

**Presigned URL Details**:
- Expiration: 5 minutes (300 seconds)
- HTTP Method: PUT
- Content-Type: Included in signature (required for S3 validation)
- Signature Version: s3v4 (required for KMS compatibility)

### Post-Confirmation Lambda (`post-confirmation`)

**Purpose**: Executes after user email confirmation in Cognito. Creates initial user record in DynamoDB.

**Runtime**: Python 3.11  
**Timeout**: 30 seconds  
**Handler**: `main.handler`

**Environment Variables**:
- `USERS_TABLE`: DynamoDB users table name
- `PROFILES_TABLE`: DynamoDB profiles table name

**IAM Permissions**:
- DynamoDB: `PutItem`, `GetItem`, `UpdateItem`, `Query` on users and profiles tables
- Cognito: `ListUsers` for account linking
- CloudWatch Logs: Full logging permissions

**Trigger**: Cognito User Pool Post-Confirmation event

**Functionality**:
- Creates user record in `users` table
- Handles account linking for OAuth providers
- Sets initial profile completion status

### Pre-Signup Lambda (`pre-signup`)

**Purpose**: Validates username availability before user registration.

**Runtime**: Python 3.11  
**Timeout**: 10 seconds  
**Handler**: `main.handler`

**IAM Permissions**:
- DynamoDB: `Query` on profiles table (user_id-index GSI)
- CloudWatch Logs: Full logging permissions

**Trigger**: Cognito User Pool Pre-Signup event

**Functionality**:
- Checks if username is already taken
- Allows or denies signup based on availability

## API Gateway Structure

### HTTP API v2 Configuration

**API Name**: `{project_name}-api`  
**Protocol**: HTTP  
**CORS**: Enabled with credentials support

**CORS Configuration**:
```hcl
allow_origins = ["http://localhost:3000", "http://localhost:8080"]
allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
allow_headers = ["content-type", "authorization"]
allow_credentials = true
max_age = 300
```

### JWT Authorizer

**Type**: JWT  
**Identity Source**: `$request.header.Authorization`  
**Issuer**: `https://cognito-idp.{region}.amazonaws.com/{user-pool-id}`  
**Audience**: Empty array (Cognito access tokens use `client_id` claim, not `aud`)

**Authorization Flow**:
1. Client sends request with `Authorization: Bearer <token>` header
2. API Gateway extracts token from header
3. JWT Authorizer validates token signature and issuer
4. If valid, request proceeds to Lambda with `authorizer.claims` in event
5. If invalid, API Gateway returns 401 Unauthorized

### Stage Configuration

**Stage Name**: `$default`  
**Auto Deploy**: Enabled (deploys on infrastructure changes)

**Throttling**:
- Burst Limit: 100 requests
- Rate Limit: 50 requests/second

**Access Logging**: Enabled to CloudWatch Logs

## API Endpoints

### Profiles Endpoints

#### `POST /profiles`

Create or update user profile.

**Authentication**: Required (JWT)

**Request Body**:
```json
{
  "username": "string (required)",
  "full_name": "string",
  "title": "string",
  "bio": "string",
  "skills": ["string"],
  "social_links": {
    "linkedin": "string",
    "github": "string",
    "twitter": "string"
  },
  "projects": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "link": "string",
      "image_url": "string",
      "image_key": "string",
      "tech_stack": ["string"],
      "order": "number"
    }
  ],
  "profile_image_url": "string",
  "avatar_key": "string",
  "resume_url": "string",
  "resume_key": "string",
  "email": "string",
  "phone": "string",
  "show_email": "boolean",
  "show_phone": "boolean",
  "show_resume": "boolean",
  "date_of_birth": "string (ISO 8601)"
}
```

**Response** (200 OK):
```json
{
  "message": "Profile saved successfully",
  "profile": { /* full profile object */ }
}
```

**Error Responses**:
- `400 Bad Request`: Missing required fields (username)
- `401 Unauthorized`: Invalid or missing JWT token
- `409 Conflict`: Username already taken by another user
- `500 Internal Server Error`: Database or server error

**Partial Update Behavior**:
- Only provided fields are updated
- Existing fields are preserved if not in request body
- Arrays (projects, skills) are replaced entirely if provided

#### `GET /profiles/{username}`

Retrieve public profile by username.

**Authentication**: Not required (public endpoint)

**Path Parameters**:
- `username`: Username of the profile to retrieve

**Response** (200 OK):
```json
{
  "username": "string",
  "full_name": "string",
  "title": "string",
  "bio": "string",
  "skills": ["string"],
  "social_links": {
    "linkedin": "string",
    "github": "string"
  },
  "projects": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "link": "string",
      "image_url": "string",
      "tech_stack": ["string"],
      "order": "number"
    }
  ],
  "profile_image_url": "string",
  "avatar_url": "string",
  "resume_url": "string",
  "links": [
    {
      "title": "string",
      "url": "string"
    }
  ],
  "email": "string (if show_email is true)",
  "phone": "string (if show_phone is true)",
  "show_email": "boolean",
  "show_phone": "boolean",
  "show_resume": "boolean"
}
```

**Error Responses**:
- `404 Not Found`: Profile not found
- `500 Internal Server Error`: Database or server error

**Visibility Controls**:
- `email` and `phone` only included if respective `show_*` flags are `true`
- Owner always sees their own contact info regardless of flags

#### `GET /users/me`

Get current user's account status.

**Authentication**: Required (JWT)

**Response** (200 OK):
```json
{
  "user_id": "string",
  "username": "string",
  "email": "string",
  "profile_complete": "boolean",
  "date_of_birth": "string",
  "fullname": "string"
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing JWT token
- `404 Not Found`: User not found
- `500 Internal Server Error`: Database or server error

#### `GET /username/check?username={username}`

Check username availability.

**Authentication**: Not required (public endpoint)

**Query Parameters**:
- `username`: Username to check

**Response** (200 OK):
```json
{
  "available": "boolean",
  "username": "string"
}
```

**Error Responses**:
- `400 Bad Request`: Missing username parameter
- `500 Internal Server Error`: Database or server error

### Links Endpoints

#### `POST /links`

Create or update an external link.

**Authentication**: Required (JWT)

**Request Body**:
```json
{
  "link_id": "string (optional, UUID generated if not provided)",
  "title": "string (required)",
  "url": "string (required)",
  "order": "number"
}
```

**Response** (200 OK):
```json
{
  "message": "Link saved successfully",
  "link": {
    "user_id": "string",
    "link_id": "string",
    "title": "string",
    "url": "string",
    "order": "number",
    "is_deleted": "boolean",
    "created_at": "string (ISO 8601)",
    "updated_at": "string (ISO 8601)"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Missing required fields
- `401 Unauthorized`: Invalid or missing JWT token
- `500 Internal Server Error`: Database or server error

#### `DELETE /links/{id}`

Soft delete an external link.

**Authentication**: Required (JWT)

**Path Parameters**:
- `id`: Link ID to delete

**Response** (200 OK):
```json
{
  "message": "Link deleted successfully"
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing JWT token
- `404 Not Found`: Link not found
- `500 Internal Server Error`: Database or server error

**Note**: Links are soft-deleted (`is_deleted` flag set to `true`) rather than physically removed.

### Upload Endpoints

#### `POST /upload-url`

Generate presigned URL for direct S3 upload.

**Authentication**: Required (JWT)

**Request Body**:
```json
{
  "file_type": "profile_image | project_image | resume (required)",
  "content_type": "string (required, MIME type)",
  "file_extension": "string (optional, e.g., '.jpg', '.pdf')"
}
```

**Response** (200 OK):
```json
{
  "upload_url": "string (presigned PUT URL)",
  "key": "string (S3 object key)",
  "url": "string (public URL after upload)",
  "content_type": "string (MIME type included in signature)"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid file_type or content_type
- `401 Unauthorized`: Invalid or missing JWT token
- `500 Internal Server Error`: S3 or server error

**Allowed Content Types**:
- Images: `image/png`, `image/jpeg`, `image/jpg`, `image/webp`
- Resumes: `application/pdf`

**Presigned URL Details**:
- Valid for 5 minutes
- HTTP Method: PUT
- Content-Type must match request body `content_type`
- Signature includes Content-Type for S3 validation

## Database Schema

### DynamoDB Tables

ProLynk uses three DynamoDB tables with pay-per-request billing mode for automatic scaling.

### Users Table

**Table Name**: `{project_name}-users`  
**Primary Key**: `user_id` (String)  
**Billing Mode**: PAY_PER_REQUEST

**Global Secondary Index**:
- **Name**: `email-index`
- **Partition Key**: `email` (String)
- **Projection**: ALL

**Schema**:
```typescript
{
  user_id: string,              // Primary key, from Cognito 'sub' claim
  email: string,                // User email address
  username: string,             // Unique username
  profile_complete: boolean,    // Profile completion status
  date_of_birth?: string,       // ISO 8601 date string
  created_at: string,          // ISO 8601 timestamp
  updated_at: string            // ISO 8601 timestamp
}
```

**Access Patterns**:
- Get user by `user_id` (primary key lookup)
- Get user by `email` (GSI lookup for account linking)

### Profiles Table

**Table Name**: `{project_name}-profiles`  
**Primary Key**: `username` (String)  
**Billing Mode**: PAY_PER_REQUEST

**Global Secondary Index**:
- **Name**: `user_id-index`
- **Partition Key**: `user_id` (String)
- **Projection**: ALL

**Schema**:
```typescript
{
  username: string,             // Primary key, unique username
  user_id: string,             // Foreign key to users table
  full_name?: string,          // Display name
  title?: string,              // Professional title
  bio?: string,                // Biography text
  skills?: string[],           // Array of skill strings
  social_links?: {            // Object with platform keys
    linkedin?: string,
    github?: string,
    twitter?: string,
    // ... other platforms
  },
  projects?: Project[],        // Array of project objects
  avatar_key?: string,         // S3 key for profile image
  avatar_url?: string,         // Public S3 URL for profile image
  profile_image_url?: string,  // Alias for avatar_url (backward compatibility)
  resume_key?: string,         // S3 key for resume file
  resume_url?: string,         // Public S3 URL for resume file
  email?: string,              // Contact email
  phone?: string,              // Contact phone
  show_email?: boolean,        // Visibility flag for email
  show_phone?: boolean,        // Visibility flag for phone
  show_resume?: boolean,       // Visibility flag for resume
  favorite_color?: string,     // Accent color (deprecated, default purple)
  date_of_birth?: string,      // ISO 8601 date string
  created_at: string,         // ISO 8601 timestamp
  updated_at: string          // ISO 8601 timestamp
}
```

**Project Object Schema**:
```typescript
{
  id?: string,                 // Unique project identifier
  title: string,               // Project name
  description?: string,        // Project description
  link: string,               // External URL
  image_url?: string,         // S3 URL for project image
  image_key?: string,         // S3 key for project image
  tech_stack?: string[],      // Array of technology names
  order?: number              // Display order
}
```

**Access Patterns**:
- Get profile by `username` (primary key lookup, public profiles)
- Get profile by `user_id` (GSI lookup, for owner's profile)

**Data Relationships**:
- One-to-one with users table via `user_id`
- Projects stored as nested array (DynamoDB supports nested documents)

### Links Table

**Table Name**: `{project_name}-links`  
**Primary Key**: `user_id` (String) + `link_id` (String)  
**Billing Mode**: PAY_PER_REQUEST

**Schema**:
```typescript
{
  user_id: string,             // Partition key, foreign key to users table
  link_id: string,            // Sort key, unique link identifier
  title: string,              // Link display title
  url: string,                // Link URL
  order: number,              // Display order
  is_deleted: boolean,        // Soft delete flag
  created_at: string,        // ISO 8601 timestamp
  updated_at: string         // ISO 8601 timestamp
}
```

**Access Patterns**:
- Get all links for a user (query by `user_id`)
- Get specific link (get item by `user_id` + `link_id`)
- Soft delete link (update `is_deleted` flag)

**Note**: Links use composite primary key (partition + sort) to enable efficient queries for all user links.

## S3 Storage Architecture

### Bucket Configuration

**Bucket Name**: `{project_name}-assets-{account-id}`  
**Versioning**: Enabled  
**Public Access**: Configured via bucket policy  
**Encryption**: None (for maximum compatibility with public file access)

### Directory Structure

```
{project_name}-assets-{account-id}/
├── users/
│   ├── {user_id}/
│   │   ├── profile/
│   │   │   └── {uuid}.{ext}          # Profile images
│   │   ├── projects/
│   │   │   └── {uuid}.{ext}         # Project images
│   │   └── resume/
│   │       └── {uuid}.pdf           # Resume files
```

### Bucket Policy

**Public Read Access**:
- `users/*/profile/*` - Profile images (public read)
- `users/*/projects/*` - Project images (public read)
- `users/*/resume/*` - Resume files (public read)

**Security**:
- All uploads must use HTTPS (deny insecure uploads)
- Presigned URLs required for uploads (no direct public writes)

### CORS Configuration

**Allowed Origins**: `*` (all origins for image access)  
**Allowed Methods**: `GET`, `PUT`, `POST`, `HEAD`  
**Allowed Headers**: `*`  
**Exposed Headers**: `ETag`, `x-amz-server-side-encryption`, `x-amz-request-id`, `x-amz-id-2`  
**Max Age**: 3000 seconds

### File Naming Convention

Files are named using UUID v4 to ensure uniqueness:
- Format: `{uuid}.{extension}`
- Example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg`
- Generated by Lambda when creating presigned URL

### URL Generation

**Presigned URL** (for uploads):
- Generated by Upload Lambda
- Valid for 5 minutes
- Includes Content-Type in signature

**Public URL** (after upload):
- Format: `https://{bucket-name}.s3.amazonaws.com/{key}`
- Stored in DynamoDB profile records
- Directly accessible from frontend

## Authentication & Authorization

### Cognito User Pool

**User Pool Name**: `{project_name}-user-pool`

**Configuration**:
- Username attributes: `email`
- Auto-verified attributes: `email`
- MFA: Disabled
- Password policy: 8+ characters, requires uppercase, lowercase, numbers, symbols

**Custom Attributes**:
- `fullname`: String, mutable
- `date_of_birth`: String, mutable
- `username`: String, immutable
- `picture`: String, mutable

**Identity Providers**:
- Cognito (email/password)
- Google OAuth (if configured)
- LinkedIn OAuth (if configured)

### OAuth Flow

**Authorization Code Grant**:
1. User clicks "Sign in with Google/LinkedIn"
2. Redirect to Cognito hosted UI
3. Cognito redirects to OAuth provider
4. User authorizes on provider
5. Provider redirects back to Cognito with code
6. Cognito exchanges code for tokens
7. Cognito redirects to app callback URL with tokens
8. Frontend stores tokens and uses for API calls

**Callback URLs**:
- Development: `http://localhost:3000/auth/callback`, `http://localhost:8080/auth/callback`
- Production: Configured in Terraform variables

### JWT Token Structure

**Access Token Claims**:
```json
{
  "sub": "user-uuid",           // User ID (used as user_id in DynamoDB)
  "email": "user@example.com",
  "cognito:username": "username",
  "client_id": "cognito-client-id",
  "iss": "https://cognito-idp.{region}.amazonaws.com/{pool-id}",
  "token_use": "access",
  "exp": 1234567890,
  "iat": 1234567890
}
```

**Token Validation**:
- API Gateway JWT Authorizer validates:
  - Signature (using Cognito public keys)
  - Issuer (must match Cognito User Pool)
  - Expiration (token not expired)
- Audience validation skipped (Cognito access tokens use `client_id`)

### Authorization Flow

1. **Frontend Request**:
   ```
   GET /profiles
   Authorization: Bearer <access-token>
   ```

2. **API Gateway**:
   - Extracts token from `Authorization` header
   - Validates token via JWT Authorizer
   - If valid, adds `authorizer.claims` to event

3. **Lambda Function**:
   - Extracts `user_id` from `event.requestContext.authorizer.claims.sub`
   - Uses `user_id` for authorization checks
   - Ensures users can only modify their own data

4. **Response**:
   - Returns data or error based on authorization result

## File Upload Flow

### Complete Upload Process

1. **User Selects File**:
   - Frontend validates file type and size
   - Shows preview if image

2. **Request Presigned URL**:
   ```
   POST /upload-url
   Authorization: Bearer <token>
   {
     "file_type": "profile_image",
     "content_type": "image/jpeg",
     "file_extension": ".jpg"
   }
   ```

3. **Lambda Generates Presigned URL**:
   - Validates file type and content type
   - Generates unique S3 key: `users/{user_id}/{type}/{uuid}.{ext}`
   - Creates presigned PUT URL (5-minute expiration)
   - Returns presigned URL and public URL

4. **Frontend Uploads to S3**:
   - Uses presigned URL to PUT file directly to S3
   - Includes Content-Type header (must match signature)
   - S3 validates signature and stores file

5. **Frontend Updates Profile**:
   - Stores S3 URL in profile data
   - Sends profile update to `/profiles` endpoint
   - Lambda saves S3 URL to DynamoDB

### Security Considerations

- **Presigned URLs**: Time-limited (5 minutes) prevent unauthorized uploads
- **Content-Type Validation**: Signature includes Content-Type, preventing type spoofing
- **User Isolation**: Files stored in `users/{user_id}/` prefix, preventing cross-user access
- **HTTPS Only**: Bucket policy denies insecure uploads
- **File Type Validation**: Lambda validates MIME types before generating URL

### Error Handling

- **Invalid File Type**: Lambda returns 400 before generating URL
- **Upload Failure**: Frontend shows error, allows retry
- **Expired URL**: Frontend requests new URL if upload fails
- **S3 Errors**: Lambda catches and returns user-friendly error messages

## Infrastructure as Code

### Terraform Structure

```
terraform/
├── main.tf                    # Root module, orchestrates all modules
├── variables.tf               # Variable definitions
├── terraform.tfvars          # Variable values
├── outputs.tf                # Output values
└── modules/
    ├── api/                  # API Gateway, Lambda, DynamoDB, S3
    ├── auth/                 # Cognito User Pool
    ├── networking/           # VPC, Subnets (if needed)
    └── audit/                # CloudTrail logging
```

### Module: API

**Resources Created**:
- 3 DynamoDB tables (users, profiles, links)
- 1 S3 bucket with policies and CORS
- 5 Lambda functions (profiles, links, upload, post-confirmation, pre-signup)
- API Gateway HTTP API v2 with routes and authorizer
- IAM roles and policies for Lambda functions
- CloudWatch log groups

**Key Outputs**:
- API Gateway endpoint URL
- Lambda function ARNs
- DynamoDB table names
- S3 bucket name

### Module: Auth

**Resources Created**:
- Cognito User Pool
- Cognito User Pool Client
- OAuth identity providers (Google, LinkedIn)
- Lambda triggers (post-confirmation, pre-signup)

**Key Outputs**:
- User Pool ID
- User Pool Client ID
- User Pool ARN
- Cognito domain

### Deployment Process

1. **Initialize Terraform**:
   ```bash
   terraform init
   ```

2. **Plan Changes**:
   ```bash
   terraform plan
   ```

3. **Apply Changes**:
   ```bash
   terraform apply
   ```

4. **Get Outputs**:
   ```bash
   terraform output
   ```

### State Management

- Terraform state stored locally (or in S3 backend for team collaboration)
- State includes all resource IDs and dependencies
- Changes are tracked and can be reviewed before application

## Security & IAM

### IAM Roles

#### Profiles Lambda Role

**Permissions**:
- DynamoDB: Read/write on profiles and users tables
- CloudWatch Logs: Write logs

**Principle of Least Privilege**:
- Only access to specific tables
- No S3 access (profiles don't upload files directly)
- No cross-account access

#### Links Lambda Role

**Permissions**:
- DynamoDB: Full CRUD on links table only
- CloudWatch Logs: Write logs

**Isolation**:
- Separate role from profiles Lambda
- Can only access links table

#### Upload Lambda Role

**Permissions**:
- S3: PutObject, GetObject on `users/*` prefix
- S3: ListBucket with `users/*` prefix condition
- CloudWatch Logs: Write logs

**Security**:
- Cannot access other users' files (prefix restriction)
- Cannot delete objects (no DeleteObject permission)
- Can only list within user prefix

#### Post-Confirmation Lambda Role

**Permissions**:
- DynamoDB: Write to users and profiles tables
- Cognito: ListUsers (for account linking)
- CloudWatch Logs: Write logs

**Trigger**:
- Invoked by Cognito, not API Gateway
- No API Gateway permissions needed

### API Gateway Security

**JWT Authorizer**:
- Validates token signature
- Validates issuer (Cognito User Pool)
- Extracts user claims for Lambda

**CORS**:
- Credentials allowed (for Authorization header)
- Specific origins configured (no wildcard with credentials)
- Preflight requests handled automatically

**Rate Limiting**:
- Burst: 100 requests
- Rate: 50 requests/second
- Prevents abuse and cost overruns

### DynamoDB Security

**Access Control**:
- Tables not publicly accessible
- Only Lambda functions have access
- IAM policies restrict to specific tables

**Data Isolation**:
- Users can only access their own data (enforced in Lambda)
- Public profiles read-only (no user_id in request)

### S3 Security

**Bucket Policy**:
- Public read for profile/project/resume files
- Deny insecure uploads (HTTPS only)
- No public write access

**Presigned URLs**:
- Time-limited (5 minutes)
- Content-Type included in signature
- User-specific paths prevent cross-user access

### Network Security

**VPC Configuration**:
- Lambda functions can be placed in VPC if needed
- Currently using default VPC (no VPC configuration)
- API Gateway is internet-facing

**Encryption**:
- DynamoDB: Encryption at rest (AWS managed)
- S3: No encryption (for public file compatibility)
- API Gateway: HTTPS only (TLS 1.2+)

---

## Additional Technical Details

### Error Handling Patterns

**Lambda Error Responses**:
- All errors return JSON with `error` and optional `message` fields
- Status codes: 400 (bad request), 401 (unauthorized), 404 (not found), 500 (server error)
- CORS headers included in all responses (including errors)

**Logging**:
- All Lambda functions log to CloudWatch Logs
- Debug logging enabled for development
- Error stack traces logged for debugging

### Performance Considerations

**Lambda Cold Starts**:
- Python 3.11 runtime for faster cold starts
- 30-second timeout allows for complex operations
- Connection pooling for DynamoDB (boto3 handles this)

**DynamoDB**:
- Pay-per-request billing for automatic scaling
- GSI indexes for efficient queries
- No provisioned capacity needed

**S3**:
- Direct client uploads reduce Lambda execution time
- Public URLs enable CDN caching (if CDN added later)
- Versioning enabled for data protection

### Monitoring & Observability

**CloudWatch Logs**:
- All Lambda functions log to `/aws/lambda/{function-name}`
- API Gateway access logs to `/aws/apigateway/{api-name}`
- 7-day retention for cost management

**Metrics**:
- Lambda: Invocations, errors, duration, throttles
- API Gateway: Request count, 4xx/5xx errors, latency
- DynamoDB: Read/write capacity, throttles

**Debugging**:
- Extensive debug logging in Lambda functions
- Request/response logging for API calls
- Error stack traces in CloudWatch Logs

---

**Document Version**: 1.0  
**Last Updated**: 2025  
**Maintained By**: ProLynk Development Team

