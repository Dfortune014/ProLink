variable "aws_region" {
    description = "The AWS region to deploy the resources"
    type = string
    default = "us-east-1"
}

variable "project_name" {
    description = "The name of the project"
    type = string
    default = "proLink"
}

variable "vpc_cidr" {
    description = "The CIDR block for the VPC"
    type = string
    default = "10.0.0.0/16"
}

variable "cognito_domain_prefix" {
    description = "The prefix for the Cognito domain"
    type = string
}

variable "callback_urls" {
    description = "The callback URLs for the Cognito domain"
    type = list(string)
    default = ["http://localhost:3000/auth/callback"]
}

variable "logout_urls" {
    description = "The logout URLs for the Cognito domain"
    type = list(string)
    default = ["http://localhost:3000"]
}

variable "google_client_id" {
    description = "The Google client ID for the Cognito domain"
    type = string
    default = ""
}

variable "google_client_secret" {
    description = "The Google client secret for the Cognito domain"
    type = string
    sensitive = true
    default = ""
}

variable "linkedin_client_id" {
    description = "The LinkedIn client ID for the Cognito domain"
    type = string
    default = ""
}

variable "linkedin_client_secret" {
    description = "The LinkedIn client secret for the Cognito domain"
    type = string
    sensitive = true
    default = ""
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "cors_origins" {
  description = "Allowed CORS origins for API Gateway"
  type        = list(string)
  default     = ["http://localhost:3000"]
}