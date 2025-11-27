variable "project_name" {}
variable "domain_prefix" {}
variable "callback_urls" { type = list(string) }

variable "logout_urls" {
  type = list(string)
}

variable "google_client_id" {
  default = ""
}

variable "google_client_secret" {
  default   = ""
  sensitive = true
}

variable "linkedin_client_id" {
  default = ""
}

variable "linkedin_client_secret" {
  default   = ""
  sensitive = true
}

variable "post_confirmation_lambda_arn" {
  description = "ARN of the Post-Confirmation Lambda function"
  type        = string
  default     = ""
}

variable "pre_signup_lambda_arn" {
  description = "ARN of the Pre-SignUp Lambda function"
  type        = string
  default     = ""
}