import json
import os
import boto3
import uuid
from datetime import datetime
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
links_table = dynamodb.Table(os.environ['LINKS_TABLE'])

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
        if http_method == 'POST' and path == '/links':
            return create_or_update_link(event)
        elif http_method == 'DELETE' and path.startswith('/links/'):
            link_id = path.split('/')[-1]
            return delete_link(event, link_id)
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

def create_or_update_link(event):
    """POST /links - Create or update a link"""
    user_id = get_user_id_from_event(event)
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Unauthorized'})
        }
    
    body = json.loads(event.get('body', '{}'))
    
    link_id = body.get('link_id') or str(uuid.uuid4())
    title = body.get('title', '')
    url = body.get('url', '')
    order = body.get('order', 0)
    
    if not title or not url:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'title and url are required'})
        }
    
    link_item = {
        'user_id': user_id,
        'link_id': link_id,
        'title': title,
        'url': url,
        'order': order,
        'is_deleted': False,
        'updated_at': datetime.utcnow().isoformat()
    }
    
    # Check if link exists
    existing = links_table.get_item(Key={'user_id': user_id, 'link_id': link_id})
    if 'Item' not in existing:
        link_item['created_at'] = datetime.utcnow().isoformat()
    
    try:
        links_table.put_item(Item=link_item)
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'message': 'Link saved successfully', 'link': link_item})
        }
    except ClientError as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': f'Database error: {str(e)}'})
        }

def delete_link(event, link_id):
    """DELETE /links/{id} - Soft delete a link"""
    user_id = get_user_id_from_event(event)
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Unauthorized'})
        }
    
    try:
        # Get existing link
        response = links_table.get_item(Key={'user_id': user_id, 'link_id': link_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Link not found'})
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
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'message': 'Link deleted successfully'})
        }
    except ClientError as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': f'Database error: {str(e)}'})
        }