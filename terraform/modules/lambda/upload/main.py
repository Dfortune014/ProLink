import json
import os
import boto3
import uuid
from datetime import datetime, timedelta
from botocore.exceptions import ClientError, ParamValidationError
from botocore.client import Config

# Use Signature Version 4 (required for KMS-encrypted buckets)
s3_client = boto3.client('s3', config=Config(signature_version='s3v4'))
bucket_name = os.environ['S3_BUCKET']

# Allowed MIME types
ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
ALLOWED_RESUME_TYPES = ['application/pdf']

# CORS headers - must match origin exactly when using credentials
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
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '300',
        'Content-Type': 'application/json'
    }

def get_user_id_from_event(event):
    """Extract user_id from JWT claims"""
    try:
        # Try HTTP API v2 format first
        request_context = event.get('requestContext', {})
        authorizer = request_context.get('authorizer', {})
        
        # HTTP API v2 format: authorizer.claims.sub
        claims = authorizer.get('claims', {})
        if claims:
            user_id = claims.get('sub')
            if user_id:
                return user_id
        
        # Fallback to HTTP API v1 format: authorizer.jwt.claims
        jwt = authorizer.get('jwt', {})
        claims = jwt.get('claims', {})
        if claims:
            user_id = claims.get('sub')
            if user_id:
                return user_id
        
        return None
    except Exception as e:
        print(f"Error extracting user_id: {str(e)}")
        return None

def handler(event, context):
    # Default CORS headers in case of early error
    default_cors_headers = get_cors_headers()
    
    try:
        # Debug: Log the event structure
        print("=" * 80)
        print("UPLOAD LAMBDA INVOCATION START")
        print("=" * 80)
        print(f"Event keys: {list(event.keys())}")
        print(f"Event: {json.dumps(event, default=str)}")
        
        # Get origin from request headers for CORS
        request_headers = event.get('headers', {}) or {}
        origin = request_headers.get('origin') or request_headers.get('Origin') or None
        print(f"DEBUG: Origin: {origin}")
        
        # Get CORS headers
        cors_headers = get_cors_headers(origin)
        
        # Try API Gateway HTTP API v2 format first
        request_context = event.get('requestContext', {})
        http_context = request_context.get('http', {})
        http_method = http_context.get('method')
        
        # Fallback to top-level httpMethod or requestContext.httpMethod
        if not http_method:
            http_method = event.get('httpMethod') or request_context.get('httpMethod')
        
        print(f"DEBUG: HTTP method: {http_method}, event keys: {list(event.keys())}")
        
        # Handle OPTIONS (CORS preflight)
        if http_method == 'OPTIONS':
            print("DEBUG: Handling OPTIONS request")
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': ''
            }
        
        # Handle GET requests for presigned download URLs
        if http_method == 'GET':
            # Check if this is a public endpoint
            # Try multiple path sources to handle different API Gateway formats
            path = http_context.get('path') or event.get('rawPath') or ''
            if not path:
                path = event.get('path') or request_context.get('path') or ''
            
            # Also check route key for API Gateway v2
            route_key = http_context.get('routeKey') or request_context.get('routeKey') or ''
            
            # Check resourcePath as well (from the event you showed)
            resource_path = request_context.get('resourcePath') or ''
            
            print(f"DEBUG: GET request - path: {path}, route_key: {route_key}, resource_path: {resource_path}")
            
            # Check if this is the public endpoint (try all possible path formats)
            is_public_endpoint = (
                path.startswith('/public/presigned-url') or 
                route_key == 'GET /public/presigned-url' or
                resource_path == '/public/presigned-url' or
                (path and '/public/presigned-url' in path)
            )
            
            if is_public_endpoint:
                print("DEBUG: Routing to public presigned URL handler")
                return generate_presigned_get_url_public(event, cors_headers)
            else:
                print("DEBUG: Routing to authenticated presigned URL handler")
                return generate_presigned_get_url(event, cors_headers)
        
        # Handle POST requests for presigned upload URLs
        if http_method == 'POST':
            return generate_presigned_url(event, cors_headers)
        
        # Method not allowed
        print(f"DEBUG: Method not allowed: {http_method}")
        return {
            'statusCode': 405,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        error_type = type(e).__name__
        print(f"ERROR in upload handler: {error_type}: {str(e)}")
        print(f"Traceback: {error_trace}")
        print("=" * 80)
        return {
            'statusCode': 500,
            'headers': default_cors_headers,
            'body': json.dumps({'error': 'Internal server error', 'message': str(e), 'type': error_type})
        }

def generate_presigned_url(event, cors_headers=None):
    """POST /upload-url - Generate pre-signed URL for upload"""
    if cors_headers is None:
        request_headers = event.get('headers', {}) or {}
        origin = request_headers.get('origin') or request_headers.get('Origin') or None
        cors_headers = get_cors_headers(origin)
    
    user_id = get_user_id_from_event(event)
    if not user_id:
        print(f"ERROR: No user_id found in event")
        return {
            'statusCode': 401,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Unauthorized', 'message': 'No user_id found in JWT claims'})
        }
    
    try:
        body_str = event.get('body', '{}')
        print(f"DEBUG: Request body (raw): {body_str}")
        body = json.loads(body_str)
        print(f"DEBUG: Request body (parsed): {json.dumps(body)}")
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in request body: {str(e)}")
        print(f"DEBUG: Body string: {event.get('body', '')}")
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Invalid JSON in request body', 'details': str(e)})
        }
    except Exception as e:
        print(f"ERROR: Unexpected error parsing body: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Error parsing request body', 'details': str(e)})
        }
    
    file_type = body.get('file_type')  # 'profile_image' or 'resume'
    content_type = body.get('content_type', '').strip().lower()  # Normalize to lowercase
    file_extension = body.get('file_extension', '')
    
    print(f"DEBUG: file_type={file_type}, content_type={content_type}, file_extension={file_extension}")
    
    if not file_type or not content_type:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'error': 'file_type and content_type are required'})
        }
    
    # Normalize content types for comparison (handle variations like image/jpeg vs image/JPEG)
    normalized_allowed_images = [ct.lower() for ct in ALLOWED_IMAGE_TYPES]
    normalized_allowed_resumes = [ct.lower() for ct in ALLOWED_RESUME_TYPES]
    
    # Validate MIME type
    if file_type == 'profile_image':
        if content_type not in normalized_allowed_images:
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({'error': f'Invalid content type. Allowed: {ALLOWED_IMAGE_TYPES}'})
            }
        # Use the normalized content type for the presigned URL
        # But map common variations to standard forms
        if content_type == 'image/jpg':
            content_type = 'image/jpeg'  # Standardize jpg to jpeg
        prefix = f"users/{user_id}/profile/"
    elif file_type == 'project_image':
        if content_type not in normalized_allowed_images:
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({'error': f'Invalid content type. Allowed: {ALLOWED_IMAGE_TYPES}'})
            }
        if content_type == 'image/jpg':
            content_type = 'image/jpeg'
        prefix = f"users/{user_id}/projects/"
    elif file_type == 'resume':
        if content_type not in normalized_allowed_resumes:
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({'error': f'Invalid content type. Allowed: {ALLOWED_RESUME_TYPES}'})
            }
        prefix = f"users/{user_id}/resume/"
    else:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Invalid file_type. Must be "profile_image", "project_image", or "resume"'})
        }
    
    # Generate unique filename
    filename = f"{uuid.uuid4()}{file_extension}"
    key = f"{prefix}{filename}"
    
    # Generate pre-signed URL (valid for 5 minutes)
    # IMPORTANT: Include ContentType in Params so it's part of the signature
    # If Content-Type is sent in the request but not in the signature, S3 will reject it
    try:
        print(f"DEBUG: About to generate presigned URL with ContentType: {content_type}")
        # s3_client is already configured with Signature Version 4
        # Note: With BucketOwnerPreferred, we rely on bucket policy for public access
        # No encryption configured - ensures maximum compatibility for public file access (images and resumes)
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': bucket_name,
                'Key': key,
                'ContentType': content_type,  # Must be included in signature
            },
            ExpiresIn=300,  # 5 minutes
            HttpMethod='PUT'
        )
        
        print(f"DEBUG: Successfully generated presigned URL")
        # Generate presigned GET URL for viewing (15 minutes expiration)
        view_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': bucket_name,
                'Key': key,
            },
            ExpiresIn=900,  # 15 minutes
            HttpMethod='GET'
        )
        
        print(f"DEBUG: Generated presigned URL for key: {key}")
        print(f"DEBUG: Content-Type in signature: {content_type}")
        
        response_body = {
            'upload_url': presigned_url,
            'key': key,
            'url': view_url,  # Presigned GET URL instead of public URL
            'content_type': content_type  # Return the Content-Type that was included in the signature
        }
        
        response = {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps(response_body)
        }
        
        print(f"DEBUG: Returning response: statusCode={response['statusCode']}, headers={list(response['headers'].keys())}, body_length={len(response['body'])}")
        
        return response
    except ParamValidationError as e:
        import traceback
        print(f"ERROR: Parameter validation error: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Parameter validation error', 'message': str(e)})
        }
    except ClientError as e:
        import traceback
        print(f"ERROR: S3 ClientError: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': 'S3 error', 'message': str(e)})
        }
    except Exception as e:
        import traceback
        print(f"ERROR: Unexpected error: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Internal server error', 'message': str(e), 'type': type(e).__name__})
        }

def generate_presigned_get_url(event, cors_headers=None):
    """GET /presigned-url?key=users/123/profile/image.jpg - Generate presigned URL for viewing/downloading"""
    if cors_headers is None:
        request_headers = event.get('headers', {}) or {}
        origin = request_headers.get('origin') or request_headers.get('Origin') or None
        cors_headers = get_cors_headers(origin)
    
    user_id = get_user_id_from_event(event)
    if not user_id:
        print(f"ERROR: No user_id found in event")
        return {
            'statusCode': 401,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Unauthorized', 'message': 'No user_id found in JWT claims'})
        }
    
    # Get key from query string
    try:
        # Try HTTP API v2 format first
        request_context = event.get('requestContext', {})
        http_context = request_context.get('http', {})
        
        # Try different locations for query string parameters
        query_string = (
            http_context.get('queryStringParameters') or 
            event.get('queryStringParameters') or 
            {}
        )
        
        key = query_string.get('key')
        
        if not key:
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({'error': 'key parameter is required'})
            }
        
        # Validate that the key belongs to the requesting user
        if not key.startswith(f"users/{user_id}/"):
            return {
                'statusCode': 403,
                'headers': cors_headers,
                'body': json.dumps({'error': 'Forbidden', 'message': 'You can only access your own files'})
            }
        
        # Generate presigned GET URL (15 minutes expiration)
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': bucket_name,
                'Key': key,
            },
            ExpiresIn=900,  # 15 minutes
            HttpMethod='GET'
        )
        
        response_body = {
            'url': presigned_url,
            'key': key,
            'expires_in': 900
        }
        
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps(response_body)
        }
        
    except ClientError as e:
        print(f"ERROR: S3 ClientError: {str(e)}")
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': 'S3 error', 'message': str(e)})
        }
    except Exception as e:
        print(f"ERROR: Unexpected error: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Internal server error', 'message': str(e)})
        }

def generate_presigned_get_url_public(event, cors_headers=None):
    """GET /public/presigned-url?key=users/123/profile/image.jpg - Generate presigned URL for public profile assets (no auth required)"""
    if cors_headers is None:
        request_headers = event.get('headers', {}) or {}
        origin = request_headers.get('origin') or request_headers.get('Origin') or None
        cors_headers = get_cors_headers(origin)
    
    # Get key from query string
    try:
        # Try HTTP API v2 format first
        request_context = event.get('requestContext', {})
        http_context = request_context.get('http', {})
        
        # Try different locations for query string parameters
        query_string = (
            http_context.get('queryStringParameters') or 
            event.get('queryStringParameters') or 
            {}
        )
        
        key = query_string.get('key')
        
        print(f"DEBUG: Public presigned URL request - key: {key}, query_string: {query_string}, event keys: {list(event.keys())}")
        
        if not key:
            print("ERROR: key parameter is missing")
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({'error': 'key parameter is required', 'message': 'key parameter is required'})
            }
        
        # Only allow public access to profile images and resumes (public profile assets)
        # Pattern: users/{user_id}/profile/* or users/{user_id}/resume/*
        key_parts = key.split('/')
        print(f"DEBUG: Key parts: {key_parts}, length: {len(key_parts)}")
        
        if len(key_parts) < 3 or key_parts[0] != 'users' or key_parts[2] not in ['profile', 'resume']:
            print(f"ERROR: Invalid key pattern - key_parts: {key_parts}")
            return {
                'statusCode': 403,
                'headers': cors_headers,
                'body': json.dumps({
                    'error': 'Forbidden',
                    'message': 'Public presigned URLs are only available for profile images and resumes'
                })
            }
        
        # Generate presigned GET URL (15 minutes expiration)
        print(f"DEBUG: Generating presigned URL for bucket: {bucket_name}, key: {key}")
        
        if not s3_client or not bucket_name:
            print(f"ERROR: S3 client or bucket name not configured - s3_client: {bool(s3_client)}, bucket_name: {bucket_name}")
            return {
                'statusCode': 500,
                'headers': cors_headers,
                'body': json.dumps({
                    'error': 'Internal server error',
                    'message': 'S3 client not configured'
                })
            }
        
        try:
            presigned_url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': bucket_name,
                    'Key': key,
                },
                ExpiresIn=900,  # 15 minutes
                HttpMethod='GET'
            )
            
            print(f"DEBUG: Successfully generated presigned URL")
            
            response_body = {
                'url': presigned_url,
                'key': key,
                'expires_in': 900
            }
            
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps(response_body)
            }
        except Exception as e:
            print(f"ERROR: Failed to generate presigned URL: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return {
                'statusCode': 500,
                'headers': cors_headers,
                'body': json.dumps({
                    'error': 'Internal server error',
                    'message': f'Failed to generate presigned URL: {str(e)}'
                })
            }
        
    except ClientError as e:
        print(f"ERROR: S3 ClientError: {str(e)}")
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': 'S3 error', 'message': str(e)})
        }
    except Exception as e:
        print(f"ERROR: Unexpected error: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Internal server error', 'message': str(e)})
        }