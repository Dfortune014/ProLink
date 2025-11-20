output "api_gateway_url" {
  description = "API Gateway HTTP API endpoint URL"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "s3_bucket_name" {
  description = "S3 bucket name for assets"
  value       = aws_s3_bucket.assets.bucket
}

output "profiles_table_name" {
  description = "DynamoDB Profiles table name"
  value       = aws_dynamodb_table.profiles.name
}

output "links_table_name" {
  description = "DynamoDB Links table name"
  value       = aws_dynamodb_table.links.name
}

output "users_table_name" {
  description = "DynamoDB Users table name"
  value       = aws_dynamodb_table.users.name
}