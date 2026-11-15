variable "aws_region" {
  description = "Région du compte AWS et du profil d’inférence Bedrock."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environnement de l’API existante à compléter."
  type        = string
  default     = "dev"

  validation {
    condition     = var.environment == "dev"
    error_message = "Cette stack isolée est actuellement limitée à dev."
  }
}

variable "bedrock_model_id" {
  description = "Profil d’inférence Bedrock actif pour l’Assistant."
  type        = string
  default     = "us.anthropic.claude-sonnet-4-6"

  validation {
    condition     = can(regex("^us\\.[A-Za-z0-9._:-]+$", var.bedrock_model_id))
    error_message = "Utilisez un profil d’inférence US, par exemple us.amazon.nova-lite-v1:0."
  }
}

variable "package_path" {
  description = "Archive API construite localement avec scripts/build-api.sh."
  type        = string
  default     = ""
}
