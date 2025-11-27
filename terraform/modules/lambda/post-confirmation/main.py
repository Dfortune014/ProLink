import json
import os
import boto3
from datetime import datetime
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key
import re
import traceback

# Initialize DynamoDB
dynamodb = boto3.resource('dynamodb')

def handler(event, context):
    """
    Cognito Post-Confirmation Trigger
    Creates user record in DynamoDB after email confirmation or social login
    Handles both email sign-up and social logins (Google, LinkedIn)
    """
    print("=" * 80)
    print("POST-CONFIRMATION LAMBDA TRIGGERED")
    print("=" * 80)
    
    try:
        # Log environment variables
        users_table_name = os.environ.get('USERS_TABLE', 'NOT SET')
        profiles_table_name = os.environ.get('PROFILES_TABLE', 'NOT SET')
        print(f"Environment Variables:")
        print(f"  USERS_TABLE: {users_table_name}")
        print(f"  PROFILES_TABLE: {profiles_table_name}")
        
        # Initialize tables
        try:
            users_table = dynamodb.Table(users_table_name)
            profiles_table = dynamodb.Table(profiles_table_name)
            print(f"✓ DynamoDB tables initialized")
        except Exception as table_error:
            print(f"✗ ERROR initializing DynamoDB tables: {str(table_error)}")
            print(f"  Traceback: {traceback.format_exc()}")
            return event
        
        # Log full event
        print(f"\nFull Event Structure:")
        print(f"  Event keys: {list(event.keys())}")
        print(f"  Event JSON: {json.dumps(event, indent=2, default=str)}")
        
        # Extract user attributes from Cognito event
        request = event.get('request', {})
        user_attributes = request.get('userAttributes', {})
        print(f"\nUser Attributes:")
        print(f"  All attributes: {json.dumps(user_attributes, indent=2, default=str)}")
        print(f"  Attribute keys: {list(user_attributes.keys())}")
        
        # Use 'sub' as the user_id (Cognito's unique user identifier)
        user_id = user_attributes.get('sub') or event.get('userName')
        email = user_attributes.get('email', '').strip()
        
        print(f"\nExtracted Basic Info:")
        print(f"  user_id: {user_id}")
        print(f"  email: {email}")
        print(f"  userName (from event): {event.get('userName')}")
        
        # For email sign-up, these custom attributes exist
        fullname = user_attributes.get('custom:fullname', '').strip()
        date_of_birth = user_attributes.get('custom:date_of_birth', '').strip()
        username = user_attributes.get('custom:username', '').strip().lower()
        
        print(f"\nEmail Sign-up Attributes:")
        print(f"  custom:fullname: {fullname}")
        print(f"  custom:date_of_birth: {date_of_birth}")
        print(f"  custom:username: {username}")
        
        # Extract profile picture from social logins
        picture = user_attributes.get('picture', '').strip()
        
        # Check if this is a social login (no custom:username means social login)
        is_social_login = not username
        
        # For social logins (Google, LinkedIn), use name/profile info
        if not fullname:
            print(f"\nSocial Login Attributes (checking for name):")
            given_name = user_attributes.get('given_name', '').strip()
            family_name = user_attributes.get('family_name', '').strip()
            name = user_attributes.get('name', '').strip()
            
            print(f"  given_name: {given_name}")
            print(f"  family_name: {family_name}")
            print(f"  name: {name}")
            print(f"  picture: {picture[:50] if picture else 'None'}...")
            
            if name:
                fullname = name
                print(f"  → Using 'name': {fullname}")
            elif given_name or family_name:
                fullname = f"{given_name} {family_name}".strip()
                print(f"  → Using given_name + family_name: {fullname}")
            else:
                # Fallback to email username
                fullname = email.split('@')[0] if email else 'User'
                print(f"  → Fallback to email username: {fullname}")
        
        # For social logins, don't set username/date_of_birth - user will complete profile later
        # Only generate temporary username for social logins if needed for database
        if is_social_login:
            print(f"\n⚠ Social login detected - username and date_of_birth will be collected later")
            # Generate temporary username for database (will be updated when user completes profile)
            email_username = email.split('@')[0] if email else ''
            username = re.sub(r'[^a-z0-9_-]', '', email_username.lower())[:20]
            if len(username) < 3:
                username = f"user_{user_id[:8]}"
            print(f"  Temporary username for database: {username}")
            # Don't set date_of_birth for social logins
            date_of_birth = ""
        
        # Validate required fields
        if not email:
            print(f"\n✗ ERROR: No email found for user {user_id}")
            print(f"  Returning event without creating records")
            return event  # Don't fail, but log warning
        
        # Validate username format
        if not re.match(r'^[a-z0-9_-]{3,20}$', username):
            print(f"\n⚠ Username format invalid: {username}")
            # Generate a safe username
            username = f"user_{user_id[:8]}"
            print(f"  → Generated safe username: {username}")
        
        created_at = datetime.utcnow().isoformat()
        
        print(f"\nFinal Values:")
        print(f"  user_id: {user_id}")
        print(f"  email: {email}")
        print(f"  fullname: {fullname}")
        print(f"  username: {username}")
        print(f"  date_of_birth: {date_of_birth if date_of_birth else 'None'}")
        print(f"  created_at: {created_at}")
        
        # Check if email already exists (for account linking)
        print(f"\n{'='*80}")
        print(f"CHECKING FOR EXISTING EMAIL: {email}")
        print(f"{'='*80}")
        
        existing_user = None
        existing_user_id = None
        
        try:
            # Query users table by email using GSI
            response = users_table.query(
                IndexName='email-index',
                KeyConditionExpression=Key('email').eq(email)
            )
            
            if response.get('Items') and len(response['Items']) > 0:
                existing_user = response['Items'][0]
                existing_user_id = existing_user.get('user_id')
                print(f"⚠ EXISTING USER FOUND!")
                print(f"  Existing user_id: {existing_user_id}")
                print(f"  New user_id: {user_id}")
                print(f"  Email: {email}")
                
                if existing_user_id != user_id:
                    print(f"  → Account linking needed: Different Cognito user_ids for same email")
                else:
                    print(f"  → Same user_id: Updating existing record")
            else:
                print(f"✓ No existing user found with email {email}")
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            if error_code == 'ResourceNotFoundException':
                print(f"⚠ GSI 'email-index' not found yet (may need to wait for table update)")
                print(f"  Continuing with new user creation...")
            else:
                print(f"✗ ERROR checking existing email:")
                print(f"  Error Code: {error_code}")
                print(f"  Error Message: {e.response.get('Error', {}).get('Message', str(e))}")
                print(f"  Continuing with new user creation...")
        except Exception as e:
            print(f"✗ UNEXPECTED ERROR checking existing email: {str(e)}")
            print(f"  Traceback: {traceback.format_exc()}")
            print(f"  Continuing with new user creation...")
        
        # Create or update user record in users table
        print(f"\n{'='*80}")
        if existing_user and existing_user_id != user_id:
            print(f"LINKING ACCOUNT - UPDATING EXISTING USER RECORD")
        elif existing_user and existing_user_id == user_id:
            print(f"UPDATING EXISTING USER RECORD")
        else:
            print(f"CREATING NEW USER RECORD IN {users_table_name}")
        print(f"{'='*80}")
        
        user_item = {
            'user_id': user_id,
            'email': email,
            'fullname': fullname,
            'username': username,
            'created_at': created_at,
            'updated_at': created_at
        }
        
        # Store profile picture if available (from social logins)
        if picture:
            user_item['picture'] = picture
            print(f"  → Storing profile picture")
        
        # Mark profile as incomplete for social logins (need username and DOB)
        if is_social_login:
            user_item['profile_complete'] = False
            print(f"  → Profile marked as incomplete (social login)")
        else:
            # Email sign-ups have username and DOB, so profile is complete
            user_item['profile_complete'] = True
            print(f"  → Profile marked as complete (email sign-up)")
        
        # If account linking (different user_id, same email)
        if existing_user and existing_user_id != user_id:
            # Use the original user_id to maintain data consistency
            # Store the new Cognito user_id as a linked identity
            user_item['user_id'] = existing_user_id  # Keep original user_id
            user_item['cognito_user_ids'] = existing_user.get('cognito_user_ids', [])
            if existing_user_id not in user_item['cognito_user_ids']:
                user_item['cognito_user_ids'].append(existing_user_id)
            if user_id not in user_item['cognito_user_ids']:
                user_item['cognito_user_ids'].append(user_id)
            user_item['created_at'] = existing_user.get('created_at', created_at)  # Keep original created_at
            print(f"  → Linking accounts: Using original user_id {existing_user_id}")
            print(f"  → Linked Cognito user_ids: {user_item['cognito_user_ids']}")
        elif existing_user and existing_user_id == user_id:
            # Same user_id, just update the record
            user_item['created_at'] = existing_user.get('created_at', created_at)  # Keep original created_at
            print(f"  → Updating existing record with same user_id")
        
        # Only add date_of_birth if it exists and not already set
        if date_of_birth and (not existing_user or not existing_user.get('date_of_birth')):
            user_item['date_of_birth'] = date_of_birth
        
        # Preserve existing data if updating
        if existing_user:
            # Keep existing username if new one is auto-generated (for social logins)
            if not username or username.startswith('user_'):
                user_item['username'] = existing_user.get('username', username)
            # Keep existing fullname if it's better (has more info)
            if existing_user.get('fullname') and len(existing_user.get('fullname', '')) > len(fullname):
                user_item['fullname'] = existing_user.get('fullname')
        
        print(f"User item to insert/update: {json.dumps(user_item, indent=2, default=str)}")
        
        try:
            response = users_table.put_item(Item=user_item)
            if existing_user:
                print(f"✓ Successfully updated user record (account linked)")
            else:
                print(f"✓ Successfully created user record")
            print(f"  Response: {json.dumps(response.get('ResponseMetadata', {}), indent=2, default=str)}")
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            error_message = e.response.get('Error', {}).get('Message', str(e))
            print(f"✗ ERROR creating/updating user record:")
            print(f"  Error Code: {error_code}")
            print(f"  Error Message: {error_message}")
            print(f"  Full Error: {json.dumps(e.response, indent=2, default=str)}")
            print(f"  Traceback: {traceback.format_exc()}")
            # Continue anyway - might be duplicate or other issue
        except Exception as e:
            print(f"✗ UNEXPECTED ERROR creating/updating user record: {str(e)}")
            print(f"  Error type: {type(e).__name__}")
            print(f"  Traceback: {traceback.format_exc()}")
        
        # Create or update profile record with username as PK
        # FOR SOCIAL LOGINS: Don't create profile record yet - wait for user to complete profile
        if is_social_login:
            print(f"\n{'='*80}")
            print(f"SKIPPING PROFILE CREATION FOR SOCIAL LOGIN")
            print(f"{'='*80}")
            print(f"  → Profile will be created when user completes profile form")
            print(f"  → User record created with profile_complete: False")
            print(f"  → User must complete profile to set username and date_of_birth")
        else:
            # Only create profile for email sign-ups (they have username/date_of_birth)
            print(f"\n{'='*80}")
            print(f"CREATING/UPDATING PROFILE RECORD IN {profiles_table_name}")
            print(f"{'='*80}")
            
            # Use the final user_id (may be linked account's original user_id)
            final_user_id = existing_user_id if (existing_user and existing_user_id != user_id) else user_id
            
            # Check if profile already exists for this user_id
            existing_profile = None
            try:
                print(f"Checking for existing profile with user_id: {final_user_id}")
                # Query profiles table by user_id using GSI
                profile_response = profiles_table.query(
                    IndexName='user_id-index',
                    KeyConditionExpression=Key('user_id').eq(final_user_id)
                )
                
                if profile_response.get('Items') and len(profile_response['Items']) > 0:
                    existing_profile = profile_response['Items'][0]
                    existing_username = existing_profile.get('username')
                    print(f"⚠ EXISTING PROFILE FOUND!")
                    print(f"  Existing username: {existing_username}")
                    print(f"  New username: {username}")
                    
                    # Use existing username to maintain consistency
                    if existing_username:
                        username = existing_username
                        print(f"  → Using existing username: {username}")
                else:
                    print(f"✓ No existing profile found for user_id {final_user_id}")
            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code', 'Unknown')
                if error_code == 'ResourceNotFoundException':
                    print(f"⚠ GSI 'user_id-index' not found (should exist, continuing...)")
                else:
                    print(f"✗ ERROR checking existing profile:")
                    print(f"  Error Code: {error_code}")
                    print(f"  Error Message: {e.response.get('Error', {}).get('Message', str(e))}")
            except Exception as e:
                print(f"✗ UNEXPECTED ERROR checking existing profile: {str(e)}")
                print(f"  Traceback: {traceback.format_exc()}")
            
            # Check if username already exists (different user)
            try:
                print(f"Checking if username '{username}' already exists...")
                existing_username_check = profiles_table.get_item(Key={'username': username})
                
                if 'Item' in existing_username_check:
                    existing_profile_user_id = existing_username_check['Item'].get('user_id')
                    if existing_profile_user_id != final_user_id:
                        # Username exists for different user - append user_id to make it unique
                        original_username = username
                        username = f"{username}_{final_user_id[:8]}"
                        print(f"⚠ Username conflict detected!")
                        print(f"  Original username: {original_username}")
                        print(f"  Existing user_id: {existing_profile_user_id}")
                        print(f"  New user_id: {final_user_id}")
                        print(f"  New username: {username}")
                    else:
                        print(f"✓ Username '{username}' belongs to same user - will update")
                else:
                    print(f"✓ Username '{username}' is available")
            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code', 'Unknown')
                error_message = e.response.get('Error', {}).get('Message', str(e))
                print(f"✗ ERROR checking existing username:")
                print(f"  Error Code: {error_code}")
                print(f"  Error Message: {error_message}")
                print(f"  Continuing anyway...")
            except Exception as e:
                print(f"✗ UNEXPECTED ERROR checking username: {str(e)}")
                print(f"  Traceback: {traceback.format_exc()}")
            
            profile_item = {
                'username': username,
                'user_id': final_user_id,  # Use final user_id (may be linked account's original)
                'email': email,
                'full_name': fullname,
                'created_at': created_at,
                'updated_at': created_at
            }
            
            # Store profile picture if available
            if picture:
                profile_item['picture'] = picture
            
            # Preserve existing profile data if updating
            if existing_profile:
                profile_item['created_at'] = existing_profile.get('created_at', created_at)
                # Keep existing data if it's better
                if existing_profile.get('full_name') and len(existing_profile.get('full_name', '')) > len(fullname):
                    profile_item['full_name'] = existing_profile.get('full_name')
            
            # Only add date_of_birth if it exists and not already set
            if date_of_birth and (not existing_profile or not existing_profile.get('date_of_birth')):
                profile_item['date_of_birth'] = date_of_birth
            
            print(f"Profile item to insert/update: {json.dumps(profile_item, indent=2, default=str)}")
            
            try:
                response = profiles_table.put_item(Item=profile_item)
                if existing_profile:
                    print(f"✓ Successfully updated profile record")
                else:
                    print(f"✓ Successfully created profile record")
                print(f"  Response: {json.dumps(response.get('ResponseMetadata', {}), indent=2, default=str)}")
            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code', 'Unknown')
                error_message = e.response.get('Error', {}).get('Message', str(e))
                print(f"✗ ERROR creating/updating profile record:")
                print(f"  Error Code: {error_code}")
                print(f"  Error Message: {error_message}")
                print(f"  Full Error: {json.dumps(e.response, indent=2, default=str)}")
                print(f"  Traceback: {traceback.format_exc()}")
                # Don't fail the confirmation
            except Exception as e:
                print(f"✗ UNEXPECTED ERROR creating/updating profile record: {str(e)}")
                print(f"  Error type: {type(e).__name__}")
                print(f"  Traceback: {traceback.format_exc()}")
        
        print(f"\n{'='*80}")
        print(f"POST-CONFIRMATION COMPLETED SUCCESSFULLY")
        print(f"{'='*80}\n")
        
        return event  # Return event to allow Cognito to continue
        
    except Exception as e:
        print(f"\n{'='*80}")
        print(f"✗ FATAL ERROR IN POST-CONFIRMATION HANDLER")
        print(f"{'='*80}")
        print(f"Error: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        print(f"Full traceback:")
        print(traceback.format_exc())
        print(f"{'='*80}\n")
        # Don't fail the confirmation, but log the error
        return event