data "aws_region" "current" {}

# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-user-pool"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  mfa_configuration = "OFF"

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }
  
  schema {
    name                = "fullname"
    attribute_data_type = "String"
    required            = false  # Cognito doesn't support required custom attributes
    mutable             = true
  }

  schema {
    name                = "date_of_birth"
    attribute_data_type = "String"
    required            = false
    mutable             = true
  }

  schema {
    name                = "username"
    attribute_data_type = "String"
    required            = false  # Cognito doesn't support required custom attributes
    mutable             = false
  }

  schema {
    name                = "picture"
    attribute_data_type = "String"
    required            = false
    mutable             = true
  }

  # Ignore schema changes - AWS Cognito doesn't allow modifying schema after creation
  lifecycle {
    ignore_changes = [schema]
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
  dynamic "lambda_config" {
    for_each = var.post_confirmation_lambda_arn != "" || var.pre_signup_lambda_arn != "" ? [1] : []
    content {
      post_confirmation = var.post_confirmation_lambda_arn != "" ? var.post_confirmation_lambda_arn : ""
      pre_sign_up       = var.pre_signup_lambda_arn != "" ? var.pre_signup_lambda_arn : ""
    }
  }
}

# Cognito User Pool Client
resource "aws_cognito_user_pool_client" "main" {
  name         = "${var.project_name}-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false # For web apps

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  supported_identity_providers = concat(
    ["COGNITO"],
    var.google_client_id != "" ? ["Google"] : [],
    var.linkedin_client_id != "" ? ["LinkedIn"] : []
  )

  callback_urls                = var.callback_urls
  logout_urls                  = var.logout_urls
  allowed_oauth_flows          = ["code", "implicit"]
  allowed_oauth_scopes         = ["email", "openid", "profile"]
  allowed_oauth_flows_user_pool_client = true

  # Ensure identity providers are created before the client
  depends_on = [
    aws_cognito_identity_provider.google,
    aws_cognito_identity_provider.linkedin
  ]
}

# Cognito User Pool Domain
resource "aws_cognito_user_pool_domain" "main" {
  domain       = var.domain_prefix
  user_pool_id = aws_cognito_user_pool.main.id
}

# Identity Providers
resource "aws_cognito_identity_provider" "google" {
  count         = var.google_client_id != "" ? 1 : 0
  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id     = var.google_client_id
    client_secret = var.google_client_secret
    authorize_scopes = "openid email profile"
  }

  attribute_mapping = {
    email    = "email"
    username = "sub"
    name     = "name"
    picture  = "picture"
    given_name  = "given_name"
    family_name = "family_name"
  }
}

resource "aws_cognito_identity_provider" "linkedin" {
  count         = var.linkedin_client_id != "" ? 1 : 0
  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "LinkedIn"
  provider_type = "OIDC"

  provider_details = {
    client_id                      = var.linkedin_client_id
    client_secret                  = var.linkedin_client_secret
    authorize_scopes               = "openid profile email"
    # Use OIDC issuer - Cognito will auto-discover JWKS from discovery endpoint
    oidc_issuer                    = "https://www.linkedin.com/oauth"
    authorize_url                  = "https://www.linkedin.com/oauth/v2/authorization"
    token_url                      = "https://www.linkedin.com/oauth/v2/accessToken"
    attributes_url                 = "https://api.linkedin.com/v2/userinfo"
    attributes_request_method      = "GET"
    # Don't specify jwks_uri - let Cognito discover it from oidc_issuer
  }

  attribute_mapping = {
    email    = "email"
    username = "sub"
    name     = "name"
    picture  = "picture"
    given_name  = "given_name"
    family_name = "family_name"
  }
}

# Cognito Identity Pool
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "${var.project_name}-identity-pool"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.main.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = false
  }
}

# API Gateway Authorizer
resource "aws_api_gateway_authorizer" "cognito" {
  name                   = "${var.project_name}-cognito-authorizer"
  rest_api_id            = aws_api_gateway_rest_api.main.id
  type                   = "COGNITO_USER_POOLS"
  provider_arns          = [aws_cognito_user_pool.main.arn]
  identity_source        = "method.request.header.Authorization"
}

# Dummy API Gateway for authorizer (you'll replace this with your actual API)
resource "aws_api_gateway_rest_api" "main" {
  name = "${var.project_name}-api"
}

