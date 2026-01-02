import json
import os
import boto3
import uuid
import traceback
from datetime import datetime
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
links_table = dynamodb.Table(os.environ['LINKS_TABLE'])

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
        'Access-Control-Allow-Credentials': 'true',  # Required when using Authorization header
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '300',
        'Content-Type': 'application/json'
    }

# Default CORS headers for backward compatibility
CORS_HEADERS = get_cors_headers()

def get_user_id_from_event(event):
    """Extract user_id from JWT claims - supports both HTTP API v1 and v2"""
    try:
        request_context = event.get('requestContext', {})
        authorizer = request_context.get('authorizer', {})
        
        # Try HTTP API v2 format first: authorizer.claims.sub
        claims = authorizer.get('claims', {})
        if claims:
            user_id = claims.get('sub')
            if user_id:
                return user_id
        
        # Fallback to HTTP API v1 format: authorizer.jwt.claims.sub
        jwt = authorizer.get('jwt', {})
        claims = jwt.get('claims', {})
        if claims:
            user_id = claims.get('sub')
            if user_id:
                return user_id
        
        return None
    except Exception as e:
        print(f"ERROR: Failed to extract user_id: {str(e)}")
        return None

def handler(event, context):
    # Get origin from request headers for CORS
    request_headers = event.get('headers', {}) or {}
    origin = request_headers.get('origin') or request_headers.get('Origin') or None
    cors_headers = get_cors_headers(origin)
    
    # Try HTTP API v2 format first
    request_context = event.get('requestContext', {})
    http_context = request_context.get('http', {})
    http_method = http_context.get('method')
    path = http_context.get('path')
    
    # Fallback to HTTP API v1 format
    if not http_method:
        http_method = request_context.get('httpMethod')
    if not path:
        path = request_context.get('path')
    
    # Handle OPTIONS (CORS preflight)
    if http_method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': ''
        }
    
    try:
        if http_method == 'POST' and path == '/links':
            return create_or_update_link(event, cors_headers)
        elif http_method == 'DELETE' and path and path.startswith('/links/'):
            link_id = path.split('/')[-1]
            return delete_link(event, link_id, cors_headers)
        else:
            return {
                'statusCode': 405,
                'headers': cors_headers,
                'body': json.dumps({'error': 'Method not allowed'})
            }
    except Exception as e:
        # Log detailed error for debugging
        error_type = type(e).__name__
        print(f"ERROR in handler: {error_type}: {str(e)}")
        print(traceback.format_exc())
        
        # Return generic error to user
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Internal server error', 'message': 'An error occurred processing your request'})
        }

def create_or_update_link(event, cors_headers=None):
    """POST /links - Create or update a link"""
    if cors_headers is None:
        request_headers = event.get('headers', {}) or {}
        origin = request_headers.get('origin') or request_headers.get('Origin') or None
        cors_headers = get_cors_headers(origin)
    
    user_id = get_user_id_from_event(event)
    if not user_id:
        return {
            'statusCode': 401,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Unauthorized', 'message': 'No user_id found in JWT claims'})
        }
    
    try:
        body = json.loads(event.get('body', '{}'))
    except json.JSONDecodeError as e:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Invalid JSON in request body', 'message': 'Request body must be valid JSON'})
        }
    
    link_id = body.get('link_id') or str(uuid.uuid4())
    title = body.get('title', '').strip()
    url = body.get('url', '').strip()
    order = body.get('order', 0)
    
    # Input validation
    if not title or not url:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Validation error', 'message': 'title and url are required'})
        }
    
    # Validate URL format
    if not (url.startswith('http://') or url.startswith('https://')):
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Validation error', 'message': 'URL must start with http:// or https://'})
        }
    
    # Validate title length (max 200 characters)
    if len(title) > 200:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Validation error', 'message': 'title must be 200 characters or less'})
        }
    
    # Validate URL length (max 2000 characters)
    if len(url) > 2000:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Validation error', 'message': 'url must be 2000 characters or less'})
        }
    
    link_item = {
        'user_id': user_id,
        'link_id': link_id,
        'title': title,
        'url': url,
        'order': int(order) if isinstance(order, (int, float)) else 0,
        'is_deleted': False,
        'updated_at': datetime.utcnow().isoformat()
    }
    
    # Check if link exists
    try:
        existing = links_table.get_item(Key={'user_id': user_id, 'link_id': link_id})
        if 'Item' not in existing:
            link_item['created_at'] = datetime.utcnow().isoformat()
    except ClientError as e:
        # Log error but don't expose details
        print(f"ERROR: Failed to check existing link: {type(e).__name__}")
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Internal server error', 'message': 'An error occurred processing your request'})
        }
    
    try:
        links_table.put_item(Item=link_item)
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({'message': 'Link saved successfully', 'link': link_item})
        }
    except ClientError as e:
        # Log detailed error for debugging
        print(f"ERROR: Database error in create_or_update_link: {type(e).__name__}: {str(e)}")
        print(traceback.format_exc())
        
        # Return generic error to user
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Internal server error', 'message': 'An error occurred saving your link'})
        }

def delete_link(event, link_id, cors_headers=None):
    """DELETE /links/{id} - Soft delete a link"""
    if cors_headers is None:
        request_headers = event.get('headers', {}) or {}
        origin = request_headers.get('origin') or request_headers.get('Origin') or None
        cors_headers = get_cors_headers(origin)
    
    user_id = get_user_id_from_event(event)
    if not user_id:
        return {
            'statusCode': 401,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Unauthorized', 'message': 'No user_id found in JWT claims'})
        }
    
    # Validate link_id format (should be UUID)
    if not link_id or len(link_id) > 100:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Validation error', 'message': 'Invalid link ID'})
        }
    
    try:
        # Get existing link
        response = links_table.get_item(Key={'user_id': user_id, 'link_id': link_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': cors_headers,
                'body': json.dumps({'error': 'Not found', 'message': 'Link not found'})
            }
        
        # Soft delete
        links_table.update_item(
            Key={'user_id': user_id, 'link_id': link_id},
            UpdateExpression='SET is_deleted = :true, updated_at = :now',
            ExpressionAttributeValues={
                ':true': True,
                ':now': datetime.utcnow().isoformat()
            }
        )
        
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({'message': 'Link deleted successfully'})
        }
    except ClientError as e:
        # Log detailed error for debugging
        print(f"ERROR: Database error in delete_link: {type(e).__name__}: {str(e)}")
        print(traceback.format_exc())
        
        # Return generic error to user
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Internal server error', 'message': 'An error occurred deleting your link'})
        }