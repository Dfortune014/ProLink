import json
import os
import boto3
from datetime import datetime
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from botocore.client import Config

dynamodb = boto3.resource('dynamodb')
profiles_table = dynamodb.Table(os.environ['PROFILES_TABLE'])
users_table = dynamodb.Table(os.environ['USERS_TABLE'])

# S3 client for generating presigned URLs
s3_bucket_name = os.environ.get('S3_BUCKET', '')
s3_client = boto3.client('s3', config=Config(signature_version='s3v4')) if s3_bucket_name else None

# Logging helper - only log detailed debug info in non-production environments
ENVIRONMENT = os.environ.get('ENVIRONMENT', 'dev')
IS_DEBUG = ENVIRONMENT != 'production'

def log_debug(message, data=None):
    """Log debug messages only in non-production environments"""
    if IS_DEBUG:
        if data:
            print(f"DEBUG: {message}: {data}")
        else:
            print(f"DEBUG: {message}")

def log_error(message, error=None, include_traceback=False):
    """Log errors - always log, but sanitize in production"""
    if error:
        error_type = type(error).__name__
        print(f"ERROR: {message} - {error_type}: {str(error)}")
        if include_traceback:
            import traceback
            print(traceback.format_exc())
    else:
        print(f"ERROR: {message}")

def log_info(message, data=None):
    """Log informational messages"""
    if data:
        print(f"INFO: {message}: {data}")
    else:
        print(f"INFO: {message}")

# CORS headers - must match origin exactly when using credentials
# Note: When allow_credentials is true, cannot use wildcard '*'
def get_cors_headers(origin=None):
    """Get CORS headers based on request origin"""
    # Get allowed origins from environment variable, fallback to localhost for development
    cors_origins_env = os.environ.get('CORS_ORIGINS', '')
    if cors_origins_env:
        allowed_origins = [origin.strip() for origin in cors_origins_env.split(',') if origin.strip()]
    else:
        # Fallback for development
        allowed_origins = ['http://localhost:8080', 'http://localhost:3000']
    
    # If origin is provided and in allowed list, use it; otherwise use first allowed
    if origin and origin in allowed_origins:
        allowed_origin = origin
    elif origin and origin.startswith('http://localhost') and not cors_origins_env:
        # Allow any localhost port for development only (if no env var set)
        allowed_origin = origin
    elif allowed_origins:
        allowed_origin = allowed_origins[0]  # Default to first allowed origin
    else:
        allowed_origin = '*'  # Fallback (should not happen in production)
    
    return {
        'Access-Control-Allow-Origin': allowed_origin,
        'Access-Control-Allow-Credentials': 'true',  # Required when using Authorization header
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '300',
        'Content-Type': 'application/json'
    }

# Default CORS headers for backward compatibility
CORS_HEADERS = get_cors_headers()

def _get_resume_url_from_key(resume_key):
    """Generate presigned S3 URL from resume key (15 minutes expiration)"""
    print(f"DEBUG: _get_resume_url_from_key called with key: {resume_key}")
    print(f"DEBUG: s3_client exists: {s3_client is not None}, s3_bucket_name: {s3_bucket_name}")
    
    if not resume_key:
        print("WARN: resume_key is empty or None")
        return None
    
    if not s3_client:
        print("ERROR: s3_client is not initialized")
        return None
    
    if not s3_bucket_name:
        print("ERROR: s3_bucket_name is not set")
        return None
    
    try:
        print(f"DEBUG: Generating presigned URL for bucket: {s3_bucket_name}, key: {resume_key}")
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': s3_bucket_name,
                'Key': resume_key,
            },
            ExpiresIn=900,  # 15 minutes
            HttpMethod='GET'
        )
        print(f"DEBUG: Successfully generated presigned URL: {presigned_url[:100]}...")
        return presigned_url
    except Exception as e:
        print(f"ERROR: Failed to generate presigned URL for resume: {str(e)}")
        import traceback
        print(f"ERROR: Traceback: {traceback.format_exc()}")
        return None

def _get_resume_url(profile):
    """Get resume URL from profile, generating presigned URL from resume_key if needed"""
    print(f"DEBUG: _get_resume_url called with profile keys: {list(profile.keys()) if profile else 'None'}")
    resume_url = profile.get('resume_url') or profile.get('resumeUrl')
    resume_key = profile.get('resume_key')
    
    print(f"DEBUG: _get_resume_url - resume_url: {resume_url}, resume_key: {resume_key}")
    
    # If resume_url exists but is a direct S3 URL (not presigned), regenerate as presigned
    if resume_url and 's3.amazonaws.com' in resume_url and 'X-Amz-Signature' not in resume_url:
        print("DEBUG: resume_url is direct S3 URL (not presigned), regenerating...")
        if resume_key:
            new_url = _get_resume_url_from_key(resume_key)
            print(f"DEBUG: Regenerated URL: {new_url[:100] if new_url else 'None'}...")
            return new_url or resume_url
        return resume_url
    
    if resume_url:
        print(f"DEBUG: Using existing resume_url: {resume_url[:100]}...")
        return resume_url
    
    # If resume_key exists but resume_url doesn't, generate the presigned URL
    if resume_key:
        print(f"DEBUG: resume_key exists but no resume_url, generating from key...")
        generated_url = _get_resume_url_from_key(resume_key)
        if generated_url:
            print(f"DEBUG: Generated resume_url from key: {generated_url[:100]}...")
            return generated_url
        else:
            print("WARN: Failed to generate resume_url from key")
    else:
        print("DEBUG: No resume_key found in profile")
    
    print("DEBUG: Returning empty string for resume_url")
    return ''

def _get_avatar_url_from_key(avatar_key):
    """Generate presigned S3 URL from avatar key (15 minutes expiration)"""
    if not avatar_key or not s3_client or not s3_bucket_name:
        return None
    
    try:
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': s3_bucket_name,
                'Key': avatar_key,
            },
            ExpiresIn=900,  # 15 minutes
            HttpMethod='GET'
        )
        return presigned_url
    except Exception as e:
        print(f"ERROR: Failed to generate presigned URL for avatar: {str(e)}")
        return None

def get_user_id_from_event(event):
    """Extract user_id from JWT claims"""
    try:
        # Try HTTP API v2 format first: requestContext.authorizer.claims
        request_context = event.get('requestContext', {})
        authorizer = request_context.get('authorizer', {})
        
        # HTTP API v2 format: authorizer.claims.sub
        claims = authorizer.get('claims', {})
        if claims:
            user_id = claims.get('sub')
            if user_id:
                log_debug("Extracted user_id from HTTP API v2 format")
                return user_id
        
        # Fallback to HTTP API v1 format: authorizer.jwt.claims
        jwt = authorizer.get('jwt', {})
        claims = jwt.get('claims', {})
        if claims:
            user_id = claims.get('sub')
            if user_id:
                log_debug("Extracted user_id from HTTP API v1 format")
                return user_id
        
        log_debug("No user_id found in authorizer claims")
        if IS_DEBUG:
            # Only log authorizer structure in debug mode (may contain sensitive data)
            print(f"DEBUG: Authorizer keys: {list(authorizer.keys())}")
        return None
    except Exception as e:
        log_error("Error extracting user_id", e, include_traceback=IS_DEBUG)
        return None

def handler(event, context):
    # Log invocation start (minimal info)
    log_info("Lambda invocation started")
    if IS_DEBUG:
        print(f"DEBUG: Event keys: {list(event.keys())}")
        # Only log full event in debug mode (may contain sensitive data)
        # print(f"DEBUG: Full event: {json.dumps(event, default=str)}")
    
    # Get origin from request headers for CORS
    request_headers = event.get('headers', {}) or {}
    origin = request_headers.get('origin') or request_headers.get('Origin') or None
    
    # Try API Gateway HTTP API v2 format first
    request_context = event.get('requestContext', {})
    http_context = request_context.get('http', {})
    http_method = http_context.get('method')
    path = http_context.get('path') or event.get('rawPath')
    
    log_debug(f"HTTP API v2 - method: {http_method}, path: {path}")
    
    # Fallback to API Gateway v1 format if v2 format not found
    if not http_method:
        http_method = request_context.get('httpMethod')
        log_debug(f"Fallback to v1 - method: {http_method}")
    if not path:
        path = event.get('path') or request_context.get('path')
        log_debug(f"Fallback path: {path}")
    
    log_debug(f"Final method: {http_method}, Final path: {path}")
    if IS_DEBUG:
        # Only log headers/query params in debug mode (may contain sensitive data)
        log_debug(f"Headers keys: {list(request_headers.keys())}")
        log_debug(f"Query params: {event.get('queryStringParameters', {})}")
    
    # Get CORS headers for this request (will be used by all functions)
    cors_headers = get_cors_headers(origin)
    
    try:
        # Handle OPTIONS (CORS preflight) first, before path normalization
        if http_method == 'OPTIONS':
            log_debug("OPTIONS request detected - Handling CORS preflight")
            # Handle CORS preflight for any endpoint
            # Get the origin from the request headers for proper CORS response
            request_headers = event.get('headers', {}) or {}
            origin = request_headers.get('origin') or request_headers.get('Origin') or '*'
            
            # Get CORS headers with proper origin and credentials
            cors_response_headers = get_cors_headers(origin)
            
            log_debug(f"OPTIONS response - origin: {origin}")
            
            response = {
                'statusCode': 200,
                'headers': cors_response_headers,
                'body': ''
            }
            
            return response
        
        # Normalize path (remove trailing slash, handle query params)
        if path:
            # Remove query string if present
            path = path.split('?')[0]
            path = path.rstrip('/')
        
        # Check if this is the username check endpoint
        if http_method == 'GET' and path and '/username/check' in path:
            log_debug("Routing to check_username_availability")
            return check_username_availability(event, cors_headers)
        elif http_method == 'GET' and path == '/users/me':
            log_debug("Routing to get_current_user_profile")
            return get_current_user_profile(event, cors_headers)
        elif http_method == 'POST' and path == '/profiles':
            log_debug("Routing to create_or_update_profile")
            return create_or_update_profile(event, cors_headers)
        elif http_method == 'GET' and path.startswith('/profiles/'):
            username = path.split('/')[-1]
            log_debug(f"Routing to get_public_profile for username: {username}")
            # Pass event to check if requester is the owner
            return get_public_profile(username, cors_headers, event)
        else:
            log_debug(f"Method not allowed - method: {http_method}, path: {path}")
            return {
                'statusCode': 405,
                'headers': cors_headers,
                'body': json.dumps({'error': 'Method not allowed'})
            }
    except Exception as e:
        log_error("Error in handler", e, include_traceback=IS_DEBUG)
        cors_headers_final = cors_headers if 'cors_headers' in locals() else get_cors_headers()
        
        return {
            'statusCode': 500,
            'headers': cors_headers_final,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': 'An error occurred processing your request'
            })
        }

def create_or_update_profile(event, cors_headers=None):
    """POST /profiles - Create or update profile"""
    log_info("create_or_update_profile called")
    
    if cors_headers is None:
        cors_headers = get_cors_headers()
    
    user_id = get_user_id_from_event(event)
    log_debug("Extracted user_id")
    
    if not user_id:
        log_error("No user_id found in event - returning 401")
        return {
            'statusCode': 401,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Unauthorized', 'message': 'No user_id found in JWT claims'})
        }
    
    log_info(f"Processing profile creation/update for user_id: {user_id}")
    
    try:
        body = json.loads(event.get('body', '{}'))
    except json.JSONDecodeError as e:
        log_error("Invalid JSON in request body", e)
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Invalid JSON', 'message': 'Request body must be valid JSON'})
        }
    
    log_debug(f"Request body keys: {list(body.keys())}")
    
    # Validate required fields
    username = body.get('username')
    if not username:
        return {
            'statusCode': 400,
            'headers': cors_headers if cors_headers else get_cors_headers(),
            'body': json.dumps({'error': 'username is required'})
        }
    
    # Check if username is already taken by another user
    try:
        existing = profiles_table.get_item(Key={'username': username})
        if 'Item' in existing and existing['Item'].get('user_id') != user_id:
            return {
                'statusCode': 409,
                'headers': cors_headers if cors_headers else get_cors_headers(),
                'body': json.dumps({'error': 'Username already taken'})
            }
    except ClientError as e:
        # Log detailed error for debugging
        log_error("Database error checking username availability", e, include_traceback=IS_DEBUG)
        
        # Return generic error to user
        return {
            'statusCode': 500,
            'headers': cors_headers if cors_headers else get_cors_headers(),
            'body': json.dumps({'error': 'Internal server error', 'message': 'An error occurred processing your request'})
        }
    
    # Get or update user record
    try:
        user = users_table.get_item(Key={'user_id': user_id})
        # Get claims from authorizer (HTTP API v2 format: authorizer.claims)
        authorizer = event.get('requestContext', {}).get('authorizer', {})
        claims = authorizer.get('claims', {}) or authorizer.get('jwt', {}).get('claims', {})
        now = datetime.utcnow().isoformat()
        
        if 'Item' not in user:
            # Create user record
            user_item = {
                'user_id': user_id,
                'email': claims.get('email', ''),
                'username': username,
                'created_at': now,
                'updated_at': now,
                'profile_complete': True
            }
            # Add date_of_birth if provided
            date_of_birth = body.get('date_of_birth')
            if date_of_birth:
                user_item['date_of_birth'] = date_of_birth
            users_table.put_item(Item=user_item)
        else:
            # Update existing user record with username and date_of_birth if provided
            update_expression = "SET username = :u, updated_at = :up, profile_complete = :pc"
            expression_attribute_values = {
                ':u': username,
                ':up': now,
                ':pc': True
            }
            
            date_of_birth = body.get('date_of_birth')
            if date_of_birth:
                update_expression += ", date_of_birth = :dob"
                expression_attribute_values[':dob'] = date_of_birth
            
            users_table.update_item(
                Key={'user_id': user_id},
                UpdateExpression=update_expression,
                ExpressionAttributeValues=expression_attribute_values
            )
    except ClientError as e:
        # Log detailed error for debugging
        log_error("Database error updating user record", e, include_traceback=IS_DEBUG)
        
        # Return generic error to user
        return {
            'statusCode': 500,
            'headers': cors_headers if cors_headers else get_cors_headers(),
            'body': json.dumps({'error': 'Internal server error', 'message': 'An error occurred processing your request'})
        }
    
    # Check if profile exists first to preserve existing fields
    existing_profile = profiles_table.get_item(Key={'username': username})
    existing_item = existing_profile.get('Item', {}) if 'Item' in existing_profile else {}
    
    # Prepare profile item
    # Extract avatar_key from profile_image_url if it's an S3 URL
    # Only use body values if they're explicitly provided, otherwise use existing
    profile_image_url = body.get('profile_image_url') or body.get('avatarUrl')
    if not profile_image_url:
        profile_image_url = existing_item.get('profile_image_url') or existing_item.get('avatar_url', '')
    
    avatar_key = body.get('avatar_key')
    if not avatar_key:
        avatar_key = existing_item.get('avatar_key', '')
    
    # If profile_image_url is an S3 URL, extract the key
    if profile_image_url and 's3.amazonaws.com' in profile_image_url and not avatar_key:
        # Extract key from URL: https://bucket.s3.amazonaws.com/users/xxx/profile/file.jpg
        try:
            parts = profile_image_url.split('.s3.amazonaws.com/')
            if len(parts) > 1:
                avatar_key = parts[1]
        except:
            pass
    
    # Build profile item, preserving existing values if not provided in body
    # For social_links, only update if provided and not empty
    social_links_from_body = body.get('social_links')
    existing_social_links = existing_item.get('social_links', {})
    
    print(f"DEBUG: social_links from body: {social_links_from_body}, type: {type(social_links_from_body)}")
    print(f"DEBUG: existing social_links: {existing_social_links}, type: {type(existing_social_links)}")
    
    # Only use body value if it's a non-empty dict
    if (social_links_from_body is not None and 
        isinstance(social_links_from_body, dict) and 
        len(social_links_from_body) > 0):
        social_links = social_links_from_body
        print(f"DEBUG: Using social_links from body: {social_links}")
    else:
        # Preserve existing, but ensure it's a dict
        if isinstance(existing_social_links, dict) and len(existing_social_links) > 0:
            social_links = existing_social_links
            print(f"DEBUG: Preserving existing social_links: {social_links}")
        else:
            # If existing is also empty/invalid, use empty dict
            social_links = {}
            print(f"DEBUG: No valid social_links found, using empty dict")
    
    # For skills, only update if provided and not empty list
    skills_from_body = body.get('skills')
    if skills_from_body is not None and isinstance(skills_from_body, list):
        skills = skills_from_body
    else:
        skills = existing_item.get('skills', [])
    
    # For projects, only update if provided and not empty list
    projects_from_body = body.get('projects')
    existing_projects = existing_item.get('projects', [])
    
    print(f"DEBUG: projects from body: {projects_from_body}, type: {type(projects_from_body)}")
    print(f"DEBUG: existing projects: {existing_projects}, type: {type(existing_projects)}")
    
    # Only use body value if it's a non-empty list
    if (projects_from_body is not None and 
        isinstance(projects_from_body, list) and 
        len(projects_from_body) > 0):
        projects = projects_from_body
        print(f"DEBUG: Using projects from body: {len(projects)} projects")
        # Debug: Check if tech_stack is present in projects
        for idx, project in enumerate(projects):
            if isinstance(project, dict):
                tech_stack = project.get('tech_stack')
                print(f"DEBUG: Project {idx} tech_stack: {tech_stack}, type: {type(tech_stack)}")
    else:
        # Preserve existing, but ensure it's a list
        if isinstance(existing_projects, list) and len(existing_projects) > 0:
            projects = existing_projects
            print(f"DEBUG: Preserving existing projects: {len(projects)} projects")
            # Debug: Check if tech_stack is present in existing projects
            for idx, project in enumerate(projects):
                if isinstance(project, dict):
                    tech_stack = project.get('tech_stack')
                    print(f"DEBUG: Existing project {idx} tech_stack: {tech_stack}, type: {type(tech_stack)}")
        else:
            # If existing is also empty/invalid, use empty list
            projects = []
            print(f"DEBUG: No valid projects found, using empty list")
    
    profile_item = {
        'username': username,
        'user_id': user_id,
        'full_name': body.get('full_name') or body.get('displayName') or existing_item.get('full_name', ''),
        'title': body.get('title') if 'title' in body else existing_item.get('title', ''),
        'bio': body.get('bio') if 'bio' in body else existing_item.get('bio', ''),
        'skills': skills,
        'social_links': social_links,
        'projects': projects,
        # Store both key (internal reference) and URL (public access)
        'avatar_key': avatar_key,
        'avatar_url': profile_image_url,
        # Keep profile_image_url for backward compatibility
        'profile_image_url': profile_image_url,
        'email': body.get('email') if 'email' in body else existing_item.get('email', ''),
        'phone': body.get('phone') if 'phone' in body else existing_item.get('phone', ''),
        'show_email': body.get('show_email') if 'show_email' in body else existing_item.get('show_email', False),
        'show_phone': body.get('show_phone') if 'show_phone' in body else existing_item.get('show_phone', False),
        'show_resume': body.get('show_resume') if 'show_resume' in body else existing_item.get('show_resume', False),
        'updated_at': datetime.utcnow().isoformat()
    }
    
    # Handle favorite_color - always set it if provided, otherwise preserve existing
    favorite_color_from_body = body.get('favorite_color')
    if favorite_color_from_body is not None:
        profile_item['favorite_color'] = favorite_color_from_body
        print(f"DEBUG: Setting favorite_color from body: {favorite_color_from_body}")
    elif 'favorite_color' in existing_item:
        profile_item['favorite_color'] = existing_item.get('favorite_color', '')
        print(f"DEBUG: Preserving existing favorite_color: {existing_item.get('favorite_color', '')}")
    else:
        # If not in body and not in existing, set to empty string (or default)
        profile_item['favorite_color'] = ''
        print(f"DEBUG: No favorite_color found, setting to empty string")
    
    # Handle resume_key and resume_url - generate URL from key if not provided
    resume_key_from_body = body.get('resume_key')
    resume_url_from_body = body.get('resume_url')
    
    # Determine which resume_key to use (from body or existing)
    resume_key_to_use = resume_key_from_body if resume_key_from_body else existing_item.get('resume_key', '')
    if resume_key_to_use:
        profile_item['resume_key'] = resume_key_to_use
    
    # Set resume_url: ALWAYS generate from key if key exists, unless a valid URL is explicitly provided
    if resume_url_from_body and resume_url_from_body.strip():
        # Use provided URL if it's non-empty and valid
        profile_item['resume_url'] = resume_url_from_body
        print(f"DEBUG: Using provided resume_url: {resume_url_from_body}")
    elif resume_key_to_use:
        # CRITICAL: Always generate URL from key if we have a key
        generated_url = _get_resume_url_from_key(resume_key_to_use)
        if generated_url:
            profile_item['resume_url'] = generated_url
            print(f"DEBUG: Generated resume_url from key: {generated_url}")
        else:
            # Fallback: construct URL manually if S3_BUCKET not set
            bucket_name = os.environ.get('S3_BUCKET', '')
            if bucket_name:
                fallback_url = f"https://{bucket_name}.s3.amazonaws.com/{resume_key_to_use}"
                profile_item['resume_url'] = fallback_url
                print(f"DEBUG: Generated fallback resume_url: {fallback_url}")
            else:
                print(f"ERROR: Cannot generate resume_url - S3_BUCKET not set and key exists: {resume_key_to_use}")
                # Still try to keep existing URL if available
                if 'resume_url' in existing_item:
                    profile_item['resume_url'] = existing_item.get('resume_url', '')
    elif 'resume_url' in existing_item:
        # Keep existing resume_url if no key
        profile_item['resume_url'] = existing_item.get('resume_url', '')
    
    # Add date_of_birth if provided (for social logins completing profile)
    date_of_birth = body.get('date_of_birth')
    if date_of_birth:
        profile_item['date_of_birth'] = date_of_birth
    elif 'date_of_birth' in existing_item:
        profile_item['date_of_birth'] = existing_item['date_of_birth']
    
    if 'Item' not in existing_profile:
        profile_item['created_at'] = datetime.utcnow().isoformat()
        print(f"Creating new profile record for username: {username}")
    else:
        # Preserve created_at from existing profile
        profile_item['created_at'] = existing_item.get('created_at', datetime.utcnow().isoformat())
        print(f"Updating existing profile record for username: {username}")
        print(f"DEBUG: Preserving existing fields, social_links from body: {body.get('social_links')}")
        print(f"DEBUG: Final social_links in profile_item: {profile_item.get('social_links')}")
    
    # Debug: Log resume fields and favorite_color before saving
    print(f"DEBUG: Saving profile with resume_key: {profile_item.get('resume_key', 'NOT SET')}")
    print(f"DEBUG: Saving profile with resume_url: {profile_item.get('resume_url', 'NOT SET')}")
    print(f"DEBUG: Saving profile with favorite_color: {profile_item.get('favorite_color', 'NOT SET')}")
    print(f"DEBUG: S3_BUCKET env var available: {bool(os.environ.get('S3_BUCKET', ''))}")
    
    # Debug: Log projects with tech_stack before saving
    print(f"DEBUG: Saving profile with {len(profile_item.get('projects', []))} projects")
    for idx, project in enumerate(profile_item.get('projects', [])):
        if isinstance(project, dict):
            print(f"DEBUG: Project {idx} being saved: title={project.get('title')}, tech_stack={project.get('tech_stack')}, all_keys={list(project.keys())}")
    
    try:
        profiles_table.put_item(Item=profile_item)
        print(f"✓ Successfully saved profile record for username: {username}")
        return {
            'statusCode': 200,
            'headers': cors_headers if cors_headers else get_cors_headers(),
            'body': json.dumps({'message': 'Profile saved successfully', 'profile': profile_item})
        }
    except ClientError as e:
        # Log detailed error for debugging
        log_error("Database error saving profile record", e, include_traceback=IS_DEBUG)
        
        # Return generic error to user
        return {
            'statusCode': 500,
            'headers': cors_headers if cors_headers else get_cors_headers(),
            'body': json.dumps({'error': 'Internal server error', 'message': 'An error occurred saving your profile'})
        }

def get_current_user_profile(event, cors_headers=None):
    """GET /users/me - Get current user's profile status from users table"""
    if cors_headers is None:
        cors_headers = get_cors_headers()
    
    print("=" * 80)
    print("get_current_user_profile CALLED")
    print("=" * 80)
    
    user_id = get_user_id_from_event(event)
    print(f"DEBUG: Extracted user_id: {user_id}")
    
    if not user_id:
        print("ERROR: No user_id found in event - returning 401")
        return {
            'statusCode': 401,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Unauthorized', 'message': 'No user_id found in JWT claims'})
        }
    
    try:
        print(f"DEBUG: Querying users table for user_id: {user_id}")
        user = users_table.get_item(Key={'user_id': user_id})
        
        if 'Item' not in user:
            print(f"DEBUG: User not found in users table for user_id: {user_id}")
            return {
                'statusCode': 404,
                'headers': cors_headers,
                'body': json.dumps({
                    'error': 'User not found',
                    'profile_complete': False,
                    'username': None
                })
            }
        
        user_item = user['Item']
        print(f"DEBUG: User found: {json.dumps(user_item, default=str)}")
        
        result = {
            'user_id': user_item.get('user_id'),
            'username': user_item.get('username'),
            'email': user_item.get('email'),
            'profile_complete': user_item.get('profile_complete', False),
            'date_of_birth': user_item.get('date_of_birth'),
            'fullname': user_item.get('fullname')
        }
        
        print(f"DEBUG: Returning user profile: {json.dumps(result, default=str)}")
        print("=" * 80)
        print("get_current_user_profile COMPLETED SUCCESSFULLY")
        print("=" * 80)
        
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps(result)
        }
    except ClientError as e:
        # Log detailed error for debugging
        log_error("Database error retrieving current user profile", e, include_traceback=IS_DEBUG)
        
        # Return generic error to user
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Internal server error', 'message': 'An error occurred retrieving your profile'})
        }
    except Exception as e:
        print(f"ERROR: Unexpected error: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': f'Internal server error: {str(e)}'})
        }

def get_public_profile(username, cors_headers=None, event=None):
    """GET /profiles/{username} - Get public profile"""
    if cors_headers is None:
        cors_headers = get_cors_headers()
    
    try:
        response = profiles_table.get_item(Key={'username': username})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': cors_headers,
                'body': json.dumps({'error': 'Profile not found'})
            }
        
        profile = response['Item']
        
        # Check if requester is the profile owner
        is_owner = False
        if event:
            requester_user_id = get_user_id_from_event(event)
            if requester_user_id:
                profile_user_id = profile.get('user_id')
                is_owner = (requester_user_id == profile_user_id)
        
        # Get user's links (if LINKS_TABLE is configured)
        links = []
        try:
            links_table_name = os.environ.get('LINKS_TABLE', '')
            if links_table_name:
                links_table = dynamodb.Table(links_table_name)
                links_response = links_table.query(
                    KeyConditionExpression=Key('user_id').eq(profile['user_id']),
                    FilterExpression='is_deleted = :false',
                    ExpressionAttributeValues={':false': False}
                )
                links = sorted(links_response.get('Items', []), key=lambda x: x.get('order', 0))
        except Exception as links_error:
            # If links table doesn't exist or query fails, just continue without links
            print(f"WARNING: Could not fetch links: {str(links_error)}")
            links = []
        
        # Build public profile response
        # Prefer avatar_url, fallback to profile_image_url for backward compatibility
        avatar_url = profile.get('avatar_url') or profile.get('profile_image_url', '')
        avatar_key = profile.get('avatar_key')
        
        # If avatar_url is a direct S3 URL (not presigned), generate presigned URL from key
        if avatar_url and 's3.amazonaws.com' in avatar_url and 'X-Amz-Signature' not in avatar_url:
            if avatar_key:
                presigned_avatar_url = _get_avatar_url_from_key(avatar_key)
                if presigned_avatar_url:
                    avatar_url = presigned_avatar_url
        # If no avatar_url but we have avatar_key, generate presigned URL
        elif not avatar_url and avatar_key:
            avatar_url = _get_avatar_url_from_key(avatar_key) or ''
        
        # Get social_links from profile, ensure it's a dict
        social_links = profile.get('social_links', {})
        if not isinstance(social_links, dict):
            print(f"WARNING: social_links is not a dict, type: {type(social_links)}, value: {social_links}")
            social_links = {}
        
        print(f"DEBUG: Returning social_links: {social_links}, type: {type(social_links)}, keys: {list(social_links.keys()) if isinstance(social_links, dict) else 'N/A'}")
        
        # Get projects from profile, ensure it's a list
        projects = profile.get('projects', [])
        if not isinstance(projects, list):
            print(f"WARNING: projects is not a list, type: {type(projects)}, value: {projects}")
            projects = []
        
        print(f"DEBUG: Returning projects: {len(projects)} projects, type: {type(projects)}")
        # Debug: Check if tech_stack is present in projects being returned
        for idx, project in enumerate(projects):
            if isinstance(project, dict):
                tech_stack = project.get('tech_stack')
                print(f"DEBUG: Returning project {idx} tech_stack: {tech_stack}, type: {type(tech_stack)}")
                print(f"DEBUG: Returning project {idx} keys: {list(project.keys())}")
        
        public_profile = {
            'username': profile['username'],
            'full_name': profile.get('full_name', ''),
            'title': profile.get('title', ''),
            'bio': profile.get('bio', ''),
            'skills': profile.get('skills', []),
            'social_links': social_links,
            'projects': projects,
            'profile_image_url': avatar_url,  # Use avatar_url if available
            'avatar_url': avatar_url,
            'links': [{'title': l.get('title'), 'url': l.get('url')} for l in links],
            # Resume URL - always include if present
            # If resume_url doesn't exist but resume_key does, generate the URL from key
            'resume_url': _get_resume_url(profile),
            # Always include visibility flags
            'show_email': profile.get('show_email', False),
            'show_phone': profile.get('show_phone', False),
            'show_resume': profile.get('show_resume', False),
            'favorite_color': profile.get('favorite_color') or ''
        }
        
        # Add contact info - always include for owner, conditionally for public
        if is_owner:
            # Owner always sees their own contact info
            if profile.get('email'):
                public_profile['email'] = profile.get('email', '')
            if profile.get('phone'):
                public_profile['phone'] = profile.get('phone', '')
        else:
            # Public view - only if visibility flags are enabled
            if profile.get('show_email'):
                public_profile['email'] = profile.get('email', '')
            if profile.get('show_phone'):
                public_profile['phone'] = profile.get('phone', '')
        
        if profile.get('show_resume') and profile.get('resume_key'):
            public_profile['resume_key'] = profile.get('resume_key')
        
        # Debug: Log resume_url
        print(f"DEBUG: Profile resume_url: {profile.get('resume_url')}, resumeUrl: {profile.get('resumeUrl')}, resume_key: {profile.get('resume_key')}")
        generated_resume_url = _get_resume_url(profile)
        print(f"DEBUG: Generated resume_url: {generated_resume_url}")
        print(f"DEBUG: Public profile resume_url: {public_profile.get('resume_url')}")
        print(f"DEBUG: Full public_profile keys: {list(public_profile.keys())}")
        print(f"DEBUG: Full public_profile resume data: {json.dumps({k: v for k, v in public_profile.items() if 'resume' in k.lower()})}")
        print(f"DEBUG: S3_BUCKET env var: {os.environ.get('S3_BUCKET', 'NOT SET')}")
        
        # Ensure all data is JSON serializable
        try:
            # Test serialization before returning
            json.dumps(public_profile, default=str)
            print(f"DEBUG: Successfully serialized public_profile")
        except Exception as json_error:
            print(f"ERROR: Failed to serialize public_profile: {str(json_error)}")
            print(f"DEBUG: public_profile keys: {list(public_profile.keys())}")
            print(f"DEBUG: projects type: {type(public_profile.get('projects'))}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            # Try to fix projects if it's the issue
            if 'projects' in public_profile:
                try:
                    # Ensure projects is a list of serializable dicts
                    projects_list = public_profile['projects']
                    if isinstance(projects_list, list):
                        # Convert any non-serializable items
                        public_profile['projects'] = [
                            {k: str(v) if not isinstance(v, (str, int, float, bool, type(None))) else v 
                             for k, v in (p.items() if isinstance(p, dict) else {})} 
                            for p in projects_list
                        ]
                except Exception as fix_error:
                    print(f"ERROR: Failed to fix projects: {str(fix_error)}")
                    public_profile['projects'] = []
        
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps(public_profile, default=str)
        }
    except ClientError as e:
        # Log detailed error for debugging
        log_error("Database error retrieving public profile", e, include_traceback=IS_DEBUG)
        
        # Return generic error to user
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Internal server error', 'message': 'An error occurred retrieving the profile'})
        }
    except Exception as e:
        import traceback
        print(f"ERROR: Unexpected error in get_public_profile: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Internal server error', 'message': str(e)})
        }

def check_username_availability(event, cors_headers=None):
    """GET /username/check?username=xxx - Check if username is available"""
    if cors_headers is None:
        cors_headers = get_cors_headers()
    
    print("=" * 80)
    print("check_username_availability CALLED")
    print("=" * 80)
    print(f"Event: {json.dumps(event, default=str)}")
    try:
        # Handle both API Gateway v1 and v2 event formats
        query_params = event.get('queryStringParameters') or {}
        print(f"DEBUG: queryStringParameters: {query_params}")
        if query_params is None:
            query_params = {}
        
        # Also try multiValueQueryStringParameters (API Gateway v1 format)
        if not query_params and event.get('multiValueQueryStringParameters'):
            multi_params = event.get('multiValueQueryStringParameters', {})
            print(f"DEBUG: multiValueQueryStringParameters: {multi_params}")
            query_params = {k: v[0] if isinstance(v, list) and len(v) > 0 else v 
                          for k, v in multi_params.items()}
        
        username = query_params.get('username', '').strip().lower()
        print(f"DEBUG: Extracted username: '{username}'")
        
        if not username:
            return {
                'statusCode': 400,
                'headers': cors_headers if cors_headers else get_cors_headers(),
                'body': json.dumps({'error': 'Username parameter is required'})
            }
        
        # Validate username format (alphanumeric, underscore, hyphen, 3-20 chars)
        import re
        if not re.match(r'^[a-z0-9_-]{3,20}$', username):
            return {
                'statusCode': 400,
                'headers': cors_headers if cors_headers else get_cors_headers(),
                'body': json.dumps({
                    'available': False,
                    'error': 'Username must be 3-20 characters and contain only letters, numbers, underscores, and hyphens'
                })
            }
        
        try:
            # Check if username exists in profiles table
            print(f"DEBUG: Checking DynamoDB for username: {username}")
            response = profiles_table.get_item(Key={'username': username})
            available = 'Item' not in response
            print(f"DEBUG: Username availability check - available: {available}")
            
            result = {
                'statusCode': 200,
                'headers': cors_headers if cors_headers else get_cors_headers(),
                'body': json.dumps({
                    'available': available,
                    'username': username
                })
            }
            print(f"DEBUG: Returning result: {json.dumps(result, default=str)}")
            print("=" * 80)
            print("check_username_availability COMPLETED SUCCESSFULLY")
            print("=" * 80)
            return result
            
        except ClientError as db_error:
            return {
                'statusCode': 500,
                'headers': cors_headers if cors_headers else get_cors_headers(),
                'body': json.dumps({
                    'error': 'Database error',
                    'message': str(db_error)
                })
            }
        except Exception as db_error:
            return {
                'statusCode': 500,
                'headers': cors_headers if cors_headers else get_cors_headers(),
                'body': json.dumps({
                    'error': 'Database error',
                    'message': str(db_error)
                })
            }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': cors_headers if cors_headers else get_cors_headers(),
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e),
                'error_type': type(e).__name__
            })
        }