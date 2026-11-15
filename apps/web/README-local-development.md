# Développement local et accès AWS

## Démarrage habituel

Depuis la racine du dépôt, une seule commande lance l’interface **et** son API :

```sh
npm ci
npm run dev
```

L’API se lie à `127.0.0.1` sur le port `8010` (ou le premier port libre jusqu’à `8020`); Vite s’y connecte automatiquement. Le serveur choisit les valeurs AWS de développement connues : région `us-east-1`, Lambda `investoros-dev-api` et profil Bedrock US Nova Lite. Les portefeuilles de démonstration restent fictifs et locaux. Arrêter Vite arrête aussi l’API.

`npm run dev:local` reste un alias de cette commande. `npm run dev:web` démarre seulement Vite pour le travail d’interface isolé. Le proxy `/profile-api/*` garde les appels serveur hors du navigateur.

## Accès IAM local au moteur de recherche

Le navigateur AWS réserve les routes HTTP à une session Cognito administrateur. En développement, FastAPI utilise par défaut l’entrée Lambda IAM `investoros.research-iam`, limitée aux routes de lecture, lancement et annulation d’analyses. Il prend les identifiants de la chaîne AWS standard (credentials d’environnement, rôle de machine ou profil AWS/SSO); le navigateur ne reçoit jamais ces credentials.

La configuration habituelle ne demande aucun fichier. Si un profil SSO spécifique est nécessaire, ouvrez une session avant le démarrage :

```sh
aws sso login --profile mon-profil-sso
AWS_PROFILE=mon-profil-sso npm run dev
```

Le rôle AWS local doit pouvoir invoquer **uniquement** la Lambda de recherche prévue pour InvestorOS. Le handler IAM refuse les chemins, méthodes et formats d’événements hors contrat. Ne placez jamais de clés AWS, jetons Cognito ou secrets dans `apps/web/.env*`, dans une variable `VITE_*` ou dans Git.

Pour remplacer les paramètres par défaut, fournir `AWS_REGION`, `BEDROCK_MODEL_ID`, `RESEARCH_LAMBDA_FUNCTION` ou `RESEARCH_API_URL` dans l’environnement avant `npm run dev`. Le fichier ignoré `apps/api/.env.profile-api` reste disponible pour les valeurs non secrètes propres à un poste. Une valeur explicite de `RESEARCH_API_URL` ou `RESEARCH_LAMBDA_FUNCTION` est conservée.

Dans **Analyses**, le mode Vite local charge l’historique durable via `GET /v1/profiles/research/analyses`. Ouvrir une entrée passe son identifiant à Assistant, qui charge le résultat, les événements et les preuves avec `GET /v1/profiles/research/{analysis_id}`. Aucun résultat fictif de remplacement n’est ajouté en cas d’échec.

Sans identité AWS locale valide ou sans droit `lambda:InvokeFunction`, l’interface démarre tout de même et l’opération concernée affiche une erreur explicite. Vérifications utiles :

```sh
curl http://127.0.0.1:8010/health
aws sts get-caller-identity
```

Un `502` dans Analyses signifie généralement que l’entrée IAM n’est pas configurée ou que Lambda a refusé l’invocation. Vérifier le profil, la région, le nom de la fonction et l’action IAM, sans élargir les permissions HTTP de production.

## Développement contre l’API AWS HTTP

Pour tester le parcours de l’application déployée depuis le navigateur local, copier `apps/web/.env.aws.example` vers `apps/web/.env.aws`, puis renseigner l’URL API et les paramètres Cognito publics fournis par Terraform. Ensuite :

```sh
npm run dev:aws
```

Vite relaie `/api/*` vers API Gateway. Cette voie garde les autorisations JWT et nécessite une session administrateur Cognito. Les valeurs `VITE_*` sont visibles par le navigateur; elles ne doivent contenir aucun secret. Le profil IAM utilisé par le serveur local n’est pas transmis à cette voie.

## Architecture des deux voies

```text
Mode local : navigateur → proxy Vite /profile-api → FastAPI local
             FastAPI → AWS Lambda Invoke (IAM restreint) → analyses / événements / preuves

Mode AWS :   navigateur → CloudFront → API Gateway (JWT Cognito) → Lambda
```

Le mode local utilise les comptes et portefeuilles fictifs du dépôt. N’y branchez pas de données financières réelles. Consultez `apps/api/README.md` et `apps/api/src/investoros_api/profiles/README.md` pour le contrat du chat et du backend.
