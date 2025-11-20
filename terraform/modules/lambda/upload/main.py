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

def get_user_id_from_event(event):
    """Extract user_id from JWT claims"""
    try:
        claims = event.get('requestContext', {}).get('authorizer', {}).get('jwt', {}).get('claims', {})
        return claims.get('sub')
    except:
        return None

def handler(event, context):
    http_method = event.get('requestContext', {}).get('http', {}).get('method')
    
    if http_method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    try:
        return generate_presigned_url(event)
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)})
        }

def generate_presigned_url(event):
    """POST /upload-url - Generate pre-signed URL for upload"""
    user_id = get_user_id_from_event(event)
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Unauthorized'})
        }
    
    body = json.loads(event.get('body', '{}'))
    file_type = body.get('file_type')  # 'profile_image' or 'resume'
    content_type = body.get('content_type')
    file_extension = body.get('file_extension', '')
    
    if not file_type or not content_type:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'file_type and content_type are required'})
        }
    
    # Validate MIME type
    if file_type == 'profile_image':
        if content_type not in ALLOWED_IMAGE_TYPES:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': f'Invalid content type. Allowed: {ALLOWED_IMAGE_TYPES}'})
            }
        prefix = f"users/{user_id}/profile/"
    elif file_type == 'resume':
        if content_type not in ALLOWED_RESUME_TYPES:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': f'Invalid content type. Allowed: {ALLOWED_RESUME_TYPES}'})
            }
        prefix = f"users/{user_id}/resume/"
    else:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Invalid file_type. Must be "profile_image" or "resume"'})
        }
    
    # Generate unique filename
    filename = f"{uuid.uuid4()}{file_extension}"
    key = f"{prefix}{filename}"
    
    # Generate pre-signed URL (valid for 5 minutes)
    try:
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': bucket_name,
                'Key': key,
                'ContentType': content_type
            },
            ExpiresIn=300  # 5 minutes
        )
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'upload_url': presigned_url,
                'key': key,
                'url': f"https://{bucket_name}.s3.amazonaws.com/{key}" if file_type == 'profile_image' else None
            })
        }
    except ClientError as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': f'S3 error: {str(e)}'})
        }