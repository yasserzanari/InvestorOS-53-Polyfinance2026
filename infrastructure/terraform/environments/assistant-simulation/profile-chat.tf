locals {
  profile_chat_name = "investoros-${var.environment}-profile-chat"
}

resource "aws_sqs_queue" "profile_chat_dlq" {
  name                      = "${local.profile_chat_name}-dlq"
  message_retention_seconds = 86400
  sqs_managed_sse_enabled   = true
  tags                      = local.common_tags
}

resource "aws_sqs_queue" "profile_chat" {
  name                       = "${local.profile_chat_name}-jobs"
  message_retention_seconds  = 14400
  visibility_timeout_seconds = 1800
  sqs_managed_sse_enabled    = true
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.profile_chat_dlq.arn
    maxReceiveCount     = 3
  })
  tags = local.common_tags
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
      { Effect = "Allow", Action = ["bedrock:ApplyGuardrail"], Resource = local.bedrock_guardrail_resource_arn },
      { Effect = "Allow", Action = ["ssm:GetParameter"], Resource = local.bedrock_guardrail_parameter_arn },
      { Effect = "Allow", Action = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:ChangeMessageVisibility"], Resource = aws_sqs_queue.profile_chat.arn },
      { Effect = "Allow", Action = ["lambda:InvokeFunction"], Resource = "arn:${data.aws_partition.current.partition}:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:investoros-${var.environment}-api" }
    ]
  })
}

resource "aws_lambda_function" "profile_chat_worker" {
  function_name                  = "${local.profile_chat_name}-worker"
  description                    = "Profile chat jobs with durable progress beyond the HTTP API timeout."
  role                           = aws_iam_role.profile_chat_worker.arn
  runtime                        = "python3.12"
  handler                        = "investoros_api.main.handler"
  s3_bucket                      = aws_s3_object.api_package.bucket
  s3_key                         = aws_s3_object.api_package.key
  source_code_hash               = filebase64sha256(local.package_path)
  timeout                        = 300
  memory_size                    = 512
  reserved_concurrent_executions = 2
  environment {
    variables = {
      BEDROCK_MODEL_ID                   = var.bedrock_model_id
      DEMO_CONTEXTS                      = jsonencode(local.demo_contexts)
      DEMO_PORTFOLIO_MODE                = "dynamodb"
      ENVIRONMENT                        = var.environment
      PORTFOLIOS_TABLE_NAME              = local.portfolio_table_name
      SOURCE_WORKSPACE_TABLE             = local.accounts_table_name
      PROFILE_CHAT_JOBS_TABLE            = aws_dynamodb_table.profile_chat_jobs.name
      BEDROCK_GUARDRAIL_CONFIG_PARAMETER = local.bedrock_guardrail_parameter_name
      BEDROCK_GUARDRAIL_ID               = aws_bedrock_guardrail.assistant.guardrail_id
      RESEARCH_LAMBDA_FUNCTION           = "investoros-${var.environment}-api"
      REQUIRE_ADMIN_AUTH                 = "true"
      SIMULATION_X_SEARCH_ENABLED        = "false"
    }
  }
  depends_on = [aws_iam_role_policy.profile_chat_worker]
  tags       = local.common_tags
}

resource "aws_lambda_event_source_mapping" "profile_chat" {
  event_source_arn                   = aws_sqs_queue.profile_chat.arn
  function_name                      = aws_lambda_function.profile_chat_worker.arn
  batch_size                         = 1
  function_response_types            = ["ReportBatchItemFailures"]
  maximum_batching_window_in_seconds = 0
  enabled                            = true

  scaling_config {
    maximum_concurrency = 2
  }

  depends_on = [aws_iam_role_policy.profile_chat_worker]
}

resource "aws_iam_role_policy" "profile_chat_dispatch" {
  name = "${local.profile_chat_name}-dispatch"
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"], Resource = aws_dynamodb_table.profile_chat_jobs.arn },
      { Effect = "Allow", Action = ["sqs:SendMessage"], Resource = aws_sqs_queue.profile_chat.arn }
    ]
  })
}

resource "aws_cloudwatch_metric_alarm" "profile_chat_dlq_messages" {
  alarm_name          = "${local.profile_chat_name}-dlq-messages"
  alarm_description   = "One or more profile chat jobs reached the dead-letter queue."
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  dimensions          = { QueueName = aws_sqs_queue.profile_chat_dlq.name }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  tags                = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "profile_chat_queue_age" {
  alarm_name          = "${local.profile_chat_name}-queue-age"
  alarm_description   = "Profile chat jobs are waiting in the queue for more than five minutes."
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateAgeOfOldestMessage"
  dimensions          = { QueueName = aws_sqs_queue.profile_chat.name }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 300
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  tags                = local.common_tags
}


resource "aws_dynamodb_table" "profile_conversations" {
  name         = "${local.profile_chat_name}-conversations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "account_id"
  range_key    = "conversation_id"

  attribute {
    name = "account_id"
    type = "S"
  }
  attribute {
    name = "conversation_id"
    type = "S"
  }
  attribute {
    name = "last_used_at"
    type = "N"
  }

  global_secondary_index {
    name               = "account-last-used"
    hash_key           = "account_id"
    range_key          = "last_used_at"
    projection_type    = "INCLUDE"
    non_key_attributes = ["title"]
  }

  server_side_encryption { enabled = true }
  point_in_time_recovery { enabled = true }
  deletion_protection_enabled = true
  tags                        = local.common_tags
}

resource "aws_iam_role_policy" "profile_conversations" {
  name = "${local.profile_chat_name}-conversations"
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query", "dynamodb:DeleteItem"]
      Resource = [aws_dynamodb_table.profile_conversations.arn, "${aws_dynamodb_table.profile_conversations.arn}/index/*"]
    }]
  })
}
