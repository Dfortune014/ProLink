import json
import os
import boto3
from botocore.exceptions import ClientError
import traceback

# Initialize Cognito client
cognito_client = boto3.client('cognito-idp')

def handler(event, context):
    """
    Cognito Pre-Sign-Up Trigger
    Prevents duplicate emails by checking if email already exists in Cognito User Pool
    - Rejects social login if email already exists (from email sign-up)
    - Rejects email sign-up if email already exists (from social login)
    """
    print("=" * 80)
    print("PRE-SIGNUP LAMBDA TRIGGERED")
    print("=" * 80)
    
    try:
        # Get user attributes from event
        user_attributes = event.get('request', {}).get('userAttributes', {})
        email = user_attributes.get('email', '').strip().lower()
        trigger_source = event.get('triggerSource', '')
        user_pool_id = event.get('userPoolId', '')
        
        print(f"Trigger Source: {trigger_source}")
        print(f"Email: {email}")
        print(f"User Pool ID: {user_pool_id}")
        print(f"Full Event: {json.dumps(event, indent=2, default=str)}")
        
        # Check if user_pool_id and email are available
        if not user_pool_id:
            print("⚠ User Pool ID not found in event, allowing sign-up")
            return event
        
        if not email:
            print("⚠ Email not found in event, allowing sign-up")
            return event
        
        # Check for duplicate email for BOTH social logins and email sign-ups
        is_social_login = 'ExternalProvider' in trigger_source or 'Google' in trigger_source or 'LinkedIn' in trigger_source
        is_email_signup = trigger_source == 'PreSignUp_SignUp'
        
        # For social logins, verify email is verified by the identity provider
        if is_social_login:
            email_verified = user_attributes.get('email_verified', 'false')
            print(f"Email verification status: {email_verified}")
            if email_verified != 'true':
                print(f"⚠ Email not verified for social login - rejecting sign-up")
                raise Exception("Email address must be verified by the identity provider.")
            print(f"✓ Email verified for social login")
        
        try:
            # Check if email already exists in Cognito User Pool
            print(f"Checking Cognito User Pool for duplicate email: {email}")
            print(f"Sign-up type: {'Social Login' if is_social_login else 'Email Sign-up'}")
            
            response = cognito_client.list_users(
                UserPoolId=user_pool_id,
                Filter=f'email = "{email}"'
            )
            
            users = response.get('Users', [])
            
            if users and len(users) > 0:
                existing_user = users[0]
                existing_username = existing_user.get('Username', 'Unknown')
                existing_attributes = existing_user.get('Attributes', [])
                
                # Determine how the existing user signed up
                existing_user_status = next(
                    (attr.get('Value') for attr in existing_attributes if attr.get('Name') == 'cognito:user_status'),
                    'Unknown'
                )
                is_existing_social = existing_user_status == 'EXTERNAL_PROVIDER' or existing_username.startswith('Google_') or existing_username.startswith('LinkedIn_')
                
                print(f"✗ EXISTING USER FOUND in Cognito User Pool!")
                print(f"  Existing username: {existing_username}")
                print(f"  Existing user status: {existing_user_status}")
                print(f"  Email: {email}")
                
                # Determine appropriate error message based on sign-up types
                if is_social_login:
                    print(f"  → REJECTING social login - user must sign in with email and password")
                    error_message = "An account with this email already exists. Please sign in with your email and password instead."
                else:
                    print(f"  → REJECTING email sign-up - user must sign in with social login")
                    error_message = "An account with this email already exists. Please sign in with your social account instead."
                
                # Raise exception to prevent user creation in Cognito
                raise Exception(error_message)
            else:
                signup_type = 'social login' if is_social_login else 'email sign-up'
                print(f"✓ No existing user found in Cognito User Pool - allowing new {signup_type}")
                return event
                
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            error_message = e.response.get('Error', {}).get('Message', str(e))
            print(f"✗ ERROR checking Cognito User Pool:")
            print(f"  Error Code: {error_code}")
            print(f"  Error Message: {error_message}")
            print(f"  Traceback: {traceback.format_exc()}")
            # Allow sign-up on error (to avoid blocking legitimate users)
            return event
        except Exception as e:
            # Re-raise if it's our intentional rejection
            if "An account with this email already exists" in str(e):
                print(f"✗ REJECTING SIGN-UP: {str(e)}")
                raise
            print(f"✗ UNEXPECTED ERROR: {str(e)}")
            print(f"  Traceback: {traceback.format_exc()}")
            # Allow sign-up on unexpected error
            return event
            
    except Exception as e:
        # Re-raise if it's our intentional rejection
        if "An account with this email already exists" in str(e):
            print(f"✗ REJECTING SIGN-UP: {str(e)}")
            raise
        print(f"✗ FATAL ERROR: {str(e)}")
        print(f"  Traceback: {traceback.format_exc()}")
        # Allow sign-up on error
        return event

