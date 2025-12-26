import json
import os
import boto3
import uuid
from datetime import datetime, timedelta
from botocore.exceptions import ClientError

s3_client = boto3.client('s3')
bucket_name = os.environ['S3_BUCKET']

# Allowed MIME types
ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
ALLOWED_RESUME_TYPES = ['application/pdf']

# CORS headers - must match origin exactly when using credentials
def get_cors_headers(origin=None):
    """Get CORS headers based on request origin"""
    # Allowed origins
    allowed_origins = ['http://localhost:8080', 'http://localhost:3000']
    
    # If origin is provided and in allowed list, use it; otherwise use first allowed
    if origin and origin in allowed_origins:
        allowed_origin = origin
    elif origin and origin.startswith('http://localhost'):
        # Allow any localhost port for development
        allowed_origin = origin
    else:
        allowed_origin = allowed_origins[0]  # Default to first allowed origin
    
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
    
    # Fallback to API Gateway v1 format
    if not http_method:
        http_method = request_context.get('httpMethod')
    
    print(f"DEBUG: HTTP method: {http_method}")
    
    # Handle OPTIONS (CORS preflight)
    if http_method == 'OPTIONS':
        print("DEBUG: Handling OPTIONS request")
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': ''
        }
    
    if http_method != 'POST':
        print(f"DEBUG: Method not allowed: {http_method}")
        return {
            'statusCode': 405,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    try:
        return generate_presigned_url(event, cors_headers)
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"ERROR in upload handler: {str(e)}")
        print(f"Traceback: {error_trace}")
        print("=" * 80)
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Internal server error', 'message': str(e)})
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
            'body': json.dumps({'error': 'Invalid file_type. Must be "profile_image" or "resume"'})
        }
    
    # Generate unique filename
    filename = f"{uuid.uuid4()}{file_extension}"
    key = f"{prefix}{filename}"
    
    # Generate pre-signed URL (valid for 5 minutes)
    # IMPORTANT: Include ContentType in Params so it's part of the signature
    # If Content-Type is sent in the request but not in the signature, S3 will reject it
    try:
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
        
        public_url = f"https://{bucket_name}.s3.amazonaws.com/{key}" if file_type == 'profile_image' else None
        
        print(f"DEBUG: Generated presigned URL for key: {key}")
        print(f"DEBUG: Content-Type in signature: {content_type}")
        
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({
                'upload_url': presigned_url,
                'key': key,
                'url': public_url,
                'content_type': content_type  # Return the Content-Type that was included in the signature
            })
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
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Internal server error', 'message': str(e)})
        }