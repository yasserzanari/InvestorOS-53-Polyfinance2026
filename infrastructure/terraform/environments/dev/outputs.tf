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
