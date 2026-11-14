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

  aws_region                 = var.aws_region
  name_prefix                = local.name_prefix
  github_repository          = "yasserzanari/InvestorOS-53-Polyfinance2026"
  github_repository_owner_id = "86859526"
  github_repository_id       = "1458019839"
  common_tags                = local.common_tags
}
