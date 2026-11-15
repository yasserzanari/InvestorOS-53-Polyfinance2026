locals {
  name_prefix  = "investoros-${var.environment}-assistant-simulation"
  package_path = var.package_path != "" ? var.package_path : "${path.root}/../../../../apps/api/build/investoros-api.zip"
  api_id       = trimprefix(split(".", data.terraform_remote_state.foundation.outputs.api_url)[0], "https://")
  personas     = jsondecode(file("${path.root}/../../../../apps/api/src/investoros_api/demo_personas.json"))
  demo_contexts = {
    for name, persona in local.personas : name => {
      account_id   = persona.account_id
      profile_id   = persona.profile_id
      portfolio_id = persona.portfolio_id
    }
  }
  model_arn              = "arn:${data.aws_partition.current.partition}:bedrock:*::foundation-model/${trimprefix(var.bedrock_model_id, "us.")}"
  profile_arn            = "arn:${data.aws_partition.current.partition}:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:inference-profile/${var.bedrock_model_id}"
  lambda_artifact_bucket = "investoros-${var.environment}-${data.aws_caller_identity.current.account_id}-lambda-artifacts-${var.aws_region}"
  cognito_issuer         = data.terraform_remote_state.foundation.outputs.cognito_issuer
  cognito_client_id      = data.terraform_remote_state.foundation.outputs.cognito_client_id
  portfolio_table_name   = data.terraform_remote_state.foundation.outputs.demo_table_names.portfolios
  portfolio_table_arn    = "arn:${data.aws_partition.current.partition}:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${local.portfolio_table_name}"
  accounts_table_name    = data.terraform_remote_state.foundation.outputs.demo_table_names.accounts
  accounts_table_arn     = "arn:${data.aws_partition.current.partition}:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${local.accounts_table_name}"
  common_tags = {
    Project     = "InvestorOS"
    Environment = var.environment
    ManagedBy   = "Terraform"
    Component   = "assistant-simulation-api"
  }
}

data "terraform_remote_state" "foundation" {
  backend = "s3"
  config = {
    bucket = "investoros-tfstate-010928221556-us-east-1"
    key    = "dev/terraform.tfstate"
    region = "us-east-1"
  }
}

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

data "aws_apigatewayv2_api" "application" {
  api_id = local.api_id
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${local.name_prefix}"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_s3_object" "api_package" {
  bucket                 = local.lambda_artifact_bucket
  key                    = "assistant-simulation/api-${filesha256(local.package_path)}.zip"
  source                 = local.package_path
  source_hash            = filebase64sha256(local.package_path)
  server_side_encryption = "AES256"
  tags                   = local.common_tags
}

resource "aws_iam_role" "api" {
  name        = "${local.name_prefix}-execution"
  description = "Runtime role for InvestorOS Assistant and Simulation routes."
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.common_tags
}

resource "aws_iam_role_policy" "api" {
  name = "${local.name_prefix}-runtime"
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadFictionalDemoPortfolio"
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem"]
        Resource = local.portfolio_table_arn
      },
      {
        Sid      = "PersistAuthorizedSources"
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
        Resource = local.accounts_table_arn
      },
      {
        Sid      = "WriteFunctionLogs"
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.api.arn}:*"
      },
      {
        Sid      = "InvokeConfiguredBedrockModel"
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
        Resource = [local.profile_arn, local.model_arn]
      },
      {
        Sid      = "StartFrenchLiveTranscription"
        Effect   = "Allow"
        Action   = ["transcribe:StartStreamTranscriptionWebSocket"]
        Resource = "*"
      },
      {
        Sid      = "ManageFinanceFrenchVocabulary"
        Effect   = "Allow"
        Action   = ["transcribe:GetVocabulary", "transcribe:UpdateVocabulary"]
        Resource = "arn:${data.aws_partition.current.partition}:transcribe:${var.aws_region}:${data.aws_caller_identity.current.account_id}:vocabulary/${local.name_prefix}-finance-fr-ca"
      }
    ]
  })
}

resource "aws_transcribe_vocabulary" "finance_fr_ca" {
  vocabulary_name = "${local.name_prefix}-finance-fr-ca"
  language_code   = "fr-CA"
  phrases = [
    "NVIDIA", "NVDA", "TSMC", "ASML", "Micron", "Broadcom", "AMD", "Intel",
    "Samsung", "Hynix", "Nasdaq", "ETF", "FNB", "PER", "dividende",
    "capitalisation", "rendement", "volatilite", "portefeuille", "semiconducteurs",
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "MU", "QCOM",
    "actions", "obligations", "options", "indice", "bourse", "cotation", "liquidite",
    "croissance", "allocation", "diversification", "risque", "spread", "volume",
    "cours", "plus-value", "moins-value", "benefice", "revenus", "marge", "EBITDA",
    "consensus", "guidance", "analyste", "surperformance", "sousperformance", "coupon",
    "duration", "taux", "inflation", "recession", "BPA", "PBR", "ROE", "ROIC",
    "capital", "rendements", "volatilites", "materiaux", "semi-conducteurs"
  ]
  tags = local.common_tags

  # The Admin console is the runtime editor for phrases; Terraform owns the resource and language.
  lifecycle {
    ignore_changes = [phrases]
  }
}

import {
  to = aws_transcribe_vocabulary.finance_fr_ca
  id = "investoros-dev-assistant-simulation-finance-fr-ca"
}

resource "aws_lambda_function" "api" {
  function_name                  = local.name_prefix
  description                    = "Amazon Bedrock chat and evidence-backed Simulation API routes."
  role                           = aws_iam_role.api.arn
  runtime                        = "python3.12"
  handler                        = "investoros_api.main.handler"
  s3_bucket                      = aws_s3_object.api_package.bucket
  s3_key                         = aws_s3_object.api_package.key
  source_code_hash               = filebase64sha256(local.package_path)
  timeout                        = 120
  memory_size                    = 512
  reserved_concurrent_executions = 2

  environment {
    variables = {
      PROFILE_CHAT_JOBS_TABLE          = aws_dynamodb_table.profile_chat_jobs.name
      PROFILE_CHAT_WORKER_FUNCTION     = aws_lambda_function.profile_chat_worker.function_name
      BEDROCK_MODEL_ID                 = var.bedrock_model_id
      CORS_ALLOWED_ORIGINS             = "https://${data.terraform_remote_state.foundation.outputs.cloudfront_domain_name},http://localhost:5173"
      RESEARCH_API_URL                 = data.aws_apigatewayv2_api.application.api_endpoint
      DEMO_CONTEXTS                    = jsonencode(local.demo_contexts)
      DEMO_PORTFOLIO_MODE              = "dynamodb"
      ENVIRONMENT                      = var.environment
      PORTFOLIOS_TABLE_NAME            = local.portfolio_table_name
      SOURCE_WORKSPACE_TABLE           = local.accounts_table_name
      POWERTOOLS_SERVICE_NAME          = "investoros-assistant-simulation"
      SIMULATION_X_SEARCH_ENABLED      = "false"
      X_API_BEARER_TOKEN_SECRET_ARN    = ""
      REQUIRE_ADMIN_AUTH               = "true"
      VOICE_TRANSCRIBE_VOCABULARY_NAME = aws_transcribe_vocabulary.finance_fr_ca.vocabulary_name
    }
  }

  depends_on = [aws_iam_role_policy.api, aws_transcribe_vocabulary.finance_fr_ca]
  tags       = local.common_tags
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = data.aws_apigatewayv2_api.application.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 29000
}

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = data.aws_apigatewayv2_api.application.id
  name             = "${local.name_prefix}-cognito-jwt"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  jwt_configuration {
    audience = [local.cognito_client_id]
    issuer   = local.cognito_issuer
  }
}

resource "aws_apigatewayv2_route" "profiles" {
  api_id             = data.aws_apigatewayv2_api.application.id
  route_key          = "ANY /v1/profiles/{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "simulation" {
  api_id             = data.aws_apigatewayv2_api.application.id
  route_key          = "ANY /v1/simulation/{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "profiles_preflight" {
  api_id             = data.aws_apigatewayv2_api.application.id
  route_key          = "OPTIONS /v1/profiles/{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "simulation_preflight" {
  api_id             = data.aws_apigatewayv2_api.application.id
  route_key          = "OPTIONS /v1/simulation/{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "NONE"
}

resource "aws_lambda_permission" "profiles" {
  statement_id  = "AllowAssistantProfilesRoutes"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${data.aws_apigatewayv2_api.application.execution_arn}/*/*/v1/profiles/*"
}

resource "aws_lambda_permission" "simulation" {
  statement_id  = "AllowSimulationRoutes"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${data.aws_apigatewayv2_api.application.execution_arn}/*/*/v1/simulation/*"
}

resource "aws_lambda_permission" "preflight" {
  statement_id  = "AllowAssistantPreflightRoutes"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${data.aws_apigatewayv2_api.application.execution_arn}/*/OPTIONS/*"
}
