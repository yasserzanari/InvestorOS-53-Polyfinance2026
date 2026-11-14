# InvestorOS API

FastAPI est l’application HTTP commune au développement local et à AWS Lambda. Mangum adapte FastAPI à Lambda. La première tranche expose seulement `GET /health` et `GET /v1/demo/overview`.

## Contrat de démonstration

`GET /v1/demo/overview` renvoie un compte fictif fixe, son profil, son portefeuille et jusqu’à 25 analyses. Les objets portent `is_demo: true`, `data_class: fictional`, `source: fictional_fixture` ou `data_source: fictional_fixture`. Il n’existe aucun endpoint qui accepte un identifiant de compte choisi par le navigateur; les clés sont fixées par configuration Lambda. Les lectures DynamoDB utilisent ces clés de partition et l’API vérifie l’association compte/profil/portefeuille avant de répondre.

Cette première route ne constitue pas une authentification multi-utilisateur. Elle ne doit contenir aucune donnée financière personnelle. Avant l’ajout de profils privés, ajouter Cognito/JWT, valider le sujet du jeton côté API et dériver l’association utilisateur/compte du jeton, jamais du body envoyé par le client.

## Développement local

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn investoros_api.main:app --app-dir src --reload --port 8000
```

Le contrôle de vie est `http://localhost:8000/health`. Pour appeler l’API distante depuis le frontend, copier `apps/web/.env.aws.example` vers `apps/web/.env.aws`, mettre l’URL API fournie par Terraform dans `VITE_API_TARGET`, puis lancer `npm run dev:aws` depuis `apps/web`. Le navigateur ne reçoit aucun credential AWS : c’est le rôle Lambda qui lit les tables. Ne stocker aucune clé dans le frontend ou dans un fichier versionné.

## Paquet Lambda

Depuis la racine du dépôt :

```bash
uv python install 3.12
./scripts/build-api.sh
```

Le script produit `apps/api/build/investoros-api.zip`, ciblé Python 3.12. Terraform attend exactement ce chemin. Le répertoire `apps/api/build/` est ignoré par Git. Le zip doit être construit avant `terraform plan` ou `terraform apply`; Terraform échoue volontairement si le paquet manque.

## Routes et erreurs

| Méthode | Route | Usage |
| --- | --- | --- |
| GET | `/health` | Liveness sans dépendance aux services AWS |
| GET | `/v1/demo/overview` | Lecture du contexte fictif DynamoDB |

Codes principaux : `200` succès, `404` fixture absente, `403` association incohérente, `502` fixture mal formée, `503` configuration manquante. API Gateway applique aussi sa limitation de débit et peut répondre `429` avant l’exécution Lambda. Les routes d’analyse et leurs plafonds de coût ne sont pas encore créés.

## Ce qui n’est pas encore branché

Aucun moteur de simulation, Step Functions, Bedrock, RAG/Knowledge Base, recherche externe, authentification utilisateur ni accès financier n’est déployé. Les vues du produit qui ne consomment pas cette route doivent rester étiquetées « Démo » ou « Simulé ». Les statuts d’agents ne peuvent pas être présentés comme des exécutions réelles.
