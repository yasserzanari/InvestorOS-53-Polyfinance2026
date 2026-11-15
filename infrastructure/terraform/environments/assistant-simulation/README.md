# API Assistant et Simulation isolée

Cette stack branche les routes FastAPI `/v1/profiles/*` et `/v1/simulation/*` sur une nouvelle Lambda. Elle garde la Lambda API actuellement utilisée par les routes Dashboard, connaissances et recherche intacte. Les routes spécifiques d’API Gateway ont priorité sur `ANY /{proxy+}`; les autres URLs continuent donc vers leur intégration actuelle.

La stack possède son propre state S3 (`dev/assistant-simulation/terraform.tfstate`) et ne retire aucune ressource de l’état canonique. Elle lit seulement depuis celui-ci l’URL API et le nom de la table fictive de portefeuilles. Les trois CSV historiques sont intégrés à l’archive locale ignorée construite par `scripts/build-api.sh`; aucun jeu de données ni fichier `docs/` n’est commité.

## Préparer et examiner

Depuis la racine du dépôt :

```bash
./scripts/build-api.sh
cd infrastructure/terraform/environments/assistant-simulation
terraform init -reconfigure
terraform plan -out=/tmp/investoros-assistant-simulation.tfplan
terraform show /tmp/investoros-assistant-simulation.tfplan
```

Le plan attendu ne crée que le groupe de logs, le rôle/policy runtime, une Lambda, une intégration API Gateway, deux routes ciblées et leurs permissions d’invocation. Il ne doit modifier ni remplacer aucune ressource existante. Ne pas appliquer si le plan contient une destruction, un remplacement ou une modification hors de cette liste.

L’application du plan exige une revue humaine préalable. Après cette revue et `apply`, contrôler `/v1/profiles/status`, `/v1/simulation/assets`, puis `/v1/simulation/history/NVDA`. Envoyer ensuite une vraie demande de chat pour confirmer l’autorisation Bedrock et les quotas; `status` seul ne vérifie pas l’invocation.

## Limites

- Seuls les comptes fictifs sont utilisés. L’Assistant a un accès `GetItem` limité à la table de portefeuilles fictifs.
- Le profil d’inférence par défaut est `us.amazon.nova-lite-v1:0`. Les coûts d’inférence et le quota dépendent du compte AWS.
- X Recent Search reste désactivé; aucun secret X n’est lu.
- L’API Gateway existante a une limite de débit partagée. La Lambda dédiée a une concurrence réservée de deux.
- La route REST reste publique comme l’API de démonstration existante. Ne pas y envoyer de données personnelles ou de compte réel.
- L’intégration HTTP API est synchrone et plafonnée à 29 secondes. Elle ne garantit pas un affichage progressif des morceaux NDJSON pendant le calcul.
