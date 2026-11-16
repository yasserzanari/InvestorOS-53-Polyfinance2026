resource "aws_bedrock_guardrail" "assistant" {
  name                      = "${local.name_prefix}-safety"
  description               = "InvestorOS assistant baseline: prompt attack and harmful content filters, sensitive-data anonymization."
  blocked_input_messaging   = "Cette demande contient un élément que les règles de sécurité ne permettent pas de traiter. Reformulez sans donnée sensible ni instruction malveillante."
  blocked_outputs_messaging = "La réponse a été retenue par les règles de sécurité. Reformulez la demande."
  tags                      = local.common_tags

  content_policy_config {
    filters_config {
      type            = "HATE"
      input_strength  = "MEDIUM"
      output_strength = "MEDIUM"
      input_enabled   = true
      output_enabled  = true
    }
    filters_config {
      type            = "INSULTS"
      input_strength  = "MEDIUM"
      output_strength = "MEDIUM"
      input_enabled   = true
      output_enabled  = true
    }
    filters_config {
      type            = "MISCONDUCT"
      input_strength  = "MEDIUM"
      output_strength = "MEDIUM"
      input_enabled   = true
      output_enabled  = true
    }
    filters_config {
      type            = "SEXUAL"
      input_strength  = "MEDIUM"
      output_strength = "MEDIUM"
      input_enabled   = true
      output_enabled  = true
    }
    filters_config {
      type            = "VIOLENCE"
      input_strength  = "MEDIUM"
      output_strength = "MEDIUM"
      input_enabled   = true
      output_enabled  = true
    }
    filters_config {
      type            = "PROMPT_ATTACK"
      input_strength  = "HIGH"
      output_strength = "NONE"
      input_enabled   = true
      output_enabled  = false
    }
    tier_config {
      tier_name = "STANDARD"
    }
  }

  sensitive_information_policy_config {
    pii_entities_config {
      type           = "EMAIL"
      action         = "ANONYMIZE"
      input_action   = "ANONYMIZE"
      output_action  = "ANONYMIZE"
      input_enabled  = true
      output_enabled = true
    }
    pii_entities_config {
      type           = "PHONE"
      action         = "ANONYMIZE"
      input_action   = "ANONYMIZE"
      output_action  = "ANONYMIZE"
      input_enabled  = true
      output_enabled = true
    }
    pii_entities_config {
      type           = "ADDRESS"
      action         = "ANONYMIZE"
      input_action   = "ANONYMIZE"
      output_action  = "ANONYMIZE"
      input_enabled  = true
      output_enabled = true
    }
    pii_entities_config {
      type           = "CA_SOCIAL_INSURANCE_NUMBER"
      action         = "ANONYMIZE"
      input_action   = "ANONYMIZE"
      output_action  = "ANONYMIZE"
      input_enabled  = true
      output_enabled = true
    }
    pii_entities_config {
      type           = "CREDIT_DEBIT_CARD_NUMBER"
      action         = "ANONYMIZE"
      input_action   = "ANONYMIZE"
      output_action  = "ANONYMIZE"
      input_enabled  = true
      output_enabled = true
    }
    pii_entities_config {
      type           = "PASSWORD"
      action         = "ANONYMIZE"
      input_action   = "ANONYMIZE"
      output_action  = "ANONYMIZE"
      input_enabled  = true
      output_enabled = true
    }
    pii_entities_config {
      type           = "AWS_ACCESS_KEY"
      action         = "ANONYMIZE"
      input_action   = "ANONYMIZE"
      output_action  = "ANONYMIZE"
      input_enabled  = true
      output_enabled = true
    }
    pii_entities_config {
      type           = "AWS_SECRET_KEY"
      action         = "ANONYMIZE"
      input_action   = "ANONYMIZE"
      output_action  = "ANONYMIZE"
      input_enabled  = true
      output_enabled = true
    }
  }
}

resource "aws_bedrock_guardrail_version" "assistant" {
  guardrail_arn = aws_bedrock_guardrail.assistant.guardrail_arn
  description   = "Version initiale vérifiable depuis la console Admin InvestorOS."
  skip_destroy  = true
}

locals {
  bedrock_guardrail_parameter_name = "/investoros/${var.environment}/bedrock/guardrail"
  bedrock_guardrail_parameter_arn  = "arn:${data.aws_partition.current.partition}:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${local.bedrock_guardrail_parameter_name}"
  bedrock_guardrail_resource_arn   = aws_bedrock_guardrail.assistant.guardrail_arn
}

resource "aws_ssm_parameter" "bedrock_guardrail_config" {
  name        = local.bedrock_guardrail_parameter_name
  description = "Version Bedrock Guardrail active pour InvestorOS; les changements Admin sont conservés hors Terraform."
  type        = "String"
  value = jsonencode({
    enabled          = true
    guardrailId      = aws_bedrock_guardrail.assistant.guardrail_id
    guardrailVersion = aws_bedrock_guardrail_version.assistant.version
  })
  lifecycle {
    ignore_changes = [value]
  }
  tags = local.common_tags
}

resource "aws_iam_role_policy" "bedrock_guardrail_runtime" {
  name = "${local.name_prefix}-bedrock-guardrail-runtime"
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = local.bedrock_guardrail_parameter_arn
      },
      {
        Effect   = "Allow"
        Action   = ["bedrock:ApplyGuardrail"]
        Resource = local.bedrock_guardrail_resource_arn
      },
      {
        Effect   = "Allow"
        Action   = ["bedrock:ListGuardrails", "bedrock:ListGuardrailVersions"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["bedrock:GetGuardrail", "bedrock:CreateGuardrailVersion"]
        Resource = local.bedrock_guardrail_resource_arn
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:PutParameter"]
        Resource = local.bedrock_guardrail_parameter_arn
      }
    ]
  })
}
