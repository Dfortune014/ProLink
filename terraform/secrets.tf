############################################
# Secrets Manager: OAuth Secrets (Simplified - No Rotation)
############################################

# Create AWS Secrets Manager secret
resource "aws_secretsmanager_secret" "oauth_secrets" {
  name = "prolink/oauth/secrets"

  description = "OAuth client secrets for Google and LinkedIn"

  recovery_window_in_days = 7
}

# Store initial secret values
resource "aws_secretsmanager_secret_version" "oauth_secrets_version" {
  secret_id = aws_secretsmanager_secret.oauth_secrets.id

  secret_string = jsonencode({
    google_client_secret   = var.google_client_secret
    linkedin_client_secret = var.linkedin_client_secret
  })
}

# Read the secret for use in other resources
data "aws_secretsmanager_secret_version" "oauth_secrets_current" {
  secret_id = aws_secretsmanager_secret.oauth_secrets.id

  depends_on = [
    aws_secretsmanager_secret_version.oauth_secrets_version
  ]
}

locals {
  oauth_secrets = jsondecode(
    data.aws_secretsmanager_secret_version.oauth_secrets_current.secret_string
  )

  # Use secrets from Secrets Manager
  google_client_secret   = local.oauth_secrets.google_client_secret
  linkedin_client_secret = local.oauth_secrets.linkedin_client_secret
}