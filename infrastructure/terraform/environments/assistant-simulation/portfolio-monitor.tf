locals {
  portfolio_monitor_name = "investoros-${var.environment}-portfolio-monitor"
}

resource "aws_dynamodb_table" "portfolio_monitor" {
  name         = "${local.portfolio_monitor_name}-records"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "account_id"
  range_key    = "record_id"

  attribute {
    name = "account_id"
    type = "S"
  }
  attribute {
    name = "record_id"
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

resource "aws_iam_role_policy" "portfolio_monitor_api" {
  name = "${local.portfolio_monitor_name}-api-records"
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:Query"]
        Resource = aws_dynamodb_table.portfolio_monitor.arn
      },
      {
        Effect   = "Allow"
        Action   = ["lambda:InvokeFunction"]
        Resource = aws_lambda_function.portfolio_monitor.arn
      }
    ]
  })
}

resource "aws_iam_role" "portfolio_monitor" {
  name = "${local.portfolio_monitor_name}-execution"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
  tags = local.common_tags
}

resource "aws_iam_role_policy" "portfolio_monitor" {
  name = "${local.portfolio_monitor_name}-runtime"
  role = aws_iam_role.portfolio_monitor.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:PutItem"], Resource = aws_dynamodb_table.portfolio_monitor.arn },
      { Effect = "Allow", Action = ["dynamodb:GetItem"], Resource = local.portfolio_table_arn },
      { Effect = "Allow", Action = ["bedrock:InvokeModel"], Resource = [local.profile_arn, local.model_arn] },
      { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.portfolio_monitor.arn}:*" }
    ]
  })
}

resource "aws_cloudwatch_log_group" "portfolio_monitor" {
  name              = "/aws/lambda/${local.portfolio_monitor_name}"
  retention_in_days = 30
  tags              = local.common_tags
}

resource "aws_lambda_function" "portfolio_monitor" {
  function_name                  = local.portfolio_monitor_name
  description                    = "Scans explicitly linked portfolio tickers and creates reviewable news cases."
  role                           = aws_iam_role.portfolio_monitor.arn
  runtime                        = "python3.12"
  handler                        = "investoros_api.portfolio_monitor.handler"
  s3_bucket                      = aws_s3_object.api_package.bucket
  s3_key                         = aws_s3_object.api_package.key
  source_code_hash               = filebase64sha256(local.package_path)
  timeout                        = 300
  memory_size                    = 512
  reserved_concurrent_executions = 1

  environment {
    variables = {
      BEDROCK_MODEL_ID             = var.bedrock_model_id
      DEMO_CONTEXTS                = jsonencode(local.demo_contexts)
      DEMO_PORTFOLIO_MODE          = "dynamodb"
      PORTFOLIOS_TABLE_NAME        = local.portfolio_table_name
      PORTFOLIO_MONITOR_TABLE_NAME = aws_dynamodb_table.portfolio_monitor.name
    }
  }
  depends_on = [aws_iam_role_policy.portfolio_monitor]
  tags       = local.common_tags
}

resource "aws_iam_role" "portfolio_monitor_scheduler" {
  name = "${local.portfolio_monitor_name}-scheduler"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "scheduler.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
  tags = local.common_tags
}

resource "aws_iam_role_policy" "portfolio_monitor_scheduler" {
  name = "${local.portfolio_monitor_name}-invoke"
  role = aws_iam_role.portfolio_monitor_scheduler.id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = ["lambda:InvokeFunction"], Resource = aws_lambda_function.portfolio_monitor.arn }]
  })
}

resource "aws_scheduler_schedule" "portfolio_monitor" {
  name                         = local.portfolio_monitor_name
  description                  = "Vérifie les nouvelles des tickers explicitement associés aux portefeuilles toutes les six heures."
  schedule_expression          = "rate(6 hours)"
  schedule_expression_timezone = "UTC"
  state                        = "ENABLED"
  flexible_time_window {
    mode = "OFF"
  }
  target {
    arn      = aws_lambda_function.portfolio_monitor.arn
    role_arn = aws_iam_role.portfolio_monitor_scheduler.arn
    input    = jsonencode({ source = "investoros.portfolio-monitor", "detail-type" = "Scheduled portfolio news scan" })
    retry_policy {
      maximum_event_age_in_seconds = 3600
      maximum_retry_attempts       = 1
    }
  }
  depends_on = [aws_iam_role_policy.portfolio_monitor_scheduler]
}
