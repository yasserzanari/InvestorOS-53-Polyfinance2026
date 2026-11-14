variable "name_prefix" {
  description = "Préfixe des tables de l’environnement."
  type        = string
}

variable "common_tags" {
  description = "Tags communs du projet."
  type        = map(string)
}

variable "demo_account_id" {
  description = "Clé fixe du compte entièrement fictif de démonstration."
  type        = string
}

variable "demo_profile_id" {
  description = "Clé fixe du profil fictif de démonstration."
  type        = string
}

variable "demo_portfolio_id" {
  description = "Clé fixe du portefeuille fictif de démonstration."
  type        = string
}
