import boto3
import json
import logging
import os
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

secrets_client = boto3.client("secretsmanager")
cognito_client = boto3.client("cognito-idp")


def lambda_handler(event, context):
    """
    Entry point for Secrets Manager rotation Lambda
    """
    secret_arn = event["SecretId"]
    token = event["ClientRequestToken"]
    step = event["Step"]

    # --- Metadata validation ---
    metadata = secrets_client.describe_secret(SecretId=secret_arn)

    if not metadata.get("RotationEnabled"):
        raise ValueError("Secret rotation is not enabled")

    versions = metadata["VersionIdsToStages"]

    if token not in versions:
        raise ValueError("ClientRequestToken not found in secret versions")

    if step == "createSecret":
        create_secret(secret_arn, token)
    elif step == "setSecret":
        set_secret(secret_arn, token)
    elif step == "testSecret":
        test_secret(secret_arn, token)
    elif step == "finishSecret":
        finish_secret(secret_arn, token)
    else:
        raise ValueError(f"Invalid rotation step: {step}")


# -------------------------------------------------------------------
# Rotation Steps
# -------------------------------------------------------------------


def create_secret(secret_arn, token):
    """
    Generate and store a new secret version with AWSPENDING
    Rotates through pre-created OAuth secret sets
    """

    # Ensure current secret exists
    current_secret = secrets_client.get_secret_value(
        SecretId=secret_arn,
        VersionStage="AWSCURRENT"
    )

    # Check if pending version already exists (idempotency)
    try:
        secrets_client.get_secret_value(
            SecretId=secret_arn,
            VersionId=token,
            VersionStage="AWSPENDING"
        )
        logger.info("Pending secret already exists. Skipping creation.")
        return
    except secrets_client.exceptions.ResourceNotFoundException:
        pass

    # Parse current secret
    secret_data = json.loads(current_secret["SecretString"])

    # Check if secret has multiple sets structure
    if "secret_sets" in secret_data and isinstance(secret_data["secret_sets"], list):
        # Rotate through secret sets
        current_index = secret_data.get("current_index", 0)
        secret_sets = secret_data["secret_sets"]

        if not secret_sets:
            raise ValueError("No secret sets found in secret. Please add at least one secret set.")

        # Calculate next index (rotate through sets)
        next_index = (current_index + 1) % len(secret_sets)
        next_secret_set = secret_sets[next_index]

        logger.info(f"Rotating from secret set {current_index} to {next_index}")

        # Create new version with next secret set
        new_secret_dict = {
            "secret_sets": secret_sets,  # Keep all sets
            "current_index": next_index,  # Update current index
            "google_client_secret": next_secret_set.get("google_client_secret"),
            "linkedin_client_secret": next_secret_set.get("linkedin_client_secret")
        }
    else:
        # Legacy format: try to get from tags or use current
        logger.info("Using legacy secret format, attempting to rotate")

        metadata = secrets_client.describe_secret(SecretId=secret_arn)
        tags = {tag["Key"]: tag["Value"] for tag in metadata.get("Tags", [])}

        new_google_secret = tags.get("new_google_client_secret") or os.environ.get("NEW_GOOGLE_CLIENT_SECRET")
        new_linkedin_secret = tags.get("new_linkedin_client_secret") or os.environ.get("NEW_LINKEDIN_CLIENT_SECRET")

        # If no new secrets, keep current ones
        new_secret_dict = {
            "google_client_secret": new_google_secret or secret_data.get("google_client_secret"),
            "linkedin_client_secret": new_linkedin_secret or secret_data.get("linkedin_client_secret")
        }

    # Validate secrets
    if not new_secret_dict.get("google_client_secret") or not new_secret_dict.get("linkedin_client_secret"):
        raise ValueError("Missing OAuth secrets. Ensure secret sets are properly configured.")

    # Create new version
    secrets_client.put_secret_value(
        SecretId=secret_arn,
        ClientRequestToken=token,
        SecretString=json.dumps(new_secret_dict),
        VersionStages=["AWSPENDING"]
    )

    logger.info("Created new AWSPENDING secret version")


def set_secret(secret_arn, token):
    """
    Apply the secret to Cognito Identity Providers
    """
    logger.info("setSecret step: updating Cognito Identity Providers")

    # Get the pending secret
    pending_secret = secrets_client.get_secret_value(
        SecretId=secret_arn,
        VersionId=token,
        VersionStage="AWSPENDING"
    )
    new_secret_dict = json.loads(pending_secret["SecretString"])

    # Get Cognito User Pool ID
    user_pool_id = os.environ.get("COGNITO_USER_POOL_ID")
    if not user_pool_id:
        metadata = secrets_client.describe_secret(SecretId=secret_arn)
        tags = {tag["Key"]: tag["Value"] for tag in metadata.get("Tags", [])}
        user_pool_id = tags.get("cognito_user_pool_id")

    if not user_pool_id:
        raise ValueError("COGNITO_USER_POOL_ID must be provided via environment or secret tags")

    # Update Google Identity Provider
    try:
        cognito_client.update_identity_provider(
            UserPoolId=user_pool_id,
            ProviderName="Google",
            ProviderDetails={
                "client_secret": new_secret_dict["google_client_secret"]
            }
        )
        logger.info("Updated Google Identity Provider with new secret")
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceNotFoundException":
            logger.warning("Google Identity Provider not found, skipping update")
        else:
            raise

    # Update LinkedIn Identity Provider
    try:
        cognito_client.update_identity_provider(
            UserPoolId=user_pool_id,
            ProviderName="LinkedIn",
            ProviderDetails={
                "client_secret": new_secret_dict["linkedin_client_secret"]
            }
        )
        logger.info("Updated LinkedIn Identity Provider with new secret")
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceNotFoundException":
            logger.warning("LinkedIn Identity Provider not found, skipping update")
        else:
            raise

    logger.info("Successfully set new secrets in Cognito")


def test_secret(secret_arn, token):
    """
    Validate the pending secret by checking Cognito Identity Providers
    """
    logger.info("testSecret step: validating Cognito Identity Providers")

    # Get the pending secret
    pending_secret = secrets_client.get_secret_value(
        SecretId=secret_arn,
        VersionId=token,
        VersionStage="AWSPENDING"
    )
    new_secret_dict = json.loads(pending_secret["SecretString"])

    # Get Cognito User Pool ID
    user_pool_id = os.environ.get("COGNITO_USER_POOL_ID")
    if not user_pool_id:
        metadata = secrets_client.describe_secret(SecretId=secret_arn)
        tags = {tag["Key"]: tag["Value"] for tag in metadata.get("Tags", [])}
        user_pool_id = tags.get("cognito_user_pool_id")

    if not user_pool_id:
        raise ValueError("COGNITO_USER_POOL_ID must be provided")

    # Test Google Identity Provider
    try:
        google_provider = cognito_client.describe_identity_provider(
            UserPoolId=user_pool_id,
            ProviderName="Google"
        )
        if google_provider["IdentityProvider"]["ProviderDetails"].get("client_secret") != new_secret_dict["google_client_secret"]:
            raise ValueError("Google secret mismatch in Cognito")
        logger.info("Google Identity Provider test passed")
    except ClientError as e:
        if e.response["Error"]["Code"] != "ResourceNotFoundException":
            raise

    # Test LinkedIn Identity Provider
    try:
        linkedin_provider = cognito_client.describe_identity_provider(
            UserPoolId=user_pool_id,
            ProviderName="LinkedIn"
        )
        if linkedin_provider["IdentityProvider"]["ProviderDetails"].get("client_secret") != new_secret_dict["linkedin_client_secret"]:
            raise ValueError("LinkedIn secret mismatch in Cognito")
        logger.info("LinkedIn Identity Provider test passed")
    except ClientError as e:
        if e.response["Error"]["Code"] != "ResourceNotFoundException":
            raise

    logger.info("Successfully tested new secrets")


def finish_secret(secret_arn, token):
    """
    Promote AWSPENDING version to AWSCURRENT
    """
    metadata = secrets_client.describe_secret(SecretId=secret_arn)

    current_version = None

    for version_id, stages in metadata["VersionIdsToStages"].items():
        if "AWSCURRENT" in stages:
            current_version = version_id
            break

    if current_version == token:
        logger.info("Version already marked as AWSCURRENT")
        return

    secrets_client.update_secret_version_stage(
        SecretId=secret_arn,
        VersionStage="AWSCURRENT",
        MoveToVersionId=token,
        RemoveFromVersionId=current_version
    )

    logger.info("Promoted new secret to AWSCURRENT")