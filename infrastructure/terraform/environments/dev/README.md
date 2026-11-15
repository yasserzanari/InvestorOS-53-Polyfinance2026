# Environnement dev AWS (us-east-1)

Ce root Terraform décrit une fondation InvestorOS : le frontend CloudFront existant, un API Gateway HTTP API, Lambda FastAPI/Mangum, quatre tables DynamoDB fictives et des logs/alarmes CloudWatch.

## Inventaire et état Terraform à préserver

L’inventaire en lecture seule du 14 novembre 2026 confirme que le site publié est `https://d10hypspu2l2nc.cloudfront.net`, distribution `E3T6NGVUMJCHTH`, avec origine S3 `investoros-dev-010928221556-web-us-east-1`. Les variables GitHub actuelles correspondent au stack actif : `AWS_CLOUDFRONT_DISTRIBUTION_ID=E3T6NGVUMJCHTH`, `AWS_DEPLOY_ROLE_ARN=arn:aws:iam::010928221556:role/investoros-dev-github-web-deploy`, `AWS_REGION=us-east-1` et `AWS_SITE_BUCKET=investoros-dev-010928221556-web-us-east-1`. La variable `VITE_API_BASE_URL` reste à ajouter après le déploiement de l’API.

Le state canonique est `s3://investoros-tfstate-010928221556-us-east-1/dev/terraform.tfstate`. Il connaît le site/CloudFront/OAC et le rôle GitHub existants. Il existe aussi les ressources distinctes `polyfinance2026-investoros-tfstate-010928221556-us-east-1` (state avec un frontend partiel) et `polyfinance2026-investoros-dev-010928221556-web-us-east-1` (bucket web vide), ainsi que leur state bootstrap. Elles ne sont pas les origines du site publié. Ces ressources et ces states restent intacts. Le code et le backend de cet environnement ciblent le state canonique et le bucket réellement utilisé par CloudFront.

**Avant toute mutation AWS**, vérifier l’identité et le state, puis lire intégralement le plan. N’appliquer que si le plan ne remplace ni ne détruit une ressource du site actif. Ne jamais supprimer les buckets préfixés simplement parce qu’ils ne sont plus ciblés par ce code.

## Préparer et examiner le plan

Depuis la racine du dépôt :

```bash
uv python install 3.12
./scripts/build-api.sh
cd infrastructure/terraform/environments/dev
terraform init -reconfigure
terraform workspace show
terraform plan -out=dev.tfplan
terraform show dev.tfplan
```

La région du provider, du backend Terraform et du client boto3 est `us-east-1`. Un plan Terraform n’applique rien. Le plan peut révéler des dérives sur le stack CloudFront existant; interrompre avant apply si une ressource existante est marquée `-/+`, `-` ou si les noms/IDs diffèrent de l’inventaire ci-dessus.

Seulement après revue humaine du plan :

```bash
terraform apply dev.tfplan
terraform output
```

L’invocation Lambda, API Gateway et la création des tables sont des mutations AWS. Elles n’ont pas été effectuées dans le cadre de cette préparation.

## URL et frontend

Terraform expose `api_url`, `api_health_url`, `demo_overview_url` et `demo_table_names`. Pour le développement local, copier `apps/web/.env.aws.example` vers `apps/web/.env.aws`, y placer `VITE_API_TARGET=<api_url>` (sans suffixe `/v1/demo/overview`), puis lancer `npm run dev:aws` dans `apps/web`. Vite relaie `/api/*` vers le backend.

Après déploiement contrôlé de l’API, ajouter la variable de dépôt GitHub `VITE_API_BASE_URL` égale à `api_url`; le workflow l’injecte pendant le build frontend. Les variables `VITE_*` sont publiques. Elles ne doivent contenir aucun secret.

## Modèle de sécurité et coûts

- Le rôle runtime Lambda est distinct du rôle CI GitHub OIDC. Sa confiance est limitée au service Lambda.
- La policy runtime utilise les actions identifiées par analyse statique du code Boto3 (`dynamodb:GetItem`, `dynamodb:Query`, permission dépendante `dynamodb:ReadDataForReplication`) sur les seuls ARNs des quatre tables de cette stack. Les droits CloudWatch sont limités au groupe `/aws/lambda/investoros-dev-api` et ses streams (`logs:CreateLogStream`, `logs:PutLogEvents`). Cette policy runtime n’accorde aucun droit d’écriture DynamoDB. `bedrock:InvokeModel` et `bedrock:InvokeModelWithResponseStream` sont limités au profil d’inférence configuré et au modèle de base routé. Le défaut de code est `us.amazon.nova-lite-v1:0`; l’inférence peut être facturée et routée entre régions US.
- L’API ne transforme jamais un identifiant fourni par le navigateur en clé DynamoDB. Elle accepte uniquement les personas connus (`amira`, `mateo`, `robert`), puis résout leurs clés fixes depuis `DEMO_CONTEXTS`, injecté par Terraform. Les trois comptes, profils et portefeuilles restent des fixtures fictives. CORS autorise le domaine CloudFront précis et `localhost:5173`.
- API Gateway `$default` configure 5 requêtes/s et burst 10; Lambda a une concurrence réservée de 5. Une surcharge API Gateway produit `429`. Le proxy `ANY /{proxy+}` transmet les autres routes documentées à FastAPI; l’intégration HTTP reste limitée à 10 secondes.
- Le groupe de logs Lambda conserve 14 jours. Deux alarmes CloudWatch couvrent erreurs et throttles. Elles ne notifient personne sans destination SNS/action ajoutée.
- DynamoDB est à la demande, chiffré avec la clé AWS owned par défaut, PITR activé et protection contre suppression activée. Il n’y a pas de données d’un compte réel.

## Variables et permissions nécessaires

Les variables d’entrée de cet environnement sont `aws_region` (défaut `us-east-1`), `environment` (`dev` ou `demo`), `simulation_x_search_enabled` (défaut `false`) et `x_api_bearer_token_secret_arn` (défaut vide). Le backend S3 utilise le bucket d’état préexistant cité plus haut. L’activation X peut entraîner des frais à l’usage : ne passer à `true` qu’après validation du budget et des règles de conservation. Le jeton n’est jamais une variable Terraform; le rôle Lambda obtient uniquement `secretsmanager:GetSecretValue` sur l’ARN configuré.

Pour cette tranche, le rôle Terraform d’installation a besoin des opérations de création et de lecture nécessaires sur API Gateway v2, Lambda, IAM rôle/policy et `iam:PassRole`, DynamoDB (tables, PITR, items fixture et tags), CloudWatch Logs/Alarms, plus les lectures S3/CloudFront/IAM pour rafraîchir les ressources frontend déjà suivies dans le state. `sts:GetCallerIdentity` sert à identifier le compte. Les ressources DynamoDB, Lambda, logs et alarmes sont nommées et régionales dans le plan. API Gateway et certaines opérations de découverte ont des exigences de ressource `*` côté IAM.

L’analyse automatique du plan (`iam-policy-autopilot`) est utile pour repérer les familles d’actions, mais le provider AWS lui fait produire des actions de cycle de vie inutiles pour ce plan de création et des ressources `*`; ne pas attacher sa policy brute. Confiner le rôle d’installation par SCP/permissions boundary et n’ajouter que les actions manquantes nécessaires au plan relu. Le rôle GitHub CI existant reste limité à `s3:ListBucket`/`s3:GetBucketLocation`, `s3:PutObject`/`s3:DeleteObject` sur le bucket du site et `cloudfront:CreateInvalidation` sur la distribution ciblée. Les permissions réelles dépendent aussi des refus SCP Workshop; les messages `AccessDenied` et le plan sont l’autorité. Le rôle runtime et le rôle CI n’héritent pas des droits du rôle Terraform.

## Statut fonctionnel

| Composant | État |
| --- | --- |
| Frontend CloudFront/S3 et workflow GitHub | Déployé avant cette tranche; inventaire confirmé |
| API FastAPI `/health`, `/v1/demo/overview`, Assistant et Simulation | API Gateway et Lambda existent; le déploiement du modèle Bedrock configuré par Terraform reste à appliquer et à vérifier par un appel réel |
| Tables DynamoDB et trois fixtures fictives | Code Terraform prêt, non déployées |
| Limites API/Lambda, logs et alarmes | Code Terraform prêt, non déployés |
| Frontend configuré à une URL API | Code prêt; `VITE_API_BASE_URL` reste à configurer après l’API |
| Simulation historique, événements datés, sources et scénarios conditionnels | Code prêt; déploiement et configuration des données restent à faire |
| Step Functions pour travaux longs | À ajouter ensuite, non déployé |
| Bedrock | Profil US Nova Lite actif dans le compte et utilisé par le worker de recherche; l’API conversation n’avait pas `BEDROCK_MODEL_ID`. Cette modification le configure via Terraform, mais son invocation depuis l’API n’est pas encore validée |
| X Recent Search | Connecteur optionnel codé, désactivé par défaut; jeton et budget non configurés |
| Knowledge Base/RAG | Non branchés |
| Auth utilisateur/données privées | Absentes; ne pas y placer de données réelles |

## Suite de livraison

1. Réconcilier les états et variables du dépôt sans supprimer les ressources en double; examiner le plan complet.
2. Appliquer l’API et DynamoDB avec un rôle autorisé, puis appeler `/health` et `/v1/demo/overview` de façon contrôlée.
3. Construire l’archive API, relire le plan Terraform complet, puis vérifier que le proxy ne remplace ni ne détruit les ressources actives avant tout déploiement autorisé.
4. Ajouter Step Functions quand une analyse longue a un contrat et un coût bornés.
5. Choisir un modèle Bedrock, vérifier l’autorisation d’invocation dans `us-east-1`, régler les quotas/coûts et effectuer un premier appel mesuré avant de le déclarer fonctionnel.
6. Ajouter RAG avec une source et une provenance vérifiables seulement si les réponses produit en ont besoin.
