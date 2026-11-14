variable "aws_region" {
  description = "Région AWS de l’environnement."
  type        = string
  default     = "ca-central-1"
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
