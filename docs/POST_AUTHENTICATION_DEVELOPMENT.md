# Post-Authentication Development Documentation

## Overview

This document outlines the features, challenges, and solutions implemented after the authentication system was completed. This phase focused on building the user profile management system, including image uploads, social links, contact information, and the live preview functionality.

## Table of Contents

1. [Features Implemented](#features-implemented)
2. [Problems Encountered](#problems-encountered)
3. [Solutions and Fixes](#solutions-and-fixes)
4. [Technical Architecture](#technical-architecture)
5. [Lessons Learned](#lessons-learned)

---

## Features Implemented

### 1. Profile Image Upload System

**Description**: Users can upload profile pictures that are stored in S3 and displayed throughout the application.

**Components**:
- `ImageUpload.tsx` - Frontend component for image selection and upload
- S3 presigned URL generation via Lambda function
- Direct S3 upload from frontend
- Automatic metadata saving to DynamoDB

**Key Features**:
- Image preview before upload
- Automatic S3 URL generation
- Metadata (URL and key) stored in DynamoDB profile table
- Real-time preview update

### 2. Social Links Management

**Description**: Users can add and manage social media links that appear on their public profile.

**Supported Platforms**:
- LinkedIn
- GitHub
- X/Twitter
- Instagram
- TikTok
- Threads
- Portfolio
- Behance
- Dribbble

**Components**:
- `SocialLinksPage.tsx` - Management interface
- `SocialIcons.tsx` - SVG icon components with brand colors
- Display in live preview below username

**Key Features**:
- URL validation and formatting
- Icon-based display in preview
- Persistent storage in DynamoDB
- Real-time preview updates

### 3. Contact Information Management

**Description**: Users can add email and phone number with visibility controls.

**Components**:
- `ContactPage.tsx` - Management interface with toggles
- Email and phone fields with icons
- Visibility toggles (show_email, show_phone)

**Key Features**:
- Email format validation
- Phone number validation
- Privacy controls for public visibility
- Email displayed as button below social icons
- Phone displayed as icon with social links

### 4. Live Profile Preview

**Description**: Real-time preview of how the profile appears to visitors.

**Components**:
- `ProfilePreview.tsx` - Mobile-style preview component
- Full-width profile image with gradient overlay
- Social icons in circular white backgrounds
- Email button with rounded corners
- Phone icon integrated with social links

**Key Features**:
- Real-time updates after changes
- Mobile-responsive design
- Visual feedback for hidden fields
- Clickable links (email, phone, social)

### 5. State Management and Auto-Refresh

**Description**: Automatic UI updates when profile data changes.

**Implementation**:
- Custom event system (`profileUpdated` event)
- Automatic Dashboard refresh on profile updates
- State synchronization across components

**Key Features**:
- No page refresh required
- Immediate visual feedback
- Consistent data across all views

---

## Problems Encountered

### Problem 1: S3 Upload Signature Mismatch (403 Forbidden)

**Symptoms**:
- `403 Forbidden` error when uploading images to S3
- Error message: `SignatureDoesNotMatch`
- Uploads failing at the S3 PUT request stage

**Root Cause**:
- Presigned URL was generated without `Content-Type` in the signature
- Browser was sending `Content-Type: image/jpeg` header
- S3 signature validation failed because the header wasn't included in the signed request

**Error Details**:
```
<Error>
  <Code>SignatureDoesNotMatch</Code>
  <Message>The request signature we calculated does not match the signature you provided.</Message>
  <StringToSign>PUT image/jpeg ...</StringToSign>
</Error>
```

### Problem 2: Lambda 500 Internal Server Error

**Symptoms**:
- API Gateway returning 500 errors
- No logs appearing in CloudWatch
- Presigned URL generation failing

**Root Causes**:
1. Lambda function not properly deployed
2. S3 bucket using KMS encryption requiring Signature Version 4
3. Missing error handling in Lambda

**Error Details**:
- HTTP 500 from API Gateway
- No error details in response
- Lambda execution failing silently

### Problem 3: S3 CORS Configuration Error

**Symptoms**:
- Terraform apply failing with `InvalidRequest`
- Error: "Found unsupported HTTP method in CORS config. Unsupported method is OPTIONS"

**Root Cause**:
- S3 automatically handles OPTIONS preflight requests
- Explicitly including OPTIONS in `allowed_methods` causes validation errors

### Problem 4: Image Not Displaying on Frontend

**Symptoms**:
- Image uploaded successfully to S3
- Metadata saved to DynamoDB
- Image not rendering in Dashboard or ProfilePreview
- Console logs showing "Image URL is NOT accessible"

**Root Causes**:
1. Base64 preview not cleared after upload
2. Component not re-rendering with new URL
3. KMS encryption preventing browser access

### Problem 5: KMS Encryption Blocking Browser Access

**Symptoms**:
- Images uploaded but not viewable in browser
- Console errors when trying to load images
- Images accessible via AWS CLI but not browser

**Root Cause**:
- S3 bucket using KMS encryption (aws:kms)
- KMS requires AWS credentials for decryption
- Browsers cannot decrypt KMS-encrypted objects

### Problem 6: Social Links Not Persisting

**Symptoms**:
- Social links saved successfully
- Links disappear after page refresh
- Links cleared when updating other profile fields

**Root Causes**:
1. Lambda overwriting entire profile item on partial updates
2. Frontend not sending complete profile data
3. DynamoDB `put_item` replacing entire record

### Problem 7: UI Not Updating After Saves

**Symptoms**:
- Data saved successfully to database
- Changes not visible until page refresh
- Live preview showing stale data

**Root Cause**:
- Components not refreshing after API calls
- No state synchronization mechanism
- Dashboard only loading data on mount

### Problem 8: Contact Info Not Visible in Preview

**Symptoms**:
- Email and phone saved successfully
- Fields not appearing in ProfilePreview
- Visibility flags not working correctly

**Root Causes**:
1. Lambda only returning email/phone if visibility flags enabled
2. Owner's preview should show all fields regardless of flags
3. Missing visibility flags in API response

---

## Solutions and Fixes

### Solution 1: Include Content-Type in Presigned URL

**Fix Applied**:
```python
# terraform/modules/lambda/upload/main.py
presigned_url = s3_client.generate_presigned_url(
    'put_object',
    Params={
        'Bucket': bucket_name,
        'Key': key,
        'ContentType': content_type,  # Added to signature
    },
    ExpiresIn=300,
    HttpMethod='PUT'
)
```

**Result**: ✅ Uploads now succeed with correct signature validation

### Solution 2: Configure S3 Client for Signature Version 4

**Fix Applied**:
```python
# terraform/modules/lambda/upload/main.py
from botocore.config import Config

s3_client = boto3.client('s3', config=Config(signature_version='s3v4'))
```

**Result**: ✅ Compatible with KMS-encrypted buckets (before switching to AES256)

### Solution 3: Remove OPTIONS from S3 CORS Configuration

**Fix Applied**:
```terraform
# terraform/modules/api/main.tf
resource "aws_s3_bucket_cors_configuration" "assets" {
  cors_rule {
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]  # Removed "OPTIONS"
    allowed_origins = ["*"]
    allowed_headers = ["*"]
  }
}
```

**Result**: ✅ Terraform applies successfully

### Solution 4: Clear Preview and Force Re-render

**Fix Applied**:
```typescript
// frontend/src/components/forms/ImageUpload.tsx
// Clear preview after successful upload
setPreview(null);

// Add key prop to force re-render
<Avatar key={userProfile?.profile_image_url}>
  <AvatarImage src={userProfile?.profile_image_url} />
</Avatar>
```

**Result**: ✅ Images display immediately after upload

### Solution 5: Switch from KMS to AES256 Encryption

**Fix Applied**:
```terraform
# terraform/modules/api/main.tf
resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"  # Changed from "aws:kms"
    }
  }
}
```

**Result**: ✅ Images accessible in browsers without AWS credentials

### Solution 6: Preserve Existing Fields in Lambda Updates

**Fix Applied**:
```python
# terraform/modules/lambda/profiles/main.py
# Fetch existing profile first
existing_profile = profiles_table.get_item(Key={'username': username})
existing_item = existing_profile.get('Item', {}) if 'Item' in existing_profile else {}

# Only update fields explicitly provided, preserve others
social_links_from_body = body.get('social_links')
if (social_links_from_body is not None and 
    isinstance(social_links_from_body, dict) and 
    len(social_links_from_body) > 0):
    social_links = social_links_from_body
else:
    social_links = existing_item.get('social_links', {})
```

**Result**: ✅ Social links persist across updates

### Solution 7: Implement Event-Based State Refresh

**Fix Applied**:
```typescript
// After saving profile data
window.dispatchEvent(new CustomEvent('profileUpdated'));

// In Dashboard component
useEffect(() => {
  const handleProfileUpdate = () => {
    loadProfileData();
  };
  window.addEventListener('profileUpdated', handleProfileUpdate);
  return () => window.removeEventListener('profileUpdated', handleProfileUpdate);
}, []);
```

**Result**: ✅ UI updates immediately without page refresh

### Solution 8: Owner-Specific Profile Data Return

**Fix Applied**:
```python
# terraform/modules/lambda/profiles/main.py
def get_public_profile(username, cors_headers=None, event=None):
    # Check if requester is the profile owner
    is_owner = False
    if event:
        requester_user_id = get_user_id_from_event(event)
        if requester_user_id:
            profile_user_id = profile.get('user_id')
            is_owner = (requester_user_id == profile_user_id)
    
    # Always include visibility flags
    public_profile = {
        # ... other fields
        'show_email': profile.get('show_email', False),
        'show_phone': profile.get('show_phone', False),
    }
    
    # Owner always sees their contact info
    if is_owner:
        if profile.get('email'):
            public_profile['email'] = profile.get('email', '')
        if profile.get('phone'):
            public_profile['phone'] = profile.get('phone', '')
    else:
        # Public view - only if visibility enabled
        if profile.get('show_email'):
            public_profile['email'] = profile.get('email', '')
        if profile.get('show_phone'):
            public_profile['phone'] = profile.get('phone', '')
```

**Result**: ✅ Contact info visible in owner's preview, respects privacy for public

---

## Technical Architecture

### Frontend Components

```
frontend/src/
├── components/
│   ├── forms/
│   │   ├── ImageUpload.tsx          # Image upload with preview
│   │   └── SkillsInput.tsx           # Skills management
│   ├── icons/
│   │   └── SocialIcons.tsx          # Social media SVG icons
│   └── ProfilePreview.tsx           # Live profile preview
├── pages/
│   ├── dashboard/
│   │   ├── ProfilePage.tsx          # Main profile management
│   │   ├── SocialLinksPage.tsx      # Social links management
│   │   └── ContactPage.tsx          # Contact info management
│   └── Dashboard.tsx                # Main dashboard with preview
└── services/
    └── api.ts                        # API client
```

### Backend Architecture

```
terraform/modules/
├── lambda/
│   ├── upload/
│   │   └── main.py                  # S3 presigned URL generation
│   └── profiles/
│       └── main.py                  # Profile CRUD operations
└── api/
    └── main.tf                       # API Gateway + S3 configuration
```

### Data Flow

1. **Image Upload Flow**:
   ```
   Frontend → API Gateway → Lambda (upload) → Generate Presigned URL
   Frontend → S3 (Direct Upload) → Success
   Frontend → API Gateway → Lambda (profiles) → Save Metadata to DynamoDB
   Frontend → Dispatch 'profileUpdated' event → Dashboard refreshes
   ```

2. **Profile Update Flow**:
   ```
   Frontend → API Gateway → Lambda (profiles) → Fetch Existing Profile
   Lambda → Merge Updates → Save to DynamoDB
   Frontend → Dispatch 'profileUpdated' event → Dashboard refreshes
   ```

3. **Profile View Flow**:
   ```
   Frontend → API Gateway → Lambda (profiles) → Check Owner Status
   Lambda → Return Profile Data (with visibility logic)
   Frontend → Update State → Render Preview
   ```

### Database Schema

**DynamoDB - Profiles Table**:
```json
{
  "username": "string (partition key)",
  "user_id": "string",
  "full_name": "string",
  "title": "string",
  "bio": "string",
  "avatar_url": "string (S3 URL)",
  "avatar_key": "string (S3 key)",
  "profile_image_url": "string (legacy, same as avatar_url)",
  "social_links": {
    "linkedin": "url",
    "github": "url",
    ...
  },
  "skills": ["string"],
  "email": "string",
  "phone": "string",
  "show_email": "boolean",
  "show_phone": "boolean",
  "show_resume": "boolean",
  "resume_key": "string",
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```

---

## Lessons Learned

### 1. S3 Presigned URLs

**Key Insight**: Always include all headers that will be sent in the presigned URL parameters. The signature must match exactly what the client sends.

**Best Practice**: Include `ContentType` in the `Params` dictionary when generating presigned URLs for PUT requests.

### 2. DynamoDB Update Patterns

**Key Insight**: `put_item` replaces the entire item. For partial updates, always fetch existing data first and merge.

**Best Practice**: 
- Fetch existing item before updating
- Only update fields explicitly provided in request
- Preserve all other fields from existing item

### 3. Encryption for Public Assets

**Key Insight**: KMS encryption requires AWS credentials for decryption, making it unsuitable for public assets accessed by browsers.

**Best Practice**: Use AES256 (SSE-S3) for publicly accessible objects. Reserve KMS for sensitive data.

### 4. State Management in React

**Key Insight**: Components need a mechanism to refresh when data changes in other components.

**Best Practice**: 
- Use custom events for cross-component communication
- Always reload data after successful API calls
- Implement event listeners in parent components

### 5. API Design for Owner vs Public Views

**Key Insight**: The same endpoint can serve different data based on authentication context.

**Best Practice**:
- Check if requester is the resource owner
- Return full data to owners, filtered data to public
- Always include visibility flags in responses

### 6. Error Handling and Debugging

**Key Insight**: Comprehensive logging is essential for debugging Lambda functions and API Gateway issues.

**Best Practice**:
- Log request bodies, response bodies, and error details
- Use structured logging with context
- Include error types and stack traces

### 7. CORS Configuration

**Key Insight**: S3 handles OPTIONS requests automatically. Don't include OPTIONS in allowed_methods.

**Best Practice**: Only include methods you explicitly need (GET, PUT, POST, HEAD).

### 8. Frontend State Synchronization

**Key Insight**: Local state can become stale after API calls. Always refresh after mutations.

**Best Practice**:
- Reload data after successful saves
- Use events to notify other components
- Implement optimistic updates with rollback on error

---

## Testing Checklist

### Image Upload
- [x] Upload image successfully
- [x] Preview updates immediately
- [x] Image displays in Dashboard
- [x] Image displays in ProfilePreview
- [x] Metadata saved to DynamoDB
- [x] Image accessible via public URL

### Social Links
- [x] Add social links
- [x] Links persist after refresh
- [x] Links not cleared on other updates
- [x] Icons display correctly
- [x] Links clickable in preview

### Contact Information
- [x] Add email and phone
- [x] Toggle visibility controls
- [x] Email displays as button
- [x] Phone displays as icon
- [x] Owner sees all fields
- [x] Public respects visibility flags

### State Management
- [x] Changes visible immediately
- [x] No page refresh required
- [x] Dashboard updates automatically
- [x] Preview updates automatically

---

## Future Improvements

1. **Image Optimization**: Implement image compression and resizing before upload
2. **Error Recovery**: Add retry logic for failed uploads
3. **Loading States**: Better loading indicators during operations
4. **Validation**: Enhanced client-side validation with better error messages
5. **Caching**: Implement client-side caching for profile data
6. **Analytics**: Track profile views and interactions
7. **Accessibility**: Improve ARIA labels and keyboard navigation
8. **Performance**: Optimize bundle size and lazy load components

---

## Conclusion

The post-authentication development phase successfully implemented a comprehensive profile management system with real-time preview capabilities. Despite encountering several challenges related to S3 uploads, state management, and data persistence, all issues were resolved through careful debugging, proper error handling, and architectural improvements.

The system now provides a smooth user experience with immediate visual feedback, proper data persistence, and privacy controls for contact information.

---

**Document Version**: 1.0  
**Last Updated**: November 28, 2025  
**Author**: Development Team

