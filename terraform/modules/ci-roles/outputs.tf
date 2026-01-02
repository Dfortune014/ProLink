output "terraform_plan_role_arn" {
  description = "ARN of the Terraform Plan IAM role"
  value       = aws_iam_role.github_terraform_plan.arn
}

output "terraform_apply_role_arn" {
  description = "ARN of the Terraform Apply IAM role"
  value       = aws_iam_role.github_terraform_apply.arn
}

output "security_scan_role_arn" {
  description = "ARN of the Security Scan IAM role"
  value       = aws_iam_role.github_security_scan.arn
}

output "oidc_provider_arn" {
  description = "ARN of the OIDC provider (for reference)"
  value       = local.oidc_provider_arn
}