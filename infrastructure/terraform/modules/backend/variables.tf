variable "name_prefix" {
  description = "Préfixe de l’API et du rôle runtime."
  type        = string
}

variable "environment" {
  description = "Nom de l’environnement d’exécution."
  type        = string
}

variable "package_path" {
  description = "Chemin local vers l’archive Lambda empaquetée pour Python 3.12."
  type        = string
}

variable "frontend_origin" {
  description = "Origine HTTPS exacte de la web app CloudFront."
  type        = string
}

variable "table_names" {
  description = "Noms des tables DynamoDB utilisées par le contexte démo."
  type        = map(string)
}

variable "table_arns" {
  description = "ARNs des tables DynamoDB autorisées au rôle d’exécution."
  type        = map(string)
}

variable "lambda_log_group_arn" {
  description = "ARN du seul groupe CloudWatch où la Lambda peut écrire."
  type        = string
}

variable "demo_account_id" {
  description = "Clé de compte fictif fixe, pas un identifiant de compte financier."
  type        = string
}

variable "demo_profile_id" {
  description = "Clé du profil de démonstration."
  type        = string
}

variable "demo_portfolio_id" {
  description = "Clé du portefeuille de démonstration."
  type        = string
}

variable "common_tags" {
  description = "Tags communs du projet."
  type        = map(string)
}
