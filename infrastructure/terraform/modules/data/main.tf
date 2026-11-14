locals {
  table_specs = {
    accounts   = { range_key = null }
    profiles   = { range_key = "profile_id" }
    portfolios = { range_key = "portfolio_id" }
    analyses   = { range_key = "analysis_id" }
  }

  demo_account = {
    account_id       = var.demo_account_id
    display_name     = "Compte de démonstration InvestorOS"
    is_demo          = true
    data_class       = "fictional"
    financial_linked = false
  }

  demo_profile = {
    account_id      = var.demo_account_id
    profile_id      = var.demo_profile_id
    display_name    = "Investisseur équilibré (démo)"
    is_demo         = true
    status          = "confirmed"
    objectives      = ["Croissance à long terme"]
    horizon_years   = 8
    risk_tolerance  = "moderate"
    loss_capacity   = "unknown"
    liquidity_needs = "medium"
    constraints     = []
    unknown_fields  = ["Capacité réelle à absorber une perte"]
    source          = "fictional_fixture"
  }

  demo_portfolio = {
    account_id   = var.demo_account_id
    portfolio_id = var.demo_portfolio_id
    profile_id   = var.demo_profile_id
    display_name = "Portefeuille équilibré (démo)"
    is_demo      = true
    currency     = "CAD"
    total_value  = 100000
    as_of        = "fixture"
    data_source  = "fictional_fixture"
    positions = [
      { id = "holding-001", label = "Actions mondiales (indice fictif)", weight_pct = 40, value = 40000 },
      { id = "holding-002", label = "Obligations diversifiées (indice fictif)", weight_pct = 25, value = 25000 },
      { id = "holding-003", label = "Actions canadiennes (indice fictif)", weight_pct = 20, value = 20000 },
      { id = "holding-004", label = "Liquidités (fixture)", weight_pct = 15, value = 15000 }
    ]
  }
}

resource "aws_dynamodb_table" "records" {
  for_each = local.table_specs

  name                        = "${var.name_prefix}-${each.key}"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "account_id"
  range_key                   = each.value.range_key
  deletion_protection_enabled = true

  attribute {
    name = "account_id"
    type = "S"
  }

  dynamic "attribute" {
    for_each = each.value.range_key == null ? [] : [each.value.range_key]
    content {
      name = attribute.value
      type = "S"
    }
  }

  server_side_encryption { enabled = true }
  point_in_time_recovery { enabled = true }
  tags = var.common_tags
}

resource "aws_dynamodb_table_item" "demo_account" {
  table_name = aws_dynamodb_table.records["accounts"].name
  hash_key   = "account_id"
  item = jsonencode({
    account_id = { S = var.demo_account_id }
    payload    = { S = jsonencode(local.demo_account) }
  })

  lifecycle { prevent_destroy = true }
}

resource "aws_dynamodb_table_item" "demo_profile" {
  table_name = aws_dynamodb_table.records["profiles"].name
  hash_key   = "account_id"
  range_key  = "profile_id"
  item = jsonencode({
    account_id = { S = var.demo_account_id }
    profile_id = { S = var.demo_profile_id }
    payload    = { S = jsonencode(local.demo_profile) }
  })

  lifecycle { prevent_destroy = true }
}

resource "aws_dynamodb_table_item" "demo_portfolio" {
  table_name = aws_dynamodb_table.records["portfolios"].name
  hash_key   = "account_id"
  range_key  = "portfolio_id"
  item = jsonencode({
    account_id   = { S = var.demo_account_id }
    portfolio_id = { S = var.demo_portfolio_id }
    payload      = { S = jsonencode(local.demo_portfolio) }
  })

  lifecycle { prevent_destroy = true }
}
