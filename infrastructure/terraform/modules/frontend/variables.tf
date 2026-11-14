variable "aws_region" {
  description = "Région AWS du bucket S3 du site."
  type        = string
}

variable "name_prefix" {
  description = "Préfixe de nommage pour les ressources InvestorOS."
  type        = string
}

variable "github_repository" {
  description = "Dépôt autorisé à publier le frontend via GitHub OIDC."
  type        = string
}

variable "common_tags" {
  description = "Étiquettes communes des ressources."
  type        = map(string)
}
