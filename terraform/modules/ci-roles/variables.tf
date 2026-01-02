variable "github_org" {
  description = "GitHub organization or username"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "LinkPro"
}

variable "s3_backend_bucket" {
  description = "S3 bucket for Terraform state"
  type        = string
  default     = "prolink-terraform-state"
}

variable "s3_backend_key" {
  description = "S3 key for Terraform state"
  type        = string
  default     = "terraform.tfstate"
}

variable "dynamodb_lock_table" {
  description = "DynamoDB table for Terraform state locking"
  type        = string
  default     = "terraform-state-lock"
}