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

variable "bedrock_model_id" {
  description = "Profil d’inférence US Amazon Bedrock pour les conversations de l’API."
  type        = string
  default     = "us.amazon.nova-lite-v1:0"

  validation {
    condition     = can(regex("^us\\.[A-Za-z0-9._:-]+$", var.bedrock_model_id))
    error_message = "bedrock_model_id doit être un ID de profil d’inférence US, par exemple us.amazon.nova-lite-v1:0."
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
