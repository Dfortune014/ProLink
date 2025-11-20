import json
import os
import boto3
from datetime import datetime
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
profiles_table = dynamodb.Table(os.environ['PROFILES_TABLE'])
users_table = dynamodb.Table(os.environ['USERS_TABLE'])

def get_user_id_from_event(event):
    """Extract user_id from JWT claims"""
    try:
        claims = event.get('requestContext', {}).get('authorizer', {}).get('jwt', {}).get('claims', {})
        return claims.get('sub')
    except:
        return None

def handler(event, context):
    http_method = event.get('requestContext', {}).get('http', {}).get('method')
    path = event.get('requestContext', {}).get('http', {}).get('path')
    
    try:
        if http_method == 'POST' and path == '/profiles':
            return create_or_update_profile(event)
        elif http_method == 'GET' and path.startswith('/profiles/'):
            username = path.split('/')[-1]
            return get_public_profile(username)
        else:
            return {
                'statusCode': 405,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Method not allowed'})
            }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)})
        }

def create_or_update_profile(event):
    """POST /profiles - Create or update profile"""
    user_id = get_user_id_from_event(event)
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Unauthorized'})
        }
    
    body = json.loads(event.get('body', '{}'))
    
    # Validate required fields
    username = body.get('username')
    if not username:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'username is required'})
        }
    
    # Check if username is already taken by another user
    try:
        existing = profiles_table.get_item(Key={'username': username})
        if 'Item' in existing and existing['Item'].get('user_id') != user_id:
            return {
                'statusCode': 409,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Username already taken'})
            }
    except ClientError as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': f'Database error: {str(e)}'})
        }
    
    # Get or create user record
    try:
        user = users_table.get_item(Key={'user_id': user_id})
        if 'Item' not in user:
            # Create user record
            claims = event.get('requestContext', {}).get('authorizer', {}).get('jwt', {}).get('claims', {})
            users_table.put_item(Item={
                'user_id': user_id,
                'email': claims.get('email', ''),
                'created_at': datetime.utcnow().isoformat()
            })
    except ClientError as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
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
    
    # Check if profile exists
    existing_profile = profiles_table.get_item(Key={'username': username})
    if 'Item' not in existing_profile:
        profile_item['created_at'] = datetime.utcnow().isoformat()
    
    try:
        profiles_table.put_item(Item=profile_item)
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'message': 'Profile saved successfully', 'profile': profile_item})
        }
    except ClientError as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': f'Database error: {str(e)}'})
        }

def get_public_profile(username):
    """GET /profiles/{username} - Get public profile"""
    try:
        response = profiles_table.get_item(Key={'username': username})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json'},
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
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps(public_profile)
        }
    except ClientError as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': f'Database error: {str(e)}'})
        }