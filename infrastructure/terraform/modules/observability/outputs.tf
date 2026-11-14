output "lambda_log_group_arn" {
  description = "ARN du groupe CloudWatch utilisé par la Lambda API."
  value       = aws_cloudwatch_log_group.api_lambda.arn
}

output "lambda_log_group_name" {
  value = aws_cloudwatch_log_group.api_lambda.name
}
