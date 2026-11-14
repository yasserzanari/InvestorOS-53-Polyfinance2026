output "table_names" {
  description = "Noms des tables de contexte et d’analyse."
  value       = { for key, table in aws_dynamodb_table.records : key => table.name }
}

output "table_arns" {
  description = "ARNs des tables, à utiliser pour limiter le rôle d’exécution API."
  value       = { for key, table in aws_dynamodb_table.records : key => table.arn }
}

output "demo_account_id" {
  value = var.demo_account_id
}

output "demo_profile_id" {
  value = var.demo_profile_id
}

output "demo_portfolio_id" {
  value = var.demo_portfolio_id
}

output "demo_contexts" {
  description = "Association fixe persona-compte-profil-portefeuille pour les requêtes de démo."
  value = {
    for persona, fixture in var.demo_personas : persona => {
      account_id   = fixture.account_id
      profile_id   = fixture.profile_id
      portfolio_id = fixture.portfolio_id
    }
  }
}
