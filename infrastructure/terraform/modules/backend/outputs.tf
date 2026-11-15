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

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.application.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "cognito_issuer" {
  value = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.application.id}"
}

output "cognito_domain" {
  value = "${aws_cognito_user_pool_domain.application.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "cognito_hosted_ui_url" {
  value = "https://${aws_cognito_user_pool_domain.application.domain}.auth.${var.aws_region}.amazoncognito.com"
}
