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
    description = "The callback URLs for the Cognito domain (must be explicitly set, no default for security)"
    type        = list(string)
    # No default - must be explicitly set to avoid localhost in production
    validation {
        condition     = length(var.callback_urls) > 0
        error_message = "callback_urls must contain at least one URL"
    }
    validation {
        condition = alltrue([
            for url in var.callback_urls : can(regex("^https?://", url))
        ])
        error_message = "All callback URLs must be valid HTTP/HTTPS URLs"
    }
}

variable "logout_urls" {
    description = "The logout URLs for the Cognito domain (must be explicitly set, no default for security)"
    type        = list(string)
    # No default - must be explicitly set to avoid localhost in production
    validation {
        condition     = length(var.logout_urls) > 0
        error_message = "logout_urls must contain at least one URL"
    }
    validation {
        condition = alltrue([
            for url in var.logout_urls : can(regex("^https?://", url))
        ])
        error_message = "All logout URLs must be valid HTTP/HTTPS URLs"
    }
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
  description = "Environment name (dev, staging, or production)"
  type        = string
  # No default - must be explicitly set to avoid incorrect tagging in production
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, or production"
  }
}

variable "cors_origins" {
  description = "Allowed CORS origins for API Gateway (must be explicitly set, no default for security)"
  type        = list(string)
  # No default - must be explicitly set to avoid localhost in production
  validation {
    condition     = length(var.cors_origins) > 0
    error_message = "cors_origins must contain at least one origin"
  }
  validation {
    condition = alltrue([
      for origin in var.cors_origins : can(regex("^https?://", origin))
    ])
    error_message = "All CORS origins must be valid HTTP/HTTPS URLs"
  }
}

# OAuth Secret Sets for Rotation
variable "set1_google_client_secret" {
  description = "Google OAuth client secret - Set 1"
  type        = string
  sensitive   = true
  default     = ""
}

variable "set1_linkedin_client_secret" {
  description = "LinkedIn OAuth client secret - Set 1"
  type        = string
  sensitive   = true
  default     = ""
}

variable "set2_google_client_secret" {
  description = "Google OAuth client secret - Set 2"
  type        = string
  sensitive   = true
  default     = ""
}

variable "set2_linkedin_client_secret" {
  description = "LinkedIn OAuth client secret - Set 2"
  type        = string
  sensitive   = true
  default     = ""
}

variable "set3_google_client_secret" {
  description = "Google OAuth client secret - Set 3"
  type        = string
  sensitive   = true
  default     = ""
}

variable "set3_linkedin_client_secret" {
  description = "LinkedIn OAuth client secret - Set 3"
  type        = string
  sensitive   = true
  default     = ""
}