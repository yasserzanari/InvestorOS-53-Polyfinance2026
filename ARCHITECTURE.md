# Architecture du dépôt

Le dépôt sépare l’interface, l’API, l’orchestration et l’infrastructure pour que chaque couche puisse être développée et déployée indépendamment.

```text
apps/web → API Gateway → apps/api (Lambda) → Step Functions
                                               ├─ validation du profil/données
                                               ├─ calculs déterministes
                                               ├─ Bedrock Runtime / RAG
                                               └─ contre-analyse et validation
Données et documents → S3 privé     État des profils/analyses → DynamoDB
Interface → S3 privé + CloudFront   Observabilité → CloudWatch
```

## Frontend (`apps/web`)

Application React + TypeScript + Vite. `app/` porte la coque et les routes, `features/` les surfaces produit, `shared/` les composants réutilisables et `styles/` les tokens et styles globaux. La configuration AWS publique (région/URL API) est injectée au build; aucune identité AWS ne va dans le navigateur.

## API (`apps/api`)

FastAPI pour le développement local, servi sous Lambda via Mangum derrière API Gateway. Les routes valident les entrées et démarrent les analyses; `services/` encapsule Bedrock, S3, DynamoDB et Step Functions. Le rôle Lambda reçoit uniquement les actions ciblées nécessaires.

## Workflows (`services/workflows`)

Les analyses ont un état durable et observable via Step Functions. Les calculs financiers sont exécutés par code déterministe. Les appels de modèle ne choisissent pas eux-mêmes leurs permissions, budgets ou reprises.

## Infrastructure (`infrastructure/terraform`)

Les environnements `dev` et `demo` composent des modules pour frontend, API, workflow, données et observabilité. Le state Terraform est distant et verrouillé hors du dépôt. Les déploiements CI utilisent OIDC, jamais de clé AWS statique.

## Données

Le paquet fourni et les documents préparatoires sont conservés localement sous `docs/` ou `data/local/` et ne sont pas commités. Les données publiques destinées à l’application devront être accompagnées de provenance, date, devise, traitements et conditions d’utilisation.
