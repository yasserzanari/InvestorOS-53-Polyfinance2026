locals {
  function_name       = "${var.name_prefix}-api"
  bedrock_profile_arn = "arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:inference-profile/${var.bedrock_model_id}"
  bedrock_model_arn   = "arn:aws:bedrock:*::foundation-model/${trimprefix(var.bedrock_model_id, "us.")}"
  allowed_origins = distinct([
    var.frontend_origin,
    "http://localhost:5173"
  ])
}

data "aws_caller_identity" "current" {}

data "aws_lambda_function" "assistant" {
  function_name = "investoros-${var.environment}-assistant-simulation"
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
    Statement = concat([
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
        }, {
        Sid    = "ReadPlatformInventoryAndMetrics"
        Effect = "Allow"
        Action = [
          "apigateway:GET", "cloudfront:ListDistributions", "cloudwatch:GetMetricData",
          "dynamodb:DescribeTable", "dynamodb:ListTables", "lambda:ListFunctions",
          "s3:ListAllMyBuckets", "states:DescribeStateMachine", "states:ListExecutions",
          "states:ListStateMachines", "servicequotas:ListServiceQuotas", "ce:GetCostAndUsage"
        ]
        Resource = "*"
        }, {
        Sid      = "DescribeInvestorOSFunctions"
        Effect   = "Allow"
        Action   = ["lambda:GetFunctionConfiguration"]
        Resource = "arn:aws:lambda:*:*:function:${var.name_prefix}-*"
      },
      {
        Sid      = "InvokeConfiguredBedrockModel"
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
        Resource = [local.bedrock_profile_arn, local.bedrock_model_arn]

      }
      ], !var.simulation_x_search_enabled || var.x_api_bearer_token_secret_arn == "" ? [] : [{
        Sid      = "ReadXSearchToken"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = var.x_api_bearer_token_secret_arn
        }], var.admin_console_token_secret_arn == "" ? [] : [{
        Sid      = "ReadAdminConsoleToken"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = var.admin_console_token_secret_arn
    }])
  })

  # This role also carries permissions for the deployed research workflow.
  # Preserve those grants while this narrower module manages API auth.
  lifecycle {
    ignore_changes = [policy]
  }
}

resource "aws_lambda_function" "api" {
  function_name                  = local.function_name
  description                    = "InvestorOS demo data, Simulation, and Amazon Bedrock chat API."
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
      ACCOUNTS_TABLE_NAME            = var.table_names.accounts
      PROFILES_TABLE_NAME            = var.table_names.profiles
      PORTFOLIOS_TABLE_NAME          = var.table_names.portfolios
      ANALYSES_TABLE_NAME            = var.table_names.analyses
      DEMO_ACCOUNT_ID                = var.demo_account_id
      DEMO_PROFILE_ID                = var.demo_profile_id
      DEMO_PORTFOLIO_ID              = var.demo_portfolio_id
      DEMO_CONTEXTS                  = jsonencode(var.demo_contexts)
      DEMO_PORTFOLIO_MODE            = "dynamodb"
      REQUIRE_ADMIN_AUTH             = "true"
      CORS_ALLOWED_ORIGINS           = join(",", local.allowed_origins)
      POWERTOOLS_SERVICE_NAME        = "investoros-api"
      ENVIRONMENT                    = var.environment
      BEDROCK_MODEL_ID               = var.bedrock_model_id
      SIMULATION_X_SEARCH_ENABLED    = tostring(var.simulation_x_search_enabled)
      X_API_BEARER_TOKEN_SECRET_ARN  = var.simulation_x_search_enabled ? var.x_api_bearer_token_secret_arn : ""
      ADMIN_CONSOLE_TOKEN_SECRET_ARN = var.admin_console_token_secret_arn

    }
  }

  depends_on = [aws_iam_role_policy.runtime]

  # The live API Lambda also serves the separately maintained research stack.
  # Keep its research-owned environment values while Terraform manages this
  # module's demo/auth configuration.
  lifecycle {
    ignore_changes = [
      description,
      environment[0].variables["RESEARCH_ADMIN_TOKEN_SECRET_ARN"],
      environment[0].variables["RESEARCH_API_URL"],
      environment[0].variables["RESEARCH_EVENTS_TABLE_NAME"],
      environment[0].variables["RESEARCH_EVIDENCE_TABLE_NAME"],
      environment[0].variables["RESEARCH_QUOTAS_TABLE_NAME"],
      environment[0].variables["RESEARCH_RUNS_TABLE_NAME"],
      environment[0].variables["RESEARCH_SOURCES_TABLE_NAME"],
      environment[0].variables["RESEARCH_STATE_MACHINE_ARN"],
      memory_size,
      timeout,
    ]
  }

  tags = var.common_tags
}

resource "aws_apigatewayv2_api" "http" {
  name          = "${var.name_prefix}-http-api"
  protocol_type = "HTTP"
  description   = "InvestorOS HTTP API for health and fictional demo context."

  cors_configuration {
    allow_origins = local.allowed_origins
    allow_methods = ["GET", "POST", "PUT", "PATCH", "OPTIONS"]
    allow_headers = ["accept", "authorization", "content-type", "x-admin-token"]

    max_age = 300
  }

  tags = var.common_tags
}

resource "aws_cognito_user_pool" "application" {
  name                = "${var.name_prefix}-users"
  mfa_configuration   = "ON"
  deletion_protection = "ACTIVE"

  software_token_mfa_configuration {
    enabled = true
  }

  password_policy {
    minimum_length                   = 14
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 3
  }

  admin_create_user_config {
    allow_admin_create_user_only = true
    invite_message_template {
      email_subject = "InvestorOS account"
      email_message = "Hello {username}, your temporary InvestorOS password is {####}. Sign in to set a new password and enroll an authenticator app."
      sms_message   = "Hello {username}, your temporary InvestorOS password is {####}."
    }
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "admin_only"
      priority = 1
    }
  }

  user_attribute_update_settings {
    attributes_require_verification_before_update = []
  }

  tags = var.common_tags
}

resource "aws_cognito_user_group" "administrators" {
  name         = "administrators"
  user_pool_id = aws_cognito_user_pool.application.id
  description  = "InvestorOS application administrators."
  precedence   = 1
}

resource "aws_cognito_user_pool_domain" "application" {
  domain       = "investoros-dev-010928221556"
  user_pool_id = aws_cognito_user_pool.application.id
}

resource "aws_cognito_user_pool_client" "web" {
  name                                 = "${var.name_prefix}-web"
  user_pool_id                         = aws_cognito_user_pool.application.id
  generate_secret                      = false
  enable_token_revocation              = true
  prevent_user_existence_errors        = "ENABLED"
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid"]
  supported_identity_providers         = ["COGNITO"]
  callback_urls                        = ["${var.frontend_origin}/auth/callback", "http://localhost:5173/auth/callback"]
  logout_urls                          = [var.frontend_origin, "${var.frontend_origin}/login", "http://localhost:5173", "http://localhost:5173/login"]
  access_token_validity                = 15
  id_token_validity                    = 15
  refresh_token_validity               = 1
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
  refresh_token_rotation {
    feature                    = "ENABLED"
    retry_grace_period_seconds = 10
  }
}

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.http.id
  name             = "${var.name_prefix}-cognito-jwt"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  jwt_configuration {
    audience = [aws_cognito_user_pool_client.web.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.application.id}"
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000
}

resource "aws_apigatewayv2_integration" "preflight" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = data.aws_lambda_function.assistant.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 29000
}

resource "aws_apigatewayv2_route" "health" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /health"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "demo_overview" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /v1/demo/overview"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# The FastAPI app owns validation and routing for the profile and Simulation
# APIs. Keep an API Gateway proxy route so adding a documented FastAPI route
# does not silently work only in local development.
resource "aws_apigatewayv2_route" "fastapi" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "ANY /{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# A catch-all authenticated ANY route also matches browser preflight requests.
# Leave OPTIONS unauthenticated so CORS can negotiate headers before the real
# request is sent; all application methods remain protected by the JWT route.
resource "aws_apigatewayv2_route" "preflight" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "OPTIONS /{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.preflight.id}"
  authorization_type = "NONE"
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

resource "aws_lambda_permission" "api_fastapi" {
  statement_id  = "AllowHttpApiApplicationRoutes"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*/*"
}
