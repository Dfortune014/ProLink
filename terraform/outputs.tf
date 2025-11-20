output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.cognito.user_pool_id
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  value       = module.cognito.user_pool_client_id
}

output "cognito_identity_pool_id" {
  description = "Cognito Identity Pool ID"
  value       = module.cognito.identity_pool_id
}

output "cognito_domain" {
  description = "Cognito domain for hosted UI"
  value       = module.cognito.domain
}

output "api_gateway_authorizer_uri" {
  description = "API Gateway authorizer URI"
  value       = module.cognito.authorizer_uri
}

output "api_gateway_url" {
  description = "API Gateway HTTP API endpoint URL"
  value       = module.api.api_gateway_url
}

output "s3_bucket_name" {
  description = "S3 bucket name for assets"
  value       = module.api.s3_bucket_name
}