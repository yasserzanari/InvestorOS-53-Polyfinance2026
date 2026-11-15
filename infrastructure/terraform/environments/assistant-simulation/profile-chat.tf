locals {
  profile_chat_name = "investoros-${var.environment}-profile-chat"
}

resource "aws_dynamodb_table" "profile_chat_jobs" {
  name         = "${local.profile_chat_name}-jobs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "job_id"
  attribute {
    name = "job_id"
    type = "S"
  }
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
  server_side_encryption {
    enabled = true
  }
  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "profile_chat_worker" {
  name              = "/aws/lambda/${local.profile_chat_name}-worker"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_iam_role" "profile_chat_worker" {
  name = "${local.profile_chat_name}-worker-execution"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
  tags = local.common_tags
}

resource "aws_iam_role_policy" "profile_chat_worker" {
  name = "${local.profile_chat_name}-worker-runtime"
  role = aws_iam_role.profile_chat_worker.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:UpdateItem"], Resource = aws_dynamodb_table.profile_chat_jobs.arn },
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:UpdateItem"], Resource = local.accounts_table_arn },
      { Effect = "Allow", Action = ["dynamodb:GetItem"], Resource = local.portfolio_table_arn },
      { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.profile_chat_worker.arn}:*" },
      { Effect = "Allow", Action = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"], Resource = [local.profile_arn, local.model_arn] },
      { Effect = "Allow", Action = ["lambda:InvokeFunction"], Resource = "arn:${data.aws_partition.current.partition}:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:investoros-${var.environment}-api" }
    ]
  })
}

resource "aws_lambda_function" "profile_chat_worker" {
  function_name    = "${local.profile_chat_name}-worker"
  description      = "Profile chat jobs with durable progress beyond the HTTP API timeout."
  role             = aws_iam_role.profile_chat_worker.arn
  runtime          = "python3.12"
  handler          = "investoros_api.main.handler"
  filename         = local.package_path
  source_code_hash = filebase64sha256(local.package_path)
  timeout          = 120
  memory_size      = 512
  environment {
    variables = {
      BEDROCK_MODEL_ID            = var.bedrock_model_id
      DEMO_CONTEXTS               = jsonencode(local.demo_contexts)
      DEMO_PORTFOLIO_MODE         = "dynamodb"
      ENVIRONMENT                 = var.environment
      PORTFOLIOS_TABLE_NAME       = local.portfolio_table_name
      SOURCE_WORKSPACE_TABLE      = local.accounts_table_name
      PROFILE_CHAT_JOBS_TABLE     = aws_dynamodb_table.profile_chat_jobs.name
      RESEARCH_LAMBDA_FUNCTION    = "investoros-${var.environment}-api"
      REQUIRE_ADMIN_AUTH          = "true"
      SIMULATION_X_SEARCH_ENABLED = "false"
    }
  }
  depends_on = [aws_iam_role_policy.profile_chat_worker]
  tags       = local.common_tags
}

resource "aws_lambda_function_event_invoke_config" "profile_chat_worker" {
  function_name                = aws_lambda_function.profile_chat_worker.function_name
  maximum_event_age_in_seconds = 60
  maximum_retry_attempts       = 0
}

resource "aws_iam_role_policy" "profile_chat_dispatch" {
  name = "${local.profile_chat_name}-dispatch"
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"], Resource = aws_dynamodb_table.profile_chat_jobs.arn },
      { Effect = "Allow", Action = ["lambda:InvokeFunction"], Resource = aws_lambda_function.profile_chat_worker.arn }
    ]
  })
}
