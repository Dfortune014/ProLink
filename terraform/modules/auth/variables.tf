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
