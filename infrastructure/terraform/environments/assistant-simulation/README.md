# API Assistant et Simulation isolée

Cette stack branche les routes FastAPI `/v1/profiles/*` et `/v1/simulation/*` sur une Lambda dédiée. Les routes Assistant/Simulation et Dashboard exigent un JWT Cognito valide; Assistant/Simulation vérifie aussi le groupe `administrators`. Le prévol CORS `OPTIONS` reste sans authentification et n’exécute aucune action applicative. Seul `/health` demeure public.

La stack possède son propre state S3 (`dev/assistant-simulation/terraform.tfstate`) et ne retire aucune ressource de l’état canonique. Elle lit depuis celui-ci l’URL API, le nom de la table fictive de portefeuilles et l’émetteur/client Cognito. Les trois CSV historiques sont intégrés à l’archive locale ignorée construite par `scripts/build-api.sh`; aucun jeu de données ni fichier `docs/` n’est commité.

## Préparer et examiner

Depuis la racine du dépôt :

```bash
./scripts/build-api.sh
cd infrastructure/terraform/environments/assistant-simulation
terraform init -reconfigure
terraform plan -out=/tmp/investoros-assistant-simulation.tfplan
terraform show /tmp/investoros-assistant-simulation.tfplan
```

Le plan attendu comprend l’authorizer JWT, les permissions de la Lambda dédiée et les changements de routes Assistant/Simulation; il ne doit supprimer ni remplacer aucune ressource. Ne pas appliquer un plan qui détruit, remplace ou modifie des ressources hors de cette stack.

Après `apply`, vérifier les réponses `401` sans JWT, puis contrôler `/v1/profiles/status`, `/v1/simulation/assets` et `/v1/simulation/history/NVDA` avec une session administrateur. Envoyer une vraie demande de chat pour confirmer l’autorisation Bedrock et les quotas; `status` seul ne vérifie pas l’invocation.

## Limites

- Seuls les comptes fictifs sont utilisés. L’Assistant a un accès `GetItem` limité à la table de portefeuilles fictifs.
- Le profil d’inférence par défaut est `us.amazon.nova-lite-v1:0`. Les coûts d’inférence et le quota dépendent du compte AWS.
- X Recent Search reste désactivé; aucun secret X n’est lu.
- L’API Gateway existante a une limite de débit partagée. La Lambda dédiée a une concurrence réservée de deux.
- Les inscriptions Cognito et la récupération de mot de passe autonome sont désactivées; seuls les administrateurs peuvent créer des comptes.
- L’intégration HTTP API est synchrone et plafonnée à 29 secondes. Elle ne garantit pas un affichage progressif des morceaux NDJSON pendant le calcul.
