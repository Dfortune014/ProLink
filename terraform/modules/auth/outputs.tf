output "user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "user_pool_client_id" {
  value = aws_cognito_user_pool_client.main.id
}

output "identity_pool_id" {
  value = aws_cognito_identity_pool.main.id
}

output "domain" {
  value = aws_cognito_user_pool_domain.main.domain
}

output "authorizer_uri" {
  value = "arn:aws:apigateway:${data.aws_region.current.name}:cognito-idp:${data.aws_region.current.name}:${aws_cognito_user_pool.main.id}/userpool/${aws_cognito_user_pool.main.id}"
}

output "user_pool_arn" {
  description = "ARN of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.arn
}

