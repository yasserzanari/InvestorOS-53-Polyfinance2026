# InvestorOS API

FastAPI est l’application HTTP commune au développement local et à AWS Lambda. Mangum adapte FastAPI à Lambda. L’API expose la lecture du contexte de démonstration, la conversation partagée avec Bedrock dans `/v1/profiles/*`, et des séries historiques de marché dans `/v1/simulation/*`.

## Contrat de démonstration

`GET /v1/demo/overview` renvoie un compte fictif fixe, son profil, son portefeuille et jusqu’à 25 analyses. Les objets portent `is_demo: true`, `data_class: fictional`, `source: fictional_fixture` ou `data_source: fictional_fixture`. Il n’existe aucun endpoint qui accepte un identifiant de compte choisi par le navigateur; les clés sont fixées par configuration Lambda. Les lectures DynamoDB utilisent ces clés de partition et l’API vérifie l’association compte/profil/portefeuille avant de répondre.

La démonstration AWS est protégée par un User Pool Cognito, un client OAuth public avec Authorization Code + PKCE, des mots de passe forts, MFA TOTP obligatoire et des routes API Gateway qui valident les JWT. Les inscriptions publiques et la récupération de compte autonome sont désactivées; les comptes sont créés par un administrateur. Les routes démo restent limitées aux fixtures fictives fixes et ne constituent pas un accès à des comptes financiers personnels. Le mode local ne demande aucune connexion et garde ses fixtures locales.

## Développement local

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn investoros_api.main:app --app-dir src --reload --port 8000
```

Le contrôle de vie est `http://localhost:8000/health`. Le mode normal `npm run dev` utilise les services locaux et ne demande pas de connexion. Pour viser AWS depuis un navigateur local, copier `apps/web/.env.aws.example` vers `apps/web/.env.aws`, remplir l’URL API et les quatre paramètres Cognito depuis Terraform, puis lancer `npm run dev:aws` depuis `apps/web`; ce parcours distant exige le compte administrateur et MFA. Le navigateur ne reçoit aucun credential IAM : c’est le rôle Lambda qui lit les tables. Ne stocker aucune clé AWS dans le frontend ou dans un fichier versionné.

Le script `scripts/dev-profile-api.sh` active explicitement `DEMO_PORTFOLIO_MODE=local_fixture` pour les parcours de chat locaux. Ces portefeuilles fictifs partagent la source JSON que Terraform utilise pour initialiser DynamoDB. L’environnement Lambda force `DEMO_PORTFOLIO_MODE=dynamodb`; le mode local est refusé dans Lambda.

Sur AWS, `GET /health` reste public pour le contrôle de vie. Les routes HTTP API exigent le JWT Cognito et les routes applicatives protégées vérifient aussi que le jeton validé par API Gateway contient le groupe `administrators`. Les inscriptions publiques sont désactivées, MFA TOTP est obligatoire, le client web utilise Authorization Code + PKCE sans secret client, les jetons du navigateur restent dans `sessionStorage` et les jetons d’accès expirent après 15 minutes. Cognito force le changement du mot de passe temporaire puis l’enrôlement TOTP à la première connexion. Le fichier local `AWS_ADMIN_CREDENTIALS.txt` est ignoré par Git, a des permissions privées et ne contient qu’un mot de passe temporaire; ne le copier ni dans une issue ni dans un commit. Le serveur local laisse `REQUIRE_ADMIN_AUTH` désactivé par défaut; l’authentification est activée par configuration Terraform AWS.

## Paquet Lambda

Depuis la racine du dépôt :

```bash
uv python install 3.12
./scripts/build-api.sh
```

Pour connecter Assistant/Profils et Simulation à l’API AWS sans remplacer la Lambda actuellement utilisée par les routes de recherche et de connaissances, utiliser la stack à state séparé [`assistant-simulation`](../../infrastructure/terraform/environments/assistant-simulation/README.md). Le paquet contient les CSV locaux ignorés; ils ne sont jamais ajoutés à Git.

Le script produit `apps/api/build/investoros-api.zip`, ciblé Python 3.12. Terraform attend exactement ce chemin. Le répertoire `apps/api/build/` est ignoré par Git. Le zip doit être construit avant `terraform plan` ou `terraform apply`; Terraform échoue volontairement si le paquet manque.

## Routes et erreurs

| Méthode | Route | Usage |
| --- | --- | --- |
| GET | `/health` | Liveness sans dépendance aux services AWS |
| GET | `/v1/demo/overview` | Lecture du contexte fictif DynamoDB |
| GET | `/v1/simulation/assets` | Univers historique configuré et ses limites |
| GET | `/v1/simulation/history/{ticker}` | Cours ajustés et réactions observées autour de distributions/fractionnements |
| GET | `/v1/simulation/event-study/{ticker}?event_date=YYYY-MM-DD` | Rendements descriptifs du titre et d’un indice proxy de même devise après une date; sans attribution causale |
| GET | `/v1/simulation/regulations?topic=...&page=1` | Documents Federal Register dans une période datée, paginés par date de publication, avec liens officiels associés |
| GET | `/v1/simulation/filings/{ticker}?start_date=YYYY-MM-DD` | Déclarations EDGAR récentes et historiques depuis le début de la série visible; nécessite `SEC_USER_AGENT` côté serveur |
| GET | `/v1/simulation/news/{ticker}` | Couverture secondaire récente indexée par GDELT; cache positif et pause après erreur ou limitation |
| GET | `/v1/simulation/social/{ticker}?accounts=handle1,handle2` | Publications X publiques des sept derniers jours; connecteur désactivé par défaut; filtre facultatif sur cinq comptes fournis par l’utilisateur |
| POST | `/v1/simulation/scenarios` | Quantiles de rendements historiques et chocs conditionnels saisis par l’utilisateur |
| GET | `/v1/profiles/status` | Configuration déclarée du modèle Bedrock (ne vérifie pas les permissions) |
| GET | `/v1/profiles/sources/{source_id}` | Notes de méthode exactes du catalogue produit |
| POST | `/v1/profiles/chat` | Conversation en flux NDJSON, outils contrôlés et résultats visibles |

Codes principaux : `200` succès, `404` fixture ou série absente, `403` association incohérente, `422` entrée invalide, `502` fixture mal formée, `503` configuration manquante. API Gateway applique aussi sa limitation de débit et peut répondre `429` avant l’exécution Lambda. Le flux de chat doit se terminer par un événement `done`; un HTTP 200 seul ne garantit pas que Bedrock ait répondu.

## Données historiques pour Simulation

Le backend lit les fichiers `assets_universe.csv`, `prices_daily.csv` et
`corporate_actions.csv` depuis `SIMULATION_DATA_DIR`. En développement, le chemin
par défaut pointe vers le paquet local ignoré sous
`docs/prep/sources/Datathon2026/alphaforge_starter`. `scripts/build-api.sh` inclut
ces trois fichiers dans `investoros_api/data` dans l’archive Lambda et échoue
explicitement si le paquet source manque. Les trois fichiers inclus totalisent
environ 3,3 Mo.
Ils sont empaquetés depuis les fichiers présents localement; aucun CSV n’est
versionné dans Git. `SIMULATION_DATA_DIR` permet de remplacer ce chemin en développement ou
au déploiement. Sans le jeu requis, les routes de Simulation répondent clairement
`503` plutôt que de produire des valeurs fictives.

Les séries utilisent `adj_close` en devise de cotation. Les rendements autour des
dates d’ex-dividende/de fractionnement sont des mesures historiques entre
observations disponibles (1, 5 et 20 séances d’observation), pas des effets
causaux ni des prévisions. Le jeu fourni couvre le 12 novembre 2021 au
12 novembre 2026 et est révisable par sa source. Il ne contient ni actualités,
ni publications sociales, ni fondamentaux, ni données ESG. Une relation entre une
date d’événement et un mouvement de prix ne démontre pas la causalité.

La route `/v1/simulation/regulations` recherche à la demande des documents du
Federal Register sur une fenêtre de cinq ans par défaut (modifiable par `start_date`
et `end_date`) pour quatre sujets bornés (tarifs, chaîne logistique, contrôles
export, énergie). `page` parcourt les résultats de 20 documents triés du plus récent au
plus ancien; `count` et `total_pages` de la source rendent la couverture restante
visible. L’interface permet de charger les pages historiques et ne projette sur le
graphique que les documents dans la période de cours affichée. Elle retourne les
dates de publication et d’entrée en vigueur lorsqu’elles sont fournies, les
agences, le résumé disponible et les liens vers la page de document et le PDF
govinfo. Les documents sont des pistes
réglementaires; leur présence ne prouve pas leur application à un émetteur ni
leur effet sur son cours. Le site avertit que sa représentation XML est
informative; vérifier l’édition officielle liée avant une lecture juridique.

`GET /v1/simulation/filings/{ticker}` résout le CIK depuis le catalogue SEC et
lit les métadonnées de dépôts EDGAR (8-K, 10-K, 10-Q et formulaires étrangers
équivalents). Le paramètre `start_date` demande les dépôts depuis le début de la
série de prix affichée; l’API consulte les archives EDGAR de l’émetteur lorsque
la période dépasse l’historique récent inclus dans la réponse principale. La
liste retourne au plus 50 dépôts et le signale si elle est tronquée ou si une
archive n’a pas pu être chargée. Configurer un entête `SEC_USER_AGENT` qui
identifie l’application et un contact maintenu par l’exploitant; les requêtes
sont limitées et mises en cache côté API. Les heures et dates déposées sont des
dates de document, pas des mesures de causalité. Les rendements postérieurs
restent absents lorsque le jeu de prix finit avant le dépôt. Dans le graphique,
les dépôts situés dans la période de prix visible ont un marqueur sélectionnable;
les dépôts plus récents restent ouvrables depuis la liste sans être projetés
artificiellement sur la courbe.

`POST /v1/simulation/scenarios` accepte un ticker configuré, un horizon de 20,
60 ou 120 séances et deux à quatre branches. Chaque branche exige un texte de
condition, un choc chiffré explicitement fourni (−80 % à +100 %) et son jalon.
L’API compare ces hypothèses aux fenêtres historiques du titre. Les quantiles
par jalon sont marginaux et ne forment pas des chemins historiques individuels;
la réponse inclut la date source, la méthode et les limites. Ce calcul n’est ni
une prévision, ni une probabilité de scénario, ni une recommandation.

La couverture médiatique n’alimente pas le calcul des cours; `/v1/simulation/news/{ticker}`
ajoute une recherche GDELT DOC 2.0 sur les 30 derniers jours. `indexedAt` est
l’horodatage auquel GDELT a repéré le document, pas nécessairement sa date de
publication. Ces liens
sont des pistes secondaires de couverture, pas des déclarations vérifiées de
l’émetteur : les homonymes et les mentions indirectes sont possibles. La route
retourne l’heure d’indexation quand elle est fournie, garde seulement les URLs
HTTPS et met en cache les réponses pendant 10 minutes (2 minutes après échec,
incluant HTTP 429) pour limiter les appels. Une source indisponible est affichée
comme telle, sans articles inventés. Les articles ne sont jamais utilisés comme
événements de prix ni pour attribuer un mouvement à une nouvelle.

Les publications X sont intégrées à la route optionnelle `/v1/simulation/social`,
mais ne sont pas activées par défaut. Leur API est payante et exige un jeton
configuré côté serveur; l’option reste désactivée afin
qu’un chargement de page ne déclenche pas de requête facturable. L’API X v2
utilise un modèle de paiement à l’usage et Recent Search ne couvre que les sept
derniers jours ([présentation officielle](https://docs.x.com/x-api/getting-started/about-x-api),
[recherche de publications](https://docs.x.com/x-api/posts/search/introduction)).

Pour une activation après validation du budget et des règles de conservation :

- définir `SIMULATION_X_SEARCH_ENABLED=true` côté serveur;
- en local seulement, fournir `X_API_BEARER_TOKEN` dans l’environnement du
  processus API sans le commiter;
- sur AWS, créer un secret Secrets Manager ne contenant que le Bearer Token,
  puis passer son ARN à Terraform avec `x_api_bearer_token_secret_arn`;
- limiter l’accès IAM au seul ARN du secret; la variable Terraform d’activation
  reste `false` par défaut.

La route accepte un filtre `accounts` facultatif : au plus cinq identifiants X
fournis par l’utilisateur, séparés par des virgules ou des espaces. Ils sont
combinés au nom ou symbole de l’émetteur, afin que les posts retournés répondent
aux deux critères. Le format des identifiants est validé, mais l’application ne
confirme pas que le compte appartient réellement à un dirigeant, une autorité ou
une autre personne. Aucun compte n’est découvert ou ajouté automatiquement.
La route borne chaque recherche à 25 publications, met les résultats en cache
cinq minutes (deux minutes après erreur) en mémoire du processus et ne persiste
pas les posts. Les liens ouvrent la publication source; les images jointes sont
des aperçus fournis par X et ne prouvent pas la nature ou la pertinence de
l’événement. Les posts sont des pistes sociales, jamais des faits établis ou des
événements de cours. Aucun résultat X n’alimente les quantiles ni les trajectoires
de Simulation. Il s’agit d’une recherche récente, pas d’une archive historique
ni d’un suivi complet des dirigeants, responsables publics ou autres comptes.

## Ce qui n’est pas encore branché

La conversation partagée entre le profil et la page Assistant utilise le SDK Bedrock côté serveur lorsqu’un modèle est configuré; son statut de configuration ne prouve pas que l’invocation réussira. L’outil `analyze_demo_portfolio` lit le portefeuille fictif fixe configuré pour le déploiement et calcule les pondérations/concentration de manière déterministe. `inspect_simulation_history` lit les cours ajustés et événements du jeu Simulation configuré; `project_market_scenarios` exécute le même calcul de quantiles conditionnels que la page Simulation et n’accepte que les hypothèses explicites de l’utilisateur. Ces résultats comprennent un lien vers Simulation avec le ticker sélectionné. Un lien de relais n’exécute pas d’autres mutations dans le module cible. Les outils de conversation peuvent gérer le profil et les onglets partagés, consulter des spécialistes Bedrock ou préparer des tâches avec des liens vers les modules. Simulation ne prédit pas les cours. Il n’existe pas encore Step Functions, RAG/Knowledge Base, recherche générale externe, authentification utilisateur ou accès financier. Seuls les statuts émis par les opérations réellement appelées peuvent être présentés comme des exécutions réelles.
