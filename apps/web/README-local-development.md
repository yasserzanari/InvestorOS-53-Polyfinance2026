# Développement local avec API AWS

## État actuel

Le frontend peut tourner localement avec `npm run dev`. Le mode `npm run dev:aws` proxifie `/api/*` vers un endpoint API Gateway configuré dans `.env.aws`.

Le code Terraform décrit maintenant API Gateway HTTP API, Lambda FastAPI/Mangum et des tables DynamoDB de démonstration en `us-east-1`. Ces ressources sont **préparées mais non déployées**. `dev:aws` devient réellement utilisable après leur création et la configuration de l’URL de base API. Il échoue volontairement au démarrage si `VITE_API_TARGET` manque.

## Première configuration

Depuis la racine du monorepo :

```sh
cp apps/web/.env.aws.example apps/web/.env.aws
```

Remplacer `VITE_API_TARGET` par l’URL de base API Gateway fournie par Terraform. `.env.aws` est ignoré par Git. Ne pas mettre de credentials, API keys ou secrets dans ce fichier; les valeurs `VITE_*` sont visibles dans le navigateur.

## Démarrer

```sh
npm run dev
```

Lance seulement Vite en mode local.

```sh
npm run dev:aws
```

Lance Vite en mode `aws` et configure le proxy local :

```text
Navigateur → http://localhost:5173/api/... → proxy Vite → API Gateway AWS
```

Le frontend appelle les routes disponibles via un chemin relatif. Pour cette tranche, le client demande `GET /api/v1/demo/overview`; Vite retire `/api` et relaie vers `GET /v1/demo/overview`. Ce endpoint ne lit qu’une fixture fictive fixée dans la Lambda. Les autres modules métier ne doivent pas être présentés comme connectés à AWS tant qu’ils n’ont pas leur propre contrat/API.

## Ressources AWS et responsabilités

- Les assets de l’interface restent servis par Vite localement; chaque modification UI apparaît immédiatement.
- Les requêtes métier passent vers l’API AWS configurée.
- Les permissions et secrets restent côté serveur/API; aucun credential AWS dans le navigateur ou le dépôt.
- Le bucket et CloudFront ne servent pas l’API et ne doivent pas être traités comme un backend.
- L’interface affiche l’état de connexion API et identifie la réponse comme une source DynamoDB fictive. Les métriques et modules qui ne lisent pas ce contrat restent en mode démonstration.
- Cette API publique ne possède pas encore d’authentification utilisateur. N’y placer aucune donnée financière réelle.

## Workflow conseillé

1. Développer et ajuster l’interface avec `npm run dev`.
2. Pour le parcours API, une fois les ressources appliquées avec un plan approuvé, basculer sur `npm run dev:aws` et vérifier que `/api/v1/demo/overview` identifie clairement sa fixture comme fictive.
3. Afficher les erreurs réseau, permissions et quotas telles quelles dans les modules.
4. Publier via CI après validation et revue des changements Terraform.
