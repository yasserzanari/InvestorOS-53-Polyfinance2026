terraform {
  required_version = ">= 1.9.0, < 2.0.0"
  backend "s3" {
    bucket       = "investoros-tfstate-010928221556-us-east-1"
    key          = "dev/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}
