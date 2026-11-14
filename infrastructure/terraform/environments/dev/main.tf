provider "aws" {
  region = var.aws_region
}

locals {
  name_prefix = "investoros-${var.environment}"
  common_tags = {
    Project     = "InvestorOS"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}
