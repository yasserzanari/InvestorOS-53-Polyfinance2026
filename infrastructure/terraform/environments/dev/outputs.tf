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
