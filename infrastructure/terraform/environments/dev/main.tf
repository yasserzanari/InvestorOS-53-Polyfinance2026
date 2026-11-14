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

module "frontend" {
  source = "../../modules/frontend"

  aws_region        = var.aws_region
  name_prefix       = local.name_prefix
  github_repository = "yasserzanari/InvestorOS-53-Polyfinance2026"
  common_tags       = local.common_tags
}
