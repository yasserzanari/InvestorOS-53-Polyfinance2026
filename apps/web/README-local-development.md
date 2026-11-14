# Développement local avec API AWS

## État actuel

Le frontend peut tourner localement avec `npm run dev`. Le mode `npm run dev:aws` proxifie `/api/*` vers un endpoint API Gateway configuré dans `.env.aws`.

À l’état actuel du dépôt, Terraform crée l’hébergement statique S3/CloudFront et l’identité de déploiement GitHub. Il ne crée pas encore API Gateway/Lambda pour InvestorOS. Le mode `dev:aws` devient réellement utilisable après le déploiement de cette API et la configuration de son URL. Il échoue volontairement au démarrage si la variable manque.

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

Le frontend doit appeler des chemins relatifs (`/api/profiles`, `/api/analyses`, etc.), jamais un domaine de production codé en dur. Le proxy évite d’exposer l’application aux détails CORS pendant le développement, mais il ne remplace ni l’authentification ni les contrôles IAM/API.

## Ressources AWS et responsabilités

- Les assets de l’interface restent servis par Vite localement; chaque modification UI apparaît immédiatement.
- Les requêtes métier passent vers l’API AWS configurée.
- Les permissions et secrets restent côté serveur/API; aucun credential AWS dans le navigateur ou le dépôt.
- Le bucket et CloudFront ne servent pas l’API et ne doivent pas être traités comme un backend.
- Tant qu’API Gateway/Lambda n’existent pas, utiliser `npm run dev` pour l’UI; ne pas prétendre que les modules consomment AWS.

## Workflow conseillé

1. Développer et ajuster l’interface avec `npm run dev`.
2. Pour le parcours API, basculer sur `npm run dev:aws` et vérifier que les réponses viennent de l’environnement AWS dev.
3. Afficher les erreurs réseau, permissions et quotas telles quelles dans les modules.
4. Publier via CI après validation et revue des changements Terraform.
