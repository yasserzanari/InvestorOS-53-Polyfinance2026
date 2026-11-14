output "api_url" {
  description = "URL HTTPS de l’API HTTP, sans nom de stage."
  value       = aws_apigatewayv2_api.http.api_endpoint
}

output "api_id" {
  description = "Identifiant de l’API HTTP pour alarmes et diagnostic."
  value       = aws_apigatewayv2_api.http.id
}

output "lambda_function_name" {
  value = aws_lambda_function.api.function_name
}

output "lambda_execution_role_arn" {
  value = aws_iam_role.lambda_execution.arn
}
