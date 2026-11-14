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
  demo_personas = {
    amira = {
      account_id      = "demo-account-amira"
      profile_id      = "demo-profile-amira"
      portfolio_id    = "demo-portfolio-amira"
      account_name    = "Amira · Démo"
      age             = 26
      objective       = "Croissance à long terme"
      horizon_years   = 15
      risk_tolerance  = "high"
      loss_capacity   = "unknown"
      liquidity_needs = "unknown"
      preferences     = ["IA et technologies", "crypto", "diversification"]
      knowledge       = "unknown"
      constraints     = []
      unknown_fields  = ["Capacité financière à absorber une perte", "Besoins de liquidité"]
      portfolio_name  = "Portefeuille croissance diversifié (démo)"
      positions = [
        { id = "amira-tech", label = "Technologies et IA (fixture)", weight_pct = 35, value = 35000 },
        { id = "amira-global", label = "Actions mondiales diversifiées (fixture)", weight_pct = 30, value = 30000 },
        { id = "amira-crypto", label = "Crypto-actifs (fixture)", weight_pct = 10, value = 10000 },
        { id = "amira-bonds", label = "Obligations diversifiées (fixture)", weight_pct = 15, value = 15000 },
        { id = "amira-cash", label = "Liquidités (fixture)", weight_pct = 10, value = 10000 }
      ]
    }
    mateo = {
      account_id      = local.demo.account_id
      profile_id      = local.demo.profile_id
      portfolio_id    = local.demo.portfolio_id
      account_name    = "Mateo · Démo"
      age             = 41
      objective       = "Croissance équilibrée à moyen et long terme"
      horizon_years   = 10
      risk_tolerance  = "moderate"
      loss_capacity   = "unknown"
      liquidity_needs = "medium"
      preferences     = ["Critères ESG documentés", "Éviter les controverses importantes"]
      knowledge       = "unknown"
      constraints     = []
      unknown_fields  = ["Capacité financière à absorber une perte", "Méthode ESG souhaitée"]
      portfolio_name  = "Portefeuille équilibré (démo)"
      positions = [
        { id = "holding-001", label = "Actions mondiales (indice fictif)", weight_pct = 40, value = 40000 },
        { id = "holding-002", label = "Obligations diversifiées (indice fictif)", weight_pct = 25, value = 25000 },
        { id = "holding-003", label = "Actions canadiennes (indice fictif)", weight_pct = 20, value = 20000 },
        { id = "holding-004", label = "Liquidités (fixture)", weight_pct = 15, value = 15000 }
      ]
    }
    robert = {
      account_id      = "demo-account-robert"
      profile_id      = "demo-profile-robert"
      portfolio_id    = "demo-portfolio-robert"
      account_name    = "Robert · Démo"
      age             = 59
      objective       = "Préservation du capital et croissance"
      horizon_years   = 4
      risk_tolerance  = "low_to_moderate"
      loss_capacity   = "unknown"
      liquidity_needs = "unknown"
      preferences     = ["Peu attiré par la crypto"]
      knowledge       = "unknown"
      constraints     = []
      unknown_fields  = ["Capacité financière à absorber une perte", "Besoin de liquidité à court terme"]
      portfolio_name  = "Portefeuille préservation et croissance (démo)"
      positions = [
        { id = "robert-bonds", label = "Obligations court terme (fixture)", weight_pct = 40, value = 40000 },
        { id = "robert-cash", label = "Liquidités (fixture)", weight_pct = 30, value = 30000 },
        { id = "robert-equity", label = "Actions diversifiées (fixture)", weight_pct = 20, value = 20000 },
        { id = "robert-hyped", label = "Titre médiatisé à forte volatilité (fixture)", weight_pct = 10, value = 10000 }
      ]
    }
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
  demo_personas     = local.demo_personas
}

module "observability" {
  source = "../../modules/observability"

  name_prefix          = local.name_prefix
  lambda_function_name = "${local.name_prefix}-api"
  common_tags          = local.common_tags
}

module "backend" {
  source = "../../modules/backend"

  name_prefix                   = local.name_prefix
  environment                   = var.environment
  package_path                  = "${path.root}/../../../../apps/api/build/investoros-api.zip"
  frontend_origin               = "https://${module.frontend.cloudfront_domain_name}"
  table_names                   = module.data.table_names
  table_arns                    = module.data.table_arns
  lambda_log_group_arn          = module.observability.lambda_log_group_arn
  demo_account_id               = module.data.demo_account_id
  demo_profile_id               = module.data.demo_profile_id
  demo_portfolio_id             = module.data.demo_portfolio_id
  demo_contexts                 = module.data.demo_contexts
  common_tags                   = local.common_tags
  simulation_x_search_enabled   = var.simulation_x_search_enabled
  x_api_bearer_token_secret_arn = var.x_api_bearer_token_secret_arn
}
