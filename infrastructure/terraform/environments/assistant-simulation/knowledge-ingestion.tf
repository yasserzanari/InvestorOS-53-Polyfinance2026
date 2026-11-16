data "aws_ssm_parameter" "knowledge_documents_bucket" {
  name = "/investoros-${var.environment}/knowledge/documents-bucket"
}

data "aws_ssm_parameter" "knowledge_base_id" {
  name = "/investoros-${var.environment}/knowledge/knowledge-base-id"
}

data "aws_ssm_parameter" "knowledge_data_source_id" {
  name = "/investoros-${var.environment}/knowledge/data-source-id"
}

data "aws_s3_bucket" "knowledge_documents" {
  bucket = data.aws_ssm_parameter.knowledge_documents_bucket.value
}

locals {
  knowledge_base_id        = data.aws_ssm_parameter.knowledge_base_id.value
  knowledge_data_source_id = data.aws_ssm_parameter.knowledge_data_source_id.value
  knowledge_base_arn       = "arn:${data.aws_partition.current.partition}:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:knowledge-base/${local.knowledge_base_id}"
  knowledge_ingestion_name = "${local.name_prefix}-knowledge-ingestion"
}

resource "aws_sqs_queue" "knowledge_ingestion_dlq" {
  name                      = "${local.knowledge_ingestion_name}-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
  tags                      = local.common_tags
}

resource "aws_sqs_queue" "knowledge_ingestion" {
  name                       = local.knowledge_ingestion_name
  visibility_timeout_seconds = 360
  message_retention_seconds  = 1209600
  receive_wait_time_seconds  = 20
  sqs_managed_sse_enabled    = true
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.knowledge_ingestion_dlq.arn
    maxReceiveCount     = 10
  })
  tags = local.common_tags
}

resource "aws_sqs_queue_policy" "knowledge_ingestion" {
  queue_url = aws_sqs_queue.knowledge_ingestion.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowOnlyConfiguredS3Bucket"
      Effect    = "Allow"
      Principal = { Service = "s3.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.knowledge_ingestion.arn
      Condition = {
        ArnEquals    = { "aws:SourceArn" = data.aws_s3_bucket.knowledge_documents.arn }
        StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }
      }
    }]
  })
}

resource "aws_iam_role_policy" "knowledge_api" {
  name = "${local.name_prefix}-knowledge-upload-and-retrieval"
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadKnowledgeConfiguration"
        Effect = "Allow"
        Action = ["ssm:GetParameter"]
        Resource = [
          data.aws_ssm_parameter.knowledge_documents_bucket.arn,
          data.aws_ssm_parameter.knowledge_base_id.arn,
          data.aws_ssm_parameter.knowledge_data_source_id.arn
        ]
      },
      {
        Sid      = "CreatePresignedDocumentUploads"
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "${data.aws_s3_bucket.knowledge_documents.arn}/documents/*"
      },
      {
        Sid      = "RetrieveCitedKnowledgeEvidence"
        Effect   = "Allow"
        Action   = ["bedrock:Retrieve"]
        Resource = local.knowledge_base_arn
      }
    ]
  })
}

# The bucket has no existing notifications in the current AWS account. This
# resource owns its notification configuration and limits events to KB inputs.
resource "aws_s3_bucket_notification" "knowledge_documents" {
  bucket = data.aws_s3_bucket.knowledge_documents.id

  queue {
    id            = "${local.knowledge_ingestion_name}-uploads"
    queue_arn     = aws_sqs_queue.knowledge_ingestion.arn
    events        = ["s3:ObjectCreated:Put", "s3:ObjectCreated:CompleteMultipartUpload"]
    filter_prefix = "documents/"
  }

  depends_on = [aws_sqs_queue_policy.knowledge_ingestion]
}

resource "aws_iam_role" "knowledge_ingestion_dispatcher" {
  name        = "${local.knowledge_ingestion_name}-dispatcher"
  description = "Dispatches authorized S3 uploads to the Bedrock ingestion workflow."
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

resource "aws_cloudwatch_log_group" "knowledge_ingestion_dispatcher" {
  name              = "/aws/lambda/${local.knowledge_ingestion_name}-dispatcher"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_iam_role_policy" "knowledge_ingestion_dispatcher" {
  name = "${local.knowledge_ingestion_name}-dispatcher"
  role = aws_iam_role.knowledge_ingestion_dispatcher.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ConsumeUploadQueue"
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource = aws_sqs_queue.knowledge_ingestion.arn
      },
      {
        Sid      = "CheckUploadMetadataSidecar"
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${data.aws_s3_bucket.knowledge_documents.arn}/documents/*"
      },
      {
        Sid      = "StartIngestionWorkflow"
        Effect   = "Allow"
        Action   = ["states:StartExecution"]
        Resource = aws_sfn_state_machine.knowledge_ingestion.arn
      },
      {
        Sid      = "WriteLogs"
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.knowledge_ingestion_dispatcher.arn}:*"
      }
    ]
  })
}

resource "aws_lambda_function" "knowledge_ingestion_dispatcher" {
  function_name                  = "${local.knowledge_ingestion_name}-dispatcher"
  description                    = "Idempotently dispatches uploaded KB documents to Step Functions."
  role                           = aws_iam_role.knowledge_ingestion_dispatcher.arn
  runtime                        = "python3.12"
  handler                        = "investoros_api.knowledge.ingestion_dispatcher.handler"
  s3_bucket                      = aws_s3_object.api_package.bucket
  s3_key                         = aws_s3_object.api_package.key
  source_code_hash               = filebase64sha256(local.package_path)
  timeout                        = 60
  memory_size                    = 256
  reserved_concurrent_executions = 2
  environment {
    variables = {
      KNOWLEDGE_BASE_ID                     = local.knowledge_base_id
      KNOWLEDGE_DATA_SOURCE_ID              = local.knowledge_data_source_id
      KNOWLEDGE_INGESTION_STATE_MACHINE_ARN = aws_sfn_state_machine.knowledge_ingestion.arn
    }
  }
  depends_on = [aws_iam_role_policy.knowledge_ingestion_dispatcher]
  tags       = local.common_tags
}

resource "aws_lambda_event_source_mapping" "knowledge_ingestion" {
  event_source_arn                   = aws_sqs_queue.knowledge_ingestion.arn
  function_name                      = aws_lambda_function.knowledge_ingestion_dispatcher.arn
  batch_size                         = 1
  function_response_types            = ["ReportBatchItemFailures"]
  maximum_batching_window_in_seconds = 0
  enabled                            = true
  depends_on                         = [aws_iam_role_policy.knowledge_ingestion_dispatcher]
}

resource "aws_iam_role" "knowledge_ingestion_workflow" {
  name        = "${local.knowledge_ingestion_name}-workflow"
  description = "Starts and monitors ingestion for the InvestorOS Bedrock Knowledge Base."
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "states.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.common_tags
}

resource "aws_iam_role_policy" "knowledge_ingestion_workflow" {
  name = "${local.knowledge_ingestion_name}-workflow"
  role = aws_iam_role.knowledge_ingestion_workflow.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "ManageConfiguredKnowledgeBaseIngestion"
      Effect   = "Allow"
      Action   = ["bedrock:StartIngestionJob", "bedrock:GetIngestionJob"]
      Resource = local.knowledge_base_arn
    }]
  })
}

resource "aws_sfn_state_machine" "knowledge_ingestion" {
  name     = local.knowledge_ingestion_name
  role_arn = aws_iam_role.knowledge_ingestion_workflow.arn
  type     = "STANDARD"
  definition = jsonencode({
    Comment        = "Serialize S3-triggered uploads through the Bedrock Knowledge Base ingestion job."
    StartAt        = "StartIngestion"
    TimeoutSeconds = 86400
    States = {
      StartIngestion = {
        Type     = "Task"
        Resource = "arn:${data.aws_partition.current.partition}:states:::aws-sdk:bedrockagent:startIngestionJob"
        Parameters = {
          "KnowledgeBaseId.$" = "$.knowledgeBaseId"
          "DataSourceId.$"    = "$.dataSourceId"
          "ClientToken.$"     = "$.clientToken"
          Description         = "InvestorOS document upload"
        }
        ResultSelector = {
          "ingestionJobId.$" = "$.ingestionJob.ingestionJobId"
          "status.$"         = "$.ingestionJob.status"
        }
        ResultPath = "$.job"
        Retry = [
          {
            ErrorEquals     = ["BedrockAgent.ConflictException"]
            IntervalSeconds = 30
            BackoffRate     = 1.5
            MaxAttempts     = 30
          },
          {
            ErrorEquals     = ["BedrockAgent.ThrottlingException", "BedrockAgent.InternalServerException", "States.Timeout"]
            IntervalSeconds = 5
            BackoffRate     = 2
            MaxAttempts     = 5
          }
        ]
        Next = "WaitForIngestion"
      }
      WaitForIngestion = {
        Type    = "Wait"
        Seconds = 30
        Next    = "GetIngestionStatus"
      }
      GetIngestionStatus = {
        Type     = "Task"
        Resource = "arn:${data.aws_partition.current.partition}:states:::aws-sdk:bedrockagent:getIngestionJob"
        Parameters = {
          "KnowledgeBaseId.$" = "$.knowledgeBaseId"
          "DataSourceId.$"    = "$.dataSourceId"
          "IngestionJobId.$"  = "$.job.ingestionJobId"
        }
        ResultSelector = {
          "status.$"     = "$.ingestionJob.status"
          "statistics.$" = "$.ingestionJob.statistics"
        }
        ResultPath = "$.poll"
        Retry = [{
          ErrorEquals     = ["BedrockAgent.ThrottlingException", "BedrockAgent.InternalServerException", "States.Timeout"]
          IntervalSeconds = 5
          BackoffRate     = 2
          MaxAttempts     = 5
        }]
        Next = "IngestionComplete?"
      }
      "IngestionComplete?" = {
        Type = "Choice"
        Choices = [
          { Variable = "$.poll.status", StringEquals = "COMPLETE", Next = "Succeeded" },
          { Variable = "$.poll.status", StringEquals = "FAILED", Next = "Failed" },
          { Variable = "$.poll.status", StringEquals = "STOPPED", Next = "Failed" }
        ]
        Default = "WaitForIngestion"
      }
      Succeeded = { Type = "Succeed" }
      Failed = {
        Type  = "Fail"
        Error = "KnowledgeBaseIngestionFailed"
        Cause = "Bedrock reported a failed or stopped document ingestion job."
      }
    }
  })
  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.knowledge_ingestion_workflow.arn}:*"
    include_execution_data = false
    level                  = "ERROR"
  }
  depends_on = [aws_iam_role_policy.knowledge_ingestion_workflow, aws_iam_role_policy.knowledge_ingestion_workflow_logs]
  tags       = local.common_tags
}

resource "aws_cloudwatch_log_group" "knowledge_ingestion_workflow" {
  name              = "/aws/vendedlogs/states/${local.knowledge_ingestion_name}"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_iam_role_policy" "knowledge_ingestion_workflow_logs" {
  name = "${local.knowledge_ingestion_name}-workflow-logs"
  role = aws_iam_role.knowledge_ingestion_workflow.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogDelivery", "logs:GetLogDelivery", "logs:UpdateLogDelivery", "logs:DeleteLogDelivery", "logs:ListLogDeliveries", "logs:PutResourcePolicy", "logs:DescribeResourcePolicies", "logs:DescribeLogGroups"]
      Resource = "*"
    }]
  })
}

resource "aws_cloudwatch_metric_alarm" "knowledge_ingestion_dlq" {
  alarm_name          = "${local.knowledge_ingestion_name}-dlq-messages"
  alarm_description   = "Upload events exhausted retries before the Bedrock ingestion workflow was dispatched."
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  dimensions          = { QueueName = aws_sqs_queue.knowledge_ingestion_dlq.name }
  tags                = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "knowledge_ingestion_queue_age" {
  alarm_name          = "${local.knowledge_ingestion_name}-oldest-message"
  alarm_description   = "Knowledge document uploads are waiting too long for dispatch."
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateAgeOfOldestMessage"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 2
  threshold           = 900
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions          = { QueueName = aws_sqs_queue.knowledge_ingestion.name }
  tags                = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "knowledge_ingestion_failed_workflows" {
  alarm_name          = "${local.knowledge_ingestion_name}-failed-workflows"
  alarm_description   = "A Bedrock Knowledge Base ingestion workflow failed."
  namespace           = "AWS/States"
  metric_name         = "ExecutionsFailed"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  dimensions          = { StateMachineArn = aws_sfn_state_machine.knowledge_ingestion.arn }
  tags                = local.common_tags
}
