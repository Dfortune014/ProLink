import json
import os
import boto3
from datetime import datetime
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
profiles_table = dynamodb.Table(os.environ['PROFILES_TABLE'])
users_table = dynamodb.Table(os.environ['USERS_TABLE'])

# CORS headers - must match origin exactly when using credentials
# Note: When allow_credentials is true, cannot use wildcard '*'
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
        'Access-Control-Allow-Credentials': 'true',  # Required when using Authorization header
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '300',
        'Content-Type': 'application/json'
    }

# Default CORS headers for backward compatibility
CORS_HEADERS = get_cors_headers()

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
                print(f"DEBUG: Extracted user_id from HTTP API v2 format: {user_id}")
                return user_id
        
        # Fallback to HTTP API v1 format: authorizer.jwt.claims
        jwt = authorizer.get('jwt', {})
        claims = jwt.get('claims', {})
        if claims:
            user_id = claims.get('sub')
            if user_id:
                print(f"DEBUG: Extracted user_id from HTTP API v1 format: {user_id}")
                return user_id
        
        print(f"DEBUG: No user_id found in authorizer claims")
        print(f"DEBUG: Authorizer structure: {json.dumps(authorizer, default=str)}")
        return None
    except Exception as e:
        print(f"DEBUG: Error extracting user_id: {str(e)}")
        import traceback
        print(f"DEBUG: Traceback: {traceback.format_exc()}")
        return None

def handler(event, context):
    # DEBUG: Log the full event structure
    print("=" * 80)
    print("LAMBDA INVOCATION START")
    print("=" * 80)
    print(f"Event keys: {list(event.keys())}")
    print(f"Full event: {json.dumps(event, default=str)}")
    
    # Get origin from request headers for CORS
    request_headers = event.get('headers', {}) or {}
    origin = request_headers.get('origin') or request_headers.get('Origin') or None
    
    # Try API Gateway HTTP API v2 format first
    request_context = event.get('requestContext', {})
    http_context = request_context.get('http', {})
    http_method = http_context.get('method')
    path = http_context.get('path') or event.get('rawPath')
    
    print(f"DEBUG: HTTP API v2 - method: {http_method}, path: {path}")
    print(f"DEBUG: Origin: {origin}")
    
    # Fallback to API Gateway v1 format if v2 format not found
    if not http_method:
        http_method = request_context.get('httpMethod')
        print(f"DEBUG: Fallback to v1 - method: {http_method}")
    if not path:
        path = event.get('path') or request_context.get('path')
        print(f"DEBUG: Fallback path: {path}")
    
    print(f"DEBUG: Final method: {http_method}, Final path: {path}")
    print(f"DEBUG: Headers: {event.get('headers', {})}")
    print(f"DEBUG: Query params: {event.get('queryStringParameters', {})}")
    
    # Get CORS headers for this request (will be used by all functions)
    cors_headers = get_cors_headers(origin)
    
    try:
        # Handle OPTIONS (CORS preflight) first, before path normalization
        if http_method == 'OPTIONS':
            print("=" * 80)
            print("OPTIONS REQUEST DETECTED - Handling CORS preflight")
            print("=" * 80)
            # Handle CORS preflight for any endpoint
            # Get the origin from the request headers for proper CORS response
            request_headers = event.get('headers', {}) or {}
            origin = request_headers.get('origin') or request_headers.get('Origin') or '*'
            
            # Get CORS headers with proper origin and credentials
            cors_response_headers = get_cors_headers(origin)
            
            print(f"DEBUG: OPTIONS response - origin: {origin}, allowed_origin: {allowed_origin}")
            print(f"DEBUG: OPTIONS response headers: {cors_response_headers}")
            
            response = {
                'statusCode': 200,
                'headers': cors_response_headers,
                'body': ''
            }
            
            print(f"DEBUG: OPTIONS response: {json.dumps(response, default=str)}")
            print("=" * 80)
            print("OPTIONS REQUEST HANDLED SUCCESSFULLY")
            print("=" * 80)
            
            return response
        
        # Normalize path (remove trailing slash, handle query params)
        if path:
            # Remove query string if present
            path = path.split('?')[0]
            path = path.rstrip('/')
        
        # Check if this is the username check endpoint
        if http_method == 'GET' and path and '/username/check' in path:
            print("DEBUG: Routing to check_username_availability")
            return check_username_availability(event, cors_headers)
        elif http_method == 'GET' and path == '/users/me':
            print("DEBUG: Routing to get_current_user_profile")
            return get_current_user_profile(event, cors_headers)
        elif http_method == 'POST' and path == '/profiles':
            return create_or_update_profile(event, cors_headers)
        elif http_method == 'GET' and path.startswith('/profiles/'):
            username = path.split('/')[-1]
            return get_public_profile(username, cors_headers)
        else:
            print(f"DEBUG: Method not allowed - method: {http_method}, path: {path}")
            return {
                'statusCode': 405,
                'headers': cors_headers,
                'body': json.dumps({'error': 'Method not allowed'})
            }
    except Exception as e:
        print("=" * 80)
        print("ERROR IN HANDLER")
        print("=" * 80)
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        print("=" * 80)
        
        return {
            'statusCode': 500,
            'headers': cors_headers if cors_headers else get_cors_headers(),
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e),
                'error_type': type(e).__name__
            })
        }

def create_or_update_profile(event, cors_headers=None):
    """POST /profiles - Create or update profile"""
    print("=" * 80)
    print("create_or_update_profile CALLED")
    print("=" * 80)
    
    if cors_headers is None:
        cors_headers = get_cors_headers()
    
    user_id = get_user_id_from_event(event)
    print(f"DEBUG: Extracted user_id: {user_id}")
    
    if not user_id:
        print("ERROR: No user_id found in event - returning 401")
        return {
            'statusCode': 401,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Unauthorized', 'message': 'No user_id found in JWT claims'})
        }
    
    print(f"DEBUG: Processing profile creation/update for user_id: {user_id}")
    
    body = json.loads(event.get('body', '{}'))
    
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
        return {
            'statusCode': 500,
            'headers': cors_headers if cors_headers else get_cors_headers(),
            'body': json.dumps({'error': f'Database error: {str(e)}'})
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
        return {
            'statusCode': 500,
            'headers': cors_headers if cors_headers else get_cors_headers(),
            'body': json.dumps({'error': f'Database error: {str(e)}'})
        }
    
    # Prepare profile item
    profile_item = {
        'username': username,
        'user_id': user_id,
        'full_name': body.get('full_name', ''),
        'title': body.get('title', ''),
        'bio': body.get('bio', ''),
        'skills': body.get('skills', []),
        'social_links': body.get('social_links', {}),
        'profile_image_url': body.get('profile_image_url', ''),
        'email': body.get('email', ''),
        'phone': body.get('phone', ''),
        'resume_key': body.get('resume_key', ''),
        'show_email': body.get('show_email', False),
        'show_phone': body.get('show_phone', False),
        'show_resume': body.get('show_resume', False),
        'updated_at': datetime.utcnow().isoformat()
    }
    
    # Add date_of_birth if provided (for social logins completing profile)
    date_of_birth = body.get('date_of_birth')
    if date_of_birth:
        profile_item['date_of_birth'] = date_of_birth
    
    # Check if profile exists
    existing_profile = profiles_table.get_item(Key={'username': username})
    if 'Item' not in existing_profile:
        profile_item['created_at'] = datetime.utcnow().isoformat()
        print(f"Creating new profile record for username: {username}")
    else:
        # Preserve created_at from existing profile
        profile_item['created_at'] = existing_profile['Item'].get('created_at', datetime.utcnow().isoformat())
        print(f"Updating existing profile record for username: {username}")
    
    try:
        profiles_table.put_item(Item=profile_item)
        print(f"✓ Successfully saved profile record for username: {username}")
        return {
            'statusCode': 200,
            'headers': cors_headers if cors_headers else get_cors_headers(),
            'body': json.dumps({'message': 'Profile saved successfully', 'profile': profile_item})
        }
    except ClientError as e:
        print(f"✗ ERROR saving profile record: {str(e)}")
        return {
            'statusCode': 500,
            'headers': cors_headers if cors_headers else get_cors_headers(),
            'body': json.dumps({'error': f'Database error: {str(e)}'})
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
        print(f"ERROR: Database error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': f'Database error: {str(e)}'})
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

def get_public_profile(username, cors_headers=None):
    """GET /profiles/{username} - Get public profile"""
    if cors_headers is None:
        cors_headers = get_cors_headers()
    """GET /profiles/{username} - Get public profile"""
    try:
        response = profiles_table.get_item(Key={'username': username})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': cors_headers if cors_headers else get_cors_headers(),
                'body': json.dumps({'error': 'Profile not found'})
            }
        
        profile = response['Item']
        
        # Get user's links
        links_table = dynamodb.Table(os.environ.get('LINKS_TABLE', ''))
        links_response = links_table.query(
            KeyConditionExpression=Key('user_id').eq(profile['user_id']),
            FilterExpression='is_deleted = :false',
            ExpressionAttributeValues={':false': False}
        )
        links = sorted(links_response.get('Items', []), key=lambda x: x.get('order', 0))
        
        # Build public profile response
        public_profile = {
            'username': profile['username'],
            'full_name': profile.get('full_name', ''),
            'title': profile.get('title', ''),
            'bio': profile.get('bio', ''),
            'skills': profile.get('skills', []),
            'social_links': profile.get('social_links', {}),
            'profile_image_url': profile.get('profile_image_url', ''),
            'links': [{'title': l.get('title'), 'url': l.get('url')} for l in links]
        }
        
        # Add contact info if visible
        if profile.get('show_email'):
            public_profile['email'] = profile.get('email', '')
        if profile.get('show_phone'):
            public_profile['phone'] = profile.get('phone', '')
        if profile.get('show_resume') and profile.get('resume_key'):
            public_profile['resume_key'] = profile.get('resume_key')
        
        return {
            'statusCode': 200,
            'headers': cors_headers if cors_headers else get_cors_headers(),
            'body': json.dumps(public_profile)
        }
    except ClientError as e:
        return {
            'statusCode': 500,
            'headers': cors_headers if cors_headers else get_cors_headers(),
            'body': json.dumps({'error': f'Database error: {str(e)}'})
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