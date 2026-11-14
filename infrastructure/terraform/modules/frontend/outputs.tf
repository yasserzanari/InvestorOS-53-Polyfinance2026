output "site_bucket_name" {
  description = "Bucket privé contenant le frontend publié."
  value       = aws_s3_bucket.site.bucket
}

output "cloudfront_distribution_id" {
  description = "Identifiant de la distribution CloudFront."
  value       = aws_cloudfront_distribution.site.id
}

output "cloudfront_domain_name" {
  description = "URL publique HTTPS de la web app."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "github_deploy_role_arn" {
  description = "Rôle OIDC à configurer comme variable AWS_DEPLOY_ROLE_ARN dans GitHub."
  value       = aws_iam_role.github_deploy.arn
}
