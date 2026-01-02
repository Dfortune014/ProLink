# GitHub Actions OIDC Provider
# Note: This should be created manually first (see scripts/setup-oidc.ps1)
# Terraform doesn't manage OIDC provider creation well due to thumbprint updates

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}


# Local values
locals {
  github_repo_full = "${var.github_org}/${var.github_repo}"
  oidc_provider_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
}

# ============================================================================
# Role 1: Terraform Plan (Read-Only)
# ============================================================================
resource "aws_iam_role" "github_terraform_plan" {
  name = "GitHubActions-TerraformPlan"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = local.oidc_provider_arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${local.github_repo_full}:*"
        }
      }
    }]
  })

  tags = {
    Name        = "GitHubActions-TerraformPlan"
    Environment = "CI/CD"
    ManagedBy   = "Terraform"
  }
}

resource "aws_iam_role_policy" "github_terraform_plan" {
  name = "TerraformPlanPolicy"
  role = aws_iam_role.github_terraform_plan.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.s3_backend_bucket}",
          "arn:aws:s3:::${var.s3_backend_bucket}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:DescribeTable",
          "dynamodb:GetItem"
        ]
        Resource = "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.dynamodb_lock_table}"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:prolink/*"
      },
      {
        Effect = "Allow"
        Action = [
          "sts:GetCallerIdentity",
          "ec2:DescribeRegions",
          "ec2:DescribeAvailabilityZones"
        ]
        Resource = "*"
      },
      # Read-only Terraform plan permissions
      {
        Effect = "Allow"
        Action = [
          "iam:Get*",
          "iam:List*",
          "ec2:Describe*",
          "lambda:Get*",
          "lambda:List*",
          "apigateway:GET",
          "cognito-idp:Describe*",
          "cognito-idp:List*",
          "dynamodb:Describe*",
          "dynamodb:List*",
          "s3:Get*",
          "s3:List*",
          "logs:Describe*",
          "logs:FilterLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

# ============================================================================
# Role 2: Terraform Apply (Write Access)
# ============================================================================
resource "aws_iam_role" "github_terraform_apply" {
  name = "GitHubActions-TerraformApply"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = local.oidc_provider_arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:${local.github_repo_full}:ref:refs/heads/main"
        }
      }
    }]
  })

  tags = {
    Name        = "GitHubActions-TerraformApply"
    Environment = "CI/CD"
    ManagedBy   = "Terraform"
  }
}

resource "aws_iam_role_policy" "github_terraform_apply" {
  name = "TerraformApplyPolicy"
  role = aws_iam_role.github_terraform_apply.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.s3_backend_bucket}",
          "arn:aws:s3:::${var.s3_backend_bucket}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:DescribeTable",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem"
        ]
        Resource = "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.dynamodb_lock_table}"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecret"
        ]
        Resource = "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:prolink/*"
      },
      {
        Effect = "Allow"
        Action = [
          "sts:GetCallerIdentity",
          "ec2:DescribeRegions",
          "ec2:DescribeAvailabilityZones"
        ]
        Resource = "*"
      },
      # Full Terraform permissions (scoped to prolink resources)
      {
        Effect = "Allow"
        Action = [
          "iam:*",
          "lambda:*",
          "apigateway:*",
          "cognito-idp:*",
          "dynamodb:*",
          "s3:*",
          "logs:*",
          "events:*",
          "cloudwatch:*",
          "ec2:*",
          "ec2:CreateTags",
          "ec2:DeleteTags"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:RequestTag/ManagedBy" = "Terraform"
          }
        }
      }
    ]
  })
}

# ============================================================================
# Role 3: Security Scan (Read-Only for Security Tools)
# ============================================================================
resource "aws_iam_role" "github_security_scan" {
  name = "GitHubActions-SecurityScan"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = local.oidc_provider_arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${local.github_repo_full}:*"
        }
      }
    }]
  })

  tags = {
    Name        = "GitHubActions-SecurityScan"
    Environment = "CI/CD"
    ManagedBy   = "Terraform"
  }
}

resource "aws_iam_role_policy" "github_security_scan" {
  name = "SecurityScanPolicy"
  role = aws_iam_role.github_security_scan.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sts:GetCallerIdentity",
          "ec2:Describe*",
          "lambda:Get*",
          "lambda:List*",
          "apigateway:GET",
          "cognito-idp:Describe*",
          "cognito-idp:List*",
          "dynamodb:Describe*",
          "dynamodb:List*",
          "s3:Get*",
          "s3:List*",
          "logs:Describe*",
          "logs:FilterLogEvents",
          "iam:Get*",
          "iam:List*"
        ]
        Resource = "*"
      }
    ]
  })
}