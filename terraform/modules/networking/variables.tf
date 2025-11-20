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