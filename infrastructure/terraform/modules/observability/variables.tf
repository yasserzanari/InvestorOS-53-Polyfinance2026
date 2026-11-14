variable "name_prefix" {
  description = "Préfixe commun des alarmes et groupes de logs."
  type        = string
}

variable "lambda_function_name" {
  description = "Nom exact de la Lambda API à observer."
  type        = string
}

variable "common_tags" {
  description = "Tags communs du projet."
  type        = map(string)
}
