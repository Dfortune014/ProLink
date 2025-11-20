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

# ============================================
# Lambda Functions
# ============================================

# Profiles Lambda
resource "aws_lambda_function" "profiles" {
  filename         = "${path.module}/../lambda/profiles.zip"
  function_name    = "${var.project_name}-profiles"
  role            = aws_iam_role.profiles_lambda.arn
  handler         = "index.handler"
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

# ============================================
# API Gateway HTTP API v2
# ============================================

resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"
  description   = "ProLink API Gateway HTTP API"

  cors_configuration {
    allow_origins = var.cors_origins
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["content-type", "authorization"]
    max_age       = 300
  }
}

# JWT Authorizer
resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.project_name}-jwt-authorizer"

  jwt_configuration {
    audience = [var.cognito_user_pool_client_id]
    issuer   = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${var.cognito_user_pool_id}"
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

# ============================================
# API Gateway Stage
# ============================================

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true
}