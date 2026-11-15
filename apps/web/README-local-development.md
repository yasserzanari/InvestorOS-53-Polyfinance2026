# Développement local et accès AWS

## Démarrage habituel

Depuis la racine du dépôt :

```sh
npm ci
npm run dev
```

Cela démarre seulement Vite. Les vues UI et les fixtures locales fonctionnent sans Cognito. Pour le chat, la recherche AWS, les événements et les preuves, démarrez aussi l’API locale :

```sh
npm run dev:local
```

Cette commande lance FastAPI sur `127.0.0.1:8010` (ou le premier port libre jusqu’à `8020`) puis Vite sur `http://localhost:5173`. L’adresse réelle de l’API est affichée au démarrage. Vite relaie `/profile-api/*` vers FastAPI; le navigateur ne reçoit jamais de credentials AWS. Arrêter Vite arrête aussi l’API.

## Accès IAM local au moteur de recherche

Le navigateur AWS réserve les routes HTTP à une session Cognito administrateur. En développement, FastAPI peut utiliser l’entrée Lambda IAM `investoros.research-iam`, limitée aux routes de lecture, lancement et annulation d’analyses. L’interface locale appelle uniquement FastAPI; celui-ci utilise la chaîne d’identifiants AWS standard avec `lambda:InvokeFunction`.

Créer le fichier local ignoré `apps/api/.env.profile-api` :

```dotenv
AWS_PROFILE=mon-profil-sso
AWS_REGION=us-east-1
RESEARCH_LAMBDA_FUNCTION=investoros-dev-api
```

Adapter le nom du profil et celui de la Lambda à l’environnement fourni par l’équipe AWS. Puis ouvrir une session SSO avant le démarrage :

```sh
aws sso login --profile mon-profil-sso
npm run dev:local
```

Le rôle AWS local doit pouvoir invoquer **uniquement** la Lambda de recherche prévue pour InvestorOS. Le handler IAM refuse les chemins, méthodes et formats d’événements hors contrat. Ne placez jamais des clés AWS, jetons Cognito ou secrets dans `apps/web/.env*`, dans une variable `VITE_*` ou dans Git. `AWS_PROFILE` et la fonction Lambda ne sont pas des secrets; les credentials restent dans la configuration SSO locale.

Dans **Analyses**, le mode Vite local charge l’historique durable via `GET /v1/profiles/research/analyses`. Ouvrir une entrée passe son identifiant à Assistant, qui charge le résultat, les événements et les preuves avec `GET /v1/profiles/research/{analysis_id}`. Aucun résultat fictif de remplacement n’est ajouté en cas d’échec.

Sans configuration IAM, les autres éléments du frontend restent utilisables; le panneau Analyses affiche une erreur explicite et aucune connexion AWS n’est prétendue. Vérifications utiles :

```sh
curl http://127.0.0.1:8010/health
aws sts get-caller-identity --profile mon-profil-sso
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
