variable "name_prefix" {
  description = "Préfixe de l’API et du rôle runtime."
  type        = string
}

variable "environment" {
  description = "Nom de l’environnement d’exécution."
  type        = string
}

variable "aws_region" {
  description = "Région du compte et de l’API Bedrock; le modèle utilise un profil d’inférence US."
  type        = string
}

variable "bedrock_model_id" {
  description = "Profil d’inférence Bedrock autorisé pour le chat de l’API."
  type        = string
  validation {
    condition     = can(regex("^us\\.[A-Za-z0-9._:-]+$", var.bedrock_model_id))
    error_message = "bedrock_model_id doit être un ID de profil d’inférence US, par exemple us.amazon.nova-lite-v1:0."
  }
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

variable "demo_contexts" {
  description = "Association fixe persona-compte-profil-portefeuille pour les trois fixtures."
  type = map(object({
    account_id   = string
    profile_id   = string
    portfolio_id = string
  }))
}

variable "common_tags" {
  description = "Tags communs du projet."
  type        = map(string)
}

variable "simulation_x_search_enabled" {
  description = "Active explicitement l’API X Recent Search, qui peut entraîner des frais à l’usage."
  type        = bool
  default     = false
}

variable "x_api_bearer_token_secret_arn" {
  description = "ARN d’un secret Secrets Manager contenant uniquement le Bearer Token X; vide par défaut."
  type        = string
  default     = ""
}

variable "admin_console_token_secret_arn" {
  description = "ARN du secret contenant le jeton Admin; vide jusqu’à la configuration explicite de la console."
  type        = string
  default     = ""
}

variable "voice_transcribe_vocabulary_name" {
  description = "Nom du vocabulaire Amazon Transcribe utilisé par la dictée fr-CA et géré depuis la console Admin."
  type        = string
}
