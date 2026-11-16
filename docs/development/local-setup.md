# Développement local

## Prérequis

- Node.js 24 (`.nvmrc`) et npm;
- Python 3.12 pour l’API locale;
- `uv` pour les commandes Python documentées dans les sous-projets.

## Installation et démarrage

À la racine du dépôt :

```bash
npm ci
npm run dev:local
```

Le script lance l’API puis Vite et affiche l’adresse du site. Il choisit un port API libre entre 8010 et 8020; on peut fixer ce port avec `PROFILE_API_PORT`.

Pour lancer seulement l’interface :

```bash
npm run dev:web
```

Pour les dépendances ou commandes de l’API, consulter [`apps/api/README.md`](../../apps/api/README.md). Le frontend indique sa configuration réseau dans `apps/web/vite.config.ts` et dans les fichiers `README-local-development.md` associés.

## Variables locales et AWS

Les fichiers `.env*` locaux sont ignorés par Git. Ne commitez jamais de jetons, mots de passe, identifiants AWS ou données privées. L’API peut charger des réglages locaux documentés par `scripts/dev-profile-api.sh`; ces réglages restent côté serveur.

Un démarrage local ne prouve pas l’accès à Bedrock, DynamoDB, S3 ou une Lambda distante. Les fonctions qui en dépendent nécessitent l’IAM approprié et parfois une stack AWS déjà déployée. Consultez [les limites de l’architecture et du déploiement](../architecture/runtime-and-deployment.md) et le README Terraform de la stack avant d’exécuter une opération AWS.

## Vérifications

```bash
npm run typecheck
npm run build
```

Les commandes API et de tests sont définies dans `apps/api/pyproject.toml`. N’utilisez pas une fixture navigateur comme preuve d’un appel externe réel; les preuves de déploiement sont datées dans la documentation produit.
