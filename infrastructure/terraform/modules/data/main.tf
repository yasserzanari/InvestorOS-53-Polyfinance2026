locals {
  table_specs = {
    accounts   = { range_key = null }
    profiles   = { range_key = "profile_id" }
    portfolios = { range_key = "portfolio_id" }
    analyses   = { range_key = "analysis_id" }
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
  for_each   = var.demo_personas
  table_name = aws_dynamodb_table.records["accounts"].name
  hash_key   = "account_id"
  item = jsonencode({
    account_id = { S = each.value.account_id }
    payload = { S = each.key == "mateo" ? jsonencode({
      account_id       = each.value.account_id
      display_name     = "Compte de démonstration InvestorOS"
      is_demo          = true
      data_class       = "fictional"
      financial_linked = false
      }) : jsonencode({
      account_id       = each.value.account_id
      display_name     = each.value.account_name
      persona_id       = each.key
      is_demo          = true
      data_class       = "fictional"
      financial_linked = false
    }) }
  })

  lifecycle { prevent_destroy = true }
}

resource "aws_dynamodb_table_item" "demo_profile" {
  for_each   = var.demo_personas
  table_name = aws_dynamodb_table.records["profiles"].name
  hash_key   = "account_id"
  range_key  = "profile_id"
  item = jsonencode({
    account_id = { S = each.value.account_id }
    profile_id = { S = each.value.profile_id }
    payload = { S = each.key == "mateo" ? jsonencode({
      account_id      = each.value.account_id
      profile_id      = each.value.profile_id
      display_name    = "Investisseur équilibré (démo)"
      is_demo         = true
      status          = "confirmed"
      objectives      = ["Croissance à long terme"]
      horizon_years   = 8
      risk_tolerance  = each.value.risk_tolerance
      loss_capacity   = each.value.loss_capacity
      liquidity_needs = each.value.liquidity_needs
      constraints     = each.value.constraints
      unknown_fields  = ["Capacité réelle à absorber une perte"]
      source          = "fictional_fixture"
      }) : jsonencode({
      account_id      = each.value.account_id
      profile_id      = each.value.profile_id
      display_name    = each.value.account_name
      persona_id      = each.key
      age             = each.value.age
      is_demo         = true
      status          = "confirmed"
      objectives      = [each.value.objective]
      horizon_years   = each.value.horizon_years
      risk_tolerance  = each.value.risk_tolerance
      loss_capacity   = each.value.loss_capacity
      liquidity_needs = each.value.liquidity_needs
      constraints     = each.value.constraints
      preferences     = each.value.preferences
      knowledge       = each.value.knowledge
      unknown_fields  = each.value.unknown_fields
      source          = "fictional_fixture"
    }) }
  })

  lifecycle { prevent_destroy = true }
}

resource "aws_dynamodb_table_item" "demo_portfolio" {
  for_each   = var.demo_personas
  table_name = aws_dynamodb_table.records["portfolios"].name
  hash_key   = "account_id"
  range_key  = "portfolio_id"
  item = jsonencode({
    account_id   = { S = each.value.account_id }
    portfolio_id = { S = each.value.portfolio_id }
    payload = { S = each.key == "mateo" ? jsonencode({
      account_id   = each.value.account_id
      portfolio_id = each.value.portfolio_id
      profile_id   = each.value.profile_id
      display_name = "Portefeuille équilibré (démo)"
      is_demo      = true
      currency     = "CAD"
      total_value  = sum([for position in each.value.positions : position.value])
      as_of        = "fixture"
      data_source  = "fictional_fixture"
      positions    = each.value.positions
      }) : jsonencode({
      account_id   = each.value.account_id
      portfolio_id = each.value.portfolio_id
      profile_id   = each.value.profile_id
      persona_id   = each.key
      display_name = each.value.portfolio_name
      is_demo      = true
      currency     = "CAD"
      total_value  = sum([for position in each.value.positions : position.value])
      as_of        = "fixture"
      data_source  = "fictional_fixture"
      positions    = each.value.positions
    }) }
  })

  lifecycle { prevent_destroy = true }
}

moved {
  from = aws_dynamodb_table_item.demo_account
  to   = aws_dynamodb_table_item.demo_account["mateo"]
}

moved {
  from = aws_dynamodb_table_item.demo_profile
  to   = aws_dynamodb_table_item.demo_profile["mateo"]
}

moved {
  from = aws_dynamodb_table_item.demo_portfolio
  to   = aws_dynamodb_table_item.demo_portfolio["mateo"]
}
