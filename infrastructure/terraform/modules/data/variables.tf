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

variable "demo_personas" {
  description = "Profils et portefeuilles fictifs associés aux trois personas connus."
  type = map(object({
    account_id      = string
    profile_id      = string
    portfolio_id    = string
    account_name    = string
    age             = number
    objective       = string
    horizon_years   = number
    risk_tolerance  = string
    loss_capacity   = string
    liquidity_needs = string
    preferences     = list(string)
    knowledge       = string
    constraints     = list(string)
    unknown_fields  = list(string)
    portfolio_name  = string
    positions = list(object({
      id         = string
      label      = string
      weight_pct = number
      value      = number
    }))
  }))
}
