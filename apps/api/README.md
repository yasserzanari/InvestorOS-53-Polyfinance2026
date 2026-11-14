# InvestorOS API

FastAPI est l’application HTTP commune au développement local et à AWS Lambda. Mangum adapte FastAPI à Lambda. L’API expose la lecture du contexte de démonstration, la conversation partagée avec Bedrock dans `/v1/profiles/*`, et des séries historiques de marché dans `/v1/simulation/*`.

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
| GET | `/v1/simulation/assets` | Univers historique configuré et ses limites |
| GET | `/v1/simulation/history/{ticker}` | Cours ajustés et réactions observées autour de distributions/fractionnements |
| GET | `/v1/profiles/status` | Configuration déclarée du modèle Bedrock (ne vérifie pas les permissions) |
| GET | `/v1/profiles/sources/{source_id}` | Notes de méthode exactes du catalogue produit |
| POST | `/v1/profiles/chat` | Conversation en flux NDJSON, outils contrôlés et résultats visibles |

Codes principaux : `200` succès, `404` fixture ou série absente, `403` association incohérente, `422` entrée invalide, `502` fixture mal formée, `503` configuration manquante. API Gateway applique aussi sa limitation de débit et peut répondre `429` avant l’exécution Lambda. Le flux de chat doit se terminer par un événement `done`; un HTTP 200 seul ne garantit pas que Bedrock ait répondu.

## Données historiques pour Simulation

Le backend lit les fichiers `assets_universe.csv`, `prices_daily.csv` et
`corporate_actions.csv` depuis `SIMULATION_DATA_DIR`. En développement, le chemin
par défaut pointe vers le paquet local ignoré sous
`docs/prep/sources/Datathon2026/alphaforge_starter`; pour Lambda, fournir un
répertoire de données empaqueté ou monté à cet emplacement configuré. Les fichiers
de données ne sont pas versionnés dans Git. Sans ces fichiers, les routes de
Simulation répondent clairement `503` plutôt que de produire des valeurs fictives.

Les séries utilisent `adj_close` en devise de cotation. Les rendements autour des
dates d’ex-dividende/de fractionnement sont des mesures historiques entre
observations disponibles (1, 5 et 20 séances d’observation), pas des effets
causaux ni des prévisions. Le jeu fourni couvre le 12 novembre 2021 au
12 novembre 2026 et est révisable par sa source. Il ne contient ni actualités,
ni publications sociales, ni fondamentaux, ni données ESG. Une relation entre une
date d’événement et un mouvement de prix ne démontre pas la causalité.

La route `/v1/simulation/regulations` recherche à la demande des documents
récents du Federal Register pour quatre sujets bornés (tarifs, chaîne logistique,
contrôles export, énergie). Elle retourne les dates de publication et d’entrée en
vigueur lorsqu’elles sont fournies, les agences, le résumé disponible et les liens
vers la page de document et le PDF govinfo. Les documents sont des pistes
réglementaires; leur présence ne prouve pas leur application à un émetteur ni
leur effet sur son cours. Le site avertit que sa représentation XML est
informative; vérifier l’édition officielle liée avant une lecture juridique.

Les publications de sociétés et les publications sociales ne sont pas encore
connectées à ces routes. Il faut les ingérer avec leur source primaire, heure de
publication, lien direct et méthode de vérification d’identité. L’API X demande
un jeton configuré côté serveur et facture ses usages; le frontend ne doit jamais
appeler X directement ni afficher des publications simulées.

## Ce qui n’est pas encore branché

La conversation de profil utilise le SDK Bedrock côté serveur lorsqu’un modèle est configuré; son statut de configuration ne prouve pas que l’invocation réussira. L’outil `analyze_demo_portfolio` lit le portefeuille fictif fixe configuré pour le déploiement et calcule les pondérations/concentration de manière déterministe. Simulation calcule désormais des trajectoires historiques et réactions datées pour les événements présents dans le paquet configuré; elle ne calcule pas encore de trajectoires futures ni de recherche de nouvelles en direct. Il n’existe pas encore Step Functions, RAG/Knowledge Base, recherche externe, authentification utilisateur ou accès financier. Seuls les statuts émis par les opérations réellement appelées peuvent être présentés comme des exécutions réelles.
