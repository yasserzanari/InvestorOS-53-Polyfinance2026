variable "aws_region" {
  description = "Région AWS de l’environnement."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Nom de l’environnement isolé."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "demo"], var.environment)
    error_message = "environment doit être dev ou demo."
  }
}

variable "simulation_x_search_enabled" {
  description = "Active les recherches X payantes pour Simulation; false par défaut."
  type        = bool
  default     = false
}

variable "x_api_bearer_token_secret_arn" {
  description = "ARN Secrets Manager du Bearer Token X; aucun secret n’est stocké dans Terraform."
  type        = string
  default     = ""
}

variable "admin_console_token_secret_arn" {
  description = "ARN du secret contenant le jeton d’accès à la console d’administration."
  type        = string
  default     = ""
}
