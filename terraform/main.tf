data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

provider "aws" {
    region = var.aws_region
}

# Networking VPC's and subnets
module "network" {
  source = "./modules/networking"
  project_name = var.project_name
  vpc_cidr = var.vpc_cidr
}
module "cognito" {
  source = "./modules/auth"
  
  project_name       = var.project_name
  domain_prefix      = var.cognito_domain_prefix
  callback_urls      = var.callback_urls
  logout_urls        = var.logout_urls
  google_client_id   = var.google_client_id
  google_client_secret = local.google_client_secret
  linkedin_client_id = var.linkedin_client_id
  linkedin_client_secret = local.linkedin_client_secret
  post_confirmation_lambda_arn = module.api.post_confirmation_lambda_arn
  pre_signup_lambda_arn = module.api.pre_signup_lambda_arn
}

module "api" {
  source = "./modules/api"
  
  project_name              = var.project_name
  environment               = var.environment
  cognito_user_pool_id      = module.cognito.user_pool_id
  cognito_user_pool_client_id = module.cognito.user_pool_client_id
  cognito_user_pool_arn     = module.cognito.user_pool_arn
  cors_origins              = var.cors_origins
}

# Cloudtrail and logging Setup 
module "monitoring" {
  source = "./modules/audit"
  
  project_name = var.project_name
  s3_bucket_name = "${var.project_name}-cloudtrail-logs"
}

# CI/CD IAM Roles for GitHub Actions
module "ci_roles" {
  source = "./modules/ci-roles"
  
  github_org  = "Dfortune014"
  github_repo = "LinkPro"
  
  s3_backend_bucket    = "prolink-terraform-state"
  s3_backend_key       = "terraform.tfstate"
  dynamodb_lock_table  = "terraform-state-lock"
}