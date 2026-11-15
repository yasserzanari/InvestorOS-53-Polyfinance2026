output "name_prefix" {
  description = "Préfixe commun aux ressources InvestorOS de cet environnement."
  value       = local.name_prefix
}

output "site_bucket_name" {
  value = module.frontend.site_bucket_name
}

output "cloudfront_distribution_id" {
  value = module.frontend.cloudfront_distribution_id
}

output "cloudfront_domain_name" {
  value = module.frontend.cloudfront_domain_name
}

output "github_deploy_role_arn" {
  value = module.frontend.github_deploy_role_arn
}

output "api_url" {
  description = "URL HTTPS de l’API HTTP en us-east-1."
  value       = module.backend.api_url
}

output "api_health_url" {
  description = "Route de santé de l’API."
  value       = "${module.backend.api_url}/health"
}

output "demo_overview_url" {
  description = "Route en lecture seule pour le contexte fictif de démonstration."
  value       = "${module.backend.api_url}/v1/demo/overview"
}

output "demo_table_names" {
  description = "Tables DynamoDB de démonstration."
  value       = module.data.table_names
}

output "cognito_user_pool_id" {
  description = "User Pool Cognito de l’application InvestorOS."
  value       = module.backend.cognito_user_pool_id
}

output "cognito_client_id" {
  description = "Client public Cognito de l’application web."
  value       = module.backend.cognito_client_id
}

output "cognito_issuer" {
  description = "Émetteur des JWT Cognito validés par API Gateway."
  value       = module.backend.cognito_issuer
}

output "cognito_domain" {
  description = "Domaine géré Cognito Hosted UI."
  value       = module.backend.cognito_domain
}

output "cognito_hosted_ui_url" {
  description = "URL de connexion gérée par Cognito."
  value       = module.backend.cognito_hosted_ui_url
}
