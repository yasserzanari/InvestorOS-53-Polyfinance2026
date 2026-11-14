# Environnement dev

Ce stack crée le frontend statique InvestorOS dans `us-east-1` : bucket S3 privé, accès CloudFront OAC, distribution HTTPS et rôle de déploiement GitHub Actions limité au dépôt et à la branche `main`.

## Première installation

Le rôle AWS utilisé pour la première installation doit pouvoir créer les ressources Terraform. L’environnement courant peut interdire ces actions avec une SCP; dans ce cas, exécuter ces commandes avec un rôle autorisé dans le compte du projet.

1. Créer le bucket d’état avec l’état local temporaire, puis migrer cet état dans le bucket :

   ```bash
   cd infrastructure/terraform/bootstrap
   terraform init
   terraform apply
   cp backend.tf.example backend.tf
   terraform init -migrate-state
   ```

2. Créer S3, CloudFront et le rôle OIDC du dépôt :

   ```bash
   cd ../environments/dev
   terraform init
   terraform apply
   terraform output
   ```

Le bucket d’état utilise le chiffrement côté serveur, le versionnement, le verrouillage natif S3 et le blocage d’accès public. Les états sont séparés par `bootstrap/` et `dev/`.

## Activer la publication automatique

Dans les variables du dépôt GitHub, enregistrer les sorties Terraform suivantes :

- `AWS_DEPLOY_ROLE_ARN` ← `github_deploy_role_arn`
- `AWS_SITE_BUCKET` ← `site_bucket_name`
- `AWS_CLOUDFRONT_DISTRIBUTION_ID` ← `cloudfront_distribution_id`
- `AWS_REGION` ← `us-east-1`

Le workflow `.github/workflows/deploy-static-site.yml` publie sur S3 après chaque push sur `main`, puis invalide CloudFront. Il utilise GitHub OIDC; aucune clé AWS longue durée n’est stockée dans GitHub.

L’adresse publique sera la sortie `cloudfront_domain_name`. L’origine S3 reste privée et CloudFront sert les routes SPA avec HTTPS. Le prototype n’a pas encore d’API AWS connectée.

Les buckets et la distribution sont des ressources facturables selon le stockage, les requêtes et le trafic. Le frontend utilise `PriceClass_100`; vérifiez les coûts dans le compte AWS après déploiement.
