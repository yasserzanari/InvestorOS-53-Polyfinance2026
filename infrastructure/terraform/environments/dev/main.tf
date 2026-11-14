provider "aws" {
  region = var.aws_region
}

locals {
  name_prefix = "investoros-${var.environment}"
  demo = {
    account_id   = "demo-account-001"
    profile_id   = "demo-profile-balanced"
    portfolio_id = "demo-portfolio-001"
  }
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

module "data" {
  source = "../../modules/data"

  name_prefix       = local.name_prefix
  common_tags       = local.common_tags
  demo_account_id   = local.demo.account_id
  demo_profile_id   = local.demo.profile_id
  demo_portfolio_id = local.demo.portfolio_id
}

module "observability" {
  source = "../../modules/observability"

  name_prefix          = local.name_prefix
  lambda_function_name = "${local.name_prefix}-api"
  common_tags          = local.common_tags
}

module "backend" {
  source = "../../modules/backend"

  name_prefix          = local.name_prefix
  environment          = var.environment
  package_path         = "${path.root}/../../../../apps/api/build/investoros-api.zip"
  frontend_origin      = "https://${module.frontend.cloudfront_domain_name}"
  table_names          = module.data.table_names
  table_arns           = module.data.table_arns
  lambda_log_group_arn = module.observability.lambda_log_group_arn
  demo_account_id      = module.data.demo_account_id
  demo_profile_id      = module.data.demo_profile_id
  demo_portfolio_id    = module.data.demo_portfolio_id
  common_tags          = local.common_tags
}
