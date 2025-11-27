data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ============================================
# DynamoDB Tables
# ============================================

resource "aws_dynamodb_table" "users" {
  name           = "${var.project_name}-users"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "user_id"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  # Global Secondary Index for email lookups (for account linking)
  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }

  tags = {
    Name        = "${var.project_name}-users"
    Environment = var.environment
  }
}

resource "aws_dynamodb_table" "profiles" {
  name           = "${var.project_name}-profiles"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "username"

  attribute {
    name = "username"
    type = "S"
  }

  # Global Secondary Index for user_id lookups
  global_secondary_index {
    name            = "user_id-index"
    hash_key        = "user_id"
    projection_type = "ALL"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  tags = {
    Name        = "${var.project_name}-profiles"
    Environment = var.environment
  }
}

resource "aws_dynamodb_table" "links" {
  name           = "${var.project_name}-links"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "user_id"
  range_key      = "link_id"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "link_id"
    type = "S"
  }

  tags = {
    Name        = "${var.project_name}-links"
    Environment = var.environment
  }
}

# ============================================
# S3 Bucket
# ============================================

resource "aws_s3_bucket" "assets" {
  bucket = "${var.project_name}-assets-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "${var.project_name}-assets"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# Bucket Policy: Public read for profile images, private for everything else
resource "aws_s3_bucket_policy" "assets" {
  bucket = aws_s3_bucket.assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "PublicReadProfileImages"
        Effect = "Allow"
        Principal = "*"
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.assets.arn}/users/*/profile/*"
      },
      {
        Sid    = "DenyInsecureUploads"
        Effect = "Deny"
        Principal = "*"
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.assets.arn}/*"
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# ============================================
# IAM Roles for Lambda Functions
# ============================================

# Profiles Lambda Role
resource "aws_iam_role" "profiles_lambda" {
  name = "${var.project_name}-profiles-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "profiles_lambda" {
  name = "${var.project_name}-profiles-lambda-policy"
  role = aws_iam_role.profiles_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.profiles.arn,
          "${aws_dynamodb_table.profiles.arn}/index/*",
          aws_dynamodb_table.users.arn
        ]
      }
    ]
  })
}

# Links Lambda Role
resource "aws_iam_role" "links_lambda" {
  name = "${var.project_name}-links-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "links_lambda" {
  name = "${var.project_name}-links-lambda-policy"
  role = aws_iam_role.links_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query"
        ]
        Resource = aws_dynamodb_table.links.arn
      }
    ]
  })
}

# Upload Lambda Role
resource "aws_iam_role" "upload_lambda" {
  name = "${var.project_name}-upload-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "upload_lambda" {
  name = "${var.project_name}-upload-lambda-policy"
  role = aws_iam_role.upload_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.assets.arn}/users/*"
      },
      {
        Effect = "Allow"
        Action = "s3:ListBucket"
        Resource = aws_s3_bucket.assets.arn
        Condition = {
          StringLike = {
            "s3:prefix" = "users/*"
          }
        }
      }
    ]
  })
}

# IAM Role for Post-Confirmation Lambda
resource "aws_iam_role" "post_confirmation_lambda" {
  name = "${var.project_name}-post-confirmation-lambda-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "post_confirmation_lambda" {
  name = "${var.project_name}-post-confirmation-lambda-policy"
  role = aws_iam_role.post_confirmation_lambda.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "arn:aws:logs:*:*:*",
          "arn:aws:logs:*:*:log-group:/aws/lambda/${var.project_name}-post-confirmation*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.users.arn,
          "${aws_dynamodb_table.users.arn}/*",
          "${aws_dynamodb_table.users.arn}/index/email-index",
          aws_dynamodb_table.profiles.arn,
          "${aws_dynamodb_table.profiles.arn}/*",
          "${aws_dynamodb_table.profiles.arn}/index/user_id-index"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:ListUsers"
        ]
        Resource = [
          var.cognito_user_pool_arn != "" ? var.cognito_user_pool_arn : "*"
        ]
      }
    ]
  })
}
# ============================================
# Lambda Functions
# ============================================

# Profiles Lambda
resource "aws_lambda_function" "profiles" {
  filename         = "${path.module}/../lambda/profiles.zip"
  function_name    = "${var.project_name}-profiles"
  role            = aws_iam_role.profiles_lambda.arn
  handler         = "main.handler"
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      PROFILES_TABLE = aws_dynamodb_table.profiles.name
      USERS_TABLE    = aws_dynamodb_table.users.name
    }
  }

  tags = {
    Name        = "${var.project_name}-profiles"
    Environment = var.environment
  }
}

# Links Lambda
resource "aws_lambda_function" "links" {
  filename         = "${path.module}/../lambda/links.zip"
  function_name    = "${var.project_name}-links"
  role            = aws_iam_role.links_lambda.arn
  handler         = "index.handler"
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      LINKS_TABLE = aws_dynamodb_table.links.name
    }
  }

  tags = {
    Name        = "${var.project_name}-links"
    Environment = var.environment
  }
}

# Upload Lambda
resource "aws_lambda_function" "upload" {
  filename         = "${path.module}/../lambda/upload.zip"
  function_name    = "${var.project_name}-upload"
  role            = aws_iam_role.upload_lambda.arn
  handler         = "index.handler"
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      S3_BUCKET = aws_s3_bucket.assets.bucket
    }
  }

  tags = {
    Name        = "${var.project_name}-upload"
    Environment = var.environment
  }
}

# Post-Confirmation Lambda
resource "aws_lambda_function" "post_confirmation" {
  filename         = "${path.module}/../lambda/post-confirmation.zip"
  function_name    = "${var.project_name}-post-confirmation"
  role            = aws_iam_role.post_confirmation_lambda.arn
  handler         = "main.handler"
  runtime         = "python3.11"
  timeout         = 30  # Increased timeout for debugging
  
  environment {
    variables = {
      USERS_TABLE    = aws_dynamodb_table.users.name
      PROFILES_TABLE = aws_dynamodb_table.profiles.name
    }
  }
  
  tags = {
    Name        = "${var.project_name}-post-confirmation"
    Environment = var.environment
  }
}

# CloudWatch Log Group for Post-Confirmation Lambda
resource "aws_cloudwatch_log_group" "post_confirmation" {
  name              = "/aws/lambda/${var.project_name}-post-confirmation"
  retention_in_days = 7
  
  tags = {
    Name        = "${var.project_name}-post-confirmation-logs"
    Environment = var.environment
  }
}

# Pre-SignUp Lambda
resource "aws_lambda_function" "pre_signup" {
  filename         = "${path.module}/../lambda/pre-signup.zip"
  function_name    = "${var.project_name}-pre-signup"
  role            = aws_iam_role.post_confirmation_lambda.arn  # Can reuse same role
  handler         = "main.handler"
  runtime         = "python3.11"
  timeout         = 10
  
  # No environment variables needed - uses Cognito API directly
  
  tags = {
    Name        = "${var.project_name}-pre-signup"
    Environment = var.environment
  }
}

# CloudWatch Log Group for Pre-SignUp Lambda
resource "aws_cloudwatch_log_group" "pre_signup" {
  name              = "/aws/lambda/${var.project_name}-pre-signup"
  retention_in_days = 7
  
  tags = {
    Name        = "${var.project_name}-pre-signup-logs"
    Environment = var.environment
  }
}

# Lambda Permission for Cognito to invoke Pre-SignUp Lambda
resource "aws_lambda_permission" "pre_signup_cognito" {
  statement_id  = "AllowExecutionFromCognito"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pre_signup.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = var.cognito_user_pool_arn != "" ? var.cognito_user_pool_arn : "*"
}

# ============================================
# API Gateway HTTP API v2
# ============================================

resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"
  description   = "ProLink API Gateway HTTP API"

  cors_configuration {
    allow_origins      = var.cors_origins
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers     = ["content-type", "authorization"]
    allow_credentials = true  # Required when using Authorization header
    max_age           = 300
    expose_headers    = []
  }
}

# JWT Authorizer
resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  # For API Gateway HTTP API v2, identity_sources extracts token from Authorization header
  # API Gateway automatically handles "Bearer " prefix when using $request.header.Authorization
  # The authorizer will extract the token from "Bearer <token>" format automatically
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.project_name}-jwt-authorizer"

  jwt_configuration {
    # For Cognito access tokens, the 'aud' claim may be undefined
    # Access tokens use 'client_id' claim instead, but API Gateway JWT authorizer checks 'aud'
    # If audience is empty, authorizer will skip audience validation (only validates issuer)
    # This is acceptable since we're validating the issuer which is sufficient for Cognito tokens
    audience = []  # Empty array = skip audience validation (Cognito access tokens don't have 'aud' claim)
    # Issuer must match exactly: https://cognito-idp.<region>.amazonaws.com/<user-pool-id>
    issuer   = var.cognito_user_pool_id != "" ? "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${var.cognito_user_pool_id}" : ""
  }
}

# ============================================
# API Routes - Profiles
# ============================================

resource "aws_apigatewayv2_integration" "profiles" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.profiles.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "profiles_post" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /profiles"
  target    = "integrations/${aws_apigatewayv2_integration.profiles.id}"
  authorizer_id = aws_apigatewayv2_authorizer.jwt.id
  authorization_type = "JWT"
}

resource "aws_apigatewayv2_route" "users_me" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /users/me"
  target    = "integrations/${aws_apigatewayv2_integration.profiles.id}"
  authorizer_id = aws_apigatewayv2_authorizer.jwt.id
  authorization_type = "JWT"
}

resource "aws_apigatewayv2_route" "profiles_get" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /profiles/{username}"
  target    = "integrations/${aws_apigatewayv2_integration.profiles.id}"
  # Public endpoint - no authorizer
}

# ============================================
# API Routes - Links
# ============================================

resource "aws_apigatewayv2_integration" "links" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.links.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "links_post" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /links"
  target    = "integrations/${aws_apigatewayv2_integration.links.id}"
  authorizer_id = aws_apigatewayv2_authorizer.jwt.id
  authorization_type = "JWT"
}

resource "aws_apigatewayv2_route" "links_delete" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "DELETE /links/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.links.id}"
  authorizer_id = aws_apigatewayv2_authorizer.jwt.id
  authorization_type = "JWT"
}

# ============================================
# API Routes - Upload
# ============================================

resource "aws_apigatewayv2_integration" "upload" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.upload.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "upload_post" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /upload-url"
  target    = "integrations/${aws_apigatewayv2_integration.upload.id}"
  authorizer_id = aws_apigatewayv2_authorizer.jwt.id
  authorization_type = "JWT"
}

# ============================================
# Lambda Permissions
# ============================================

resource "aws_lambda_permission" "profiles" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.profiles.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "links" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.links.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "upload" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.upload.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# Lambda Permission for Cognito to invoke Post-Confirmation Lambda
# This allows Cognito to invoke the Lambda function
resource "aws_lambda_permission" "post_confirmation_cognito" {
  statement_id  = "AllowExecutionFromCognito"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.post_confirmation.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = var.cognito_user_pool_arn != "" ? var.cognito_user_pool_arn : "*"
}

# ============================================
# API Gateway Stage
# ============================================

# CloudWatch Log Group for API Gateway Access Logs
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.project_name}-api"
  retention_in_days = 7

  tags = {
    Name        = "${var.project_name}-api-gateway-logs"
    Environment = var.environment
  }
}

# IAM Role for API Gateway to write logs
resource "aws_iam_role" "api_gateway_logging" {
  name = "${var.project_name}-api-gateway-logging-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "apigateway.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "api_gateway_logging" {
  name = "${var.project_name}-api-gateway-logging-policy"
  role = aws_iam_role.api_gateway_logging.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = "${aws_cloudwatch_log_group.api_gateway.arn}:*"
    }]
  })
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  # Enable access logging to debug JWT authorizer errors
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      error          = "$context.error.message"
      errorMessage   = "$context.error.messageString"
      authorizerError = "$context.authorizer.error"
      authorizerStatus = "$context.authorizer.status"
      identitySource = "$context.identity.sourceIp"
    })
  }

  default_route_settings {
    detailed_metrics_enabled = true
    # Increase throttling limits for development
    throttling_burst_limit = 100  # Maximum number of requests in a burst
    throttling_rate_limit  = 50   # Steady-state request rate (requests per second)
  }
}

# ============================================
# Username Availability Check
# ============================================

resource "aws_apigatewayv2_route" "username_check" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /username/check"
  target    = "integrations/${aws_apigatewayv2_integration.profiles.id}"
  # Public endpoint - no authorizer
}

# Explicit OPTIONS route - routes to Lambda which handles OPTIONS and returns CORS headers
# HTTP API v2 only supports proxy integrations (AWS_PROXY, HTTP_PROXY), so we route to Lambda
# The Lambda function handles OPTIONS and returns proper CORS headers (see main.py lines 86-112)
resource "aws_apigatewayv2_route" "username_check_options" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "OPTIONS /username/check"
  target    = "integrations/${aws_apigatewayv2_integration.profiles.id}"
  # Public endpoint - no authorizer
  # Lambda function handles OPTIONS and returns CORS headers
}
