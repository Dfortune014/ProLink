variable "project_name" {
  description = "The name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID for JWT authorizer"
  type        = string
  default     = ""
}

variable "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID for JWT authorizer"
  type        = string
  default     = ""
}

variable "cors_origins" {
  description = "Allowed CORS origins"
  type        = list(string)
  default     = ["*"]
}

variable "cognito_user_pool_arn" {
  description = "ARN of the Cognito User Pool"
  type        = string
  default     = ""
}
variable "s3_assets_bucket_name" {
  description = "Name of the S3 bucket for assets (if not provided, will be auto-generated)"
  type        = string
  default     = ""
}