locals {
  function_name = "${var.name_prefix}-api"
  allowed_origins = distinct([
    var.frontend_origin,
    "http://localhost:5173"
  ])
}

resource "aws_iam_role" "lambda_execution" {
  name        = "${var.name_prefix}-api-execution"
  description = "Runtime role for the InvestorOS public demo API."
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = var.common_tags
}

resource "aws_iam_role_policy" "runtime" {
  name = "${var.name_prefix}-api-runtime"
  role = aws_iam_role.lambda_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadDemoRecords"
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:ReadDataForReplication"]
        Resource = values(var.table_arns)
      },
      {
        Sid      = "WriteFunctionLogs"
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${var.lambda_log_group_arn}:*"
      }
    ]
  })
}

resource "aws_lambda_function" "api" {
  function_name                  = local.function_name
  description                    = "Read-only FastAPI endpoint for InvestorOS fictional demo data."
  role                           = aws_iam_role.lambda_execution.arn
  runtime                        = "python3.12"
  handler                        = "investoros_api.main.handler"
  filename                       = var.package_path
  source_code_hash               = filebase64sha256(var.package_path)
  timeout                        = 10
  memory_size                    = 256
  reserved_concurrent_executions = 5
  publish                        = false

  environment {
    variables = {
      ACCOUNTS_TABLE_NAME     = var.table_names.accounts
      PROFILES_TABLE_NAME     = var.table_names.profiles
      PORTFOLIOS_TABLE_NAME   = var.table_names.portfolios
      ANALYSES_TABLE_NAME     = var.table_names.analyses
      DEMO_ACCOUNT_ID         = var.demo_account_id
      DEMO_PROFILE_ID         = var.demo_profile_id
      DEMO_PORTFOLIO_ID       = var.demo_portfolio_id
      DEMO_CONTEXTS           = jsonencode(var.demo_contexts)
      POWERTOOLS_SERVICE_NAME = "investoros-api"
      ENVIRONMENT             = var.environment
    }
  }

  depends_on = [aws_iam_role_policy.runtime]
  tags       = var.common_tags
}

resource "aws_apigatewayv2_api" "http" {
  name          = "${var.name_prefix}-http-api"
  protocol_type = "HTTP"
  description   = "InvestorOS HTTP API for health and fictional demo context."

  cors_configuration {
    allow_origins = local.allowed_origins
    allow_methods = ["GET", "OPTIONS"]
    allow_headers = ["content-type"]
    max_age       = 300
  }

  tags = var.common_tags
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 10000
}

resource "aws_apigatewayv2_route" "health" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /health"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "demo_overview" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /v1/demo/overview"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
  tags        = var.common_tags

  default_route_settings {
    throttling_burst_limit = 10
    throttling_rate_limit  = 5
  }
}

resource "aws_lambda_permission" "api_health" {
  statement_id  = "AllowHttpApiHealth"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/GET/health"
}

resource "aws_lambda_permission" "api_demo_overview" {
  statement_id  = "AllowHttpApiDemoOverview"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/GET/v1/demo/overview"
}
