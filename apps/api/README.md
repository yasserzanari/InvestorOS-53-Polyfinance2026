# InvestorOS API

FastAPI est l’application HTTP commune au développement local et à AWS Lambda. Mangum adapte FastAPI à Lambda. L’API expose la lecture du contexte de démonstration, la conversation partagée avec Bedrock dans `/v1/profiles/*`, et des séries historiques de marché dans `/v1/simulation/*`.

Ce README décrit les contrats et capacités du code. Leur présence ne prouve pas que chaque stack AWS est déployée ou que chaque intégration distante répond. Pour toute affirmation sur l’état réel, consulter la matrice de [l’alignement hackathon](../../docs/product/hackathon-alignment.md), les README Terraform de la stack concernée et une vérification de bout en bout datée.

## Contrat de démonstration

`GET /v1/demo/overview` renvoie un compte fictif fixe, son profil, son portefeuille et jusqu’à 25 analyses. Les objets portent `is_demo: true`, `data_class: fictional`, `source: fictional_fixture` ou `data_source: fictional_fixture`. Il n’existe aucun endpoint qui accepte un identifiant de compte choisi par le navigateur; les clés sont fixées par configuration Lambda. Les lectures DynamoDB utilisent ces clés de partition et l’API vérifie l’association compte/profil/portefeuille avant de répondre.

La démonstration AWS est protégée par un User Pool Cognito, un client web sans secret avec des mots de passe forts et des routes API Gateway qui valident les JWT. Le MFA TOTP est facultatif et peut être activé dans les paramètres. Les inscriptions publiques et la récupération de compte autonome sont désactivées; les comptes sont créés par un administrateur. Les routes démo restent limitées aux fixtures fictives fixes et ne constituent pas un accès à des comptes financiers personnels. Le mode local ne demande aucune connexion et garde ses fixtures locales.

## Développement local

```bash
npm run dev
```

Cette commande lance Vite et le serveur FastAPI local, lié à `127.0.0.1:8010` ou au premier port libre jusqu’à `8020`. Le launcher utilise automatiquement `us-east-1`, `us.amazon.nova-lite-v1:0` et la Lambda de recherche `investoros-dev-api` si aucune valeur n’est fournie. Les credentials sont résolus par la chaîne AWS standard; au besoin, faire `aws sso login --profile <profil>` puis démarrer avec `AWS_PROFILE=<profil> npm run dev`. Pour viser AWS depuis un navigateur local, copier `apps/web/.env.aws.example` vers `apps/web/.env.aws`, remplir l’URL API et les paramètres publics Cognito depuis Terraform, puis lancer `npm run dev:aws` depuis la racine. Ce parcours distant exige une session administrateur Cognito. Le navigateur ne reçoit aucun credential IAM : c’est le rôle Lambda qui lit les tables. Ne stocker aucune clé AWS dans le frontend ou dans un fichier versionné.

Le script `scripts/dev-profile-api.sh` active explicitement `DEMO_PORTFOLIO_MODE=local_fixture` pour les parcours de chat locaux. Ces portefeuilles fictifs partagent la source JSON que Terraform utilise pour initialiser DynamoDB. L’environnement Lambda force `DEMO_PORTFOLIO_MODE=dynamodb`; le mode local est refusé dans Lambda. Pour consulter les analyses, événements et preuves AWS depuis l’interface locale, le launcher utilise l’entrée IAM de recherche par défaut; le profil AWS actif doit avoir `lambda:InvokeFunction` sur cette seule Lambda. Son entrée interne n’accepte que les routes explicitement autorisées. Voir [le guide frontend local](../web/README-local-development.md).

Sur AWS, `GET /health` reste public pour le contrôle de vie. Les routes HTTP API exigent le JWT Cognito et les routes applicatives protégées vérifient aussi que le jeton validé par API Gateway contient le groupe `administrators`. Les inscriptions publiques sont désactivées, le MFA TOTP est facultatif et activable dans les paramètres, le client web utilise Authorization Code + PKCE sans secret client, et les jetons du navigateur restent dans `sessionStorage`. Le fichier local `AWS_ADMIN_CREDENTIALS.txt` est ignoré par Git et a des permissions privées; ne le copier ni dans une issue ni dans un commit. Le serveur local laisse `REQUIRE_ADMIN_AUTH` désactivé par défaut; l’authentification est activée par configuration Terraform AWS.

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
| GET | `/v1/portfolio-monitor/watchlist?persona=mateo` | Tickers explicitement associés à une position du persona fictif |
| POST | `/v1/portfolio-monitor/watchlist` | Associer un ticker de l’univers Simulation à une ligne explicite |
| DELETE | `/v1/portfolio-monitor/watchlist/{ticker}?persona=mateo` | Retirer un ticker de la veille |
| GET | `/v1/portfolio-monitor/cases?persona=mateo` | Dossiers de veille récents du compte fictif |
| PATCH | `/v1/portfolio-monitor/cases/{id}?persona=mateo&status=read|resolved` | Marquer la notification lue ou fermer le dossier |
| POST | `/v1/portfolio-monitor/refresh?persona=mateo` | Mettre en file une recherche immédiate pour le compte actif |
| GET | `/v1/portfolio-monitor/scans/{id}?persona=mateo` | Lire l’état d’une recherche (`pending`, `running`, `completed`, `failed`) |
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

## Capacités, intégrations et limites

L’Assistant partage le contexte du profil et du portefeuille fictif, appelle des outils contrôlés, peut charger les skills approuvés et peut préparer des actions ou des vues de travail. `analyze_demo_portfolio` calcule les pondérations et concentrations; `inspect_simulation_history` lit les cours ajustés et événements configurés; `project_market_scenarios` compare des hypothèses explicites aux fenêtres historiques. Ces calculs ne prédisent pas les cours. Un lien de relais vers un autre module ne signifie pas qu’une mutation ou une analyse supplémentaire y a été exécutée.

Les modules `research/` et `knowledge/` et les routes correspondantes sont présents dans le code. Le changement de fiabilité du 16 novembre ajoute à la stack assistant-simulation un pipeline déclaratif S3 → SQS/Lambda → Step Functions → Bedrock Knowledge Base et un binding administrable pour Bedrock Guardrails. Il faut encore que CI et le déploiement de `main` réussissent pour confirmer ces ressources dans AWS. Même après déploiement, la route de récupération ne prouve pas que l’Assistant utilise les passages retournés : le chat ne les ajoute pas encore à son contexte. Vérifier une exécution réelle et ses preuves avant de présenter ces capacités comme actives. `/v1/profiles/status` décrit une configuration, pas une invocation Bedrock réussie.

La recherche est bornée aux connecteurs et opérations documentés, par exemple les dépôts SEC, certains documents réglementaires, la couverture indexée GDELT et, si explicitement activée, X Recent Search. Cela ne constitue pas une recherche Web générale ni une couverture exhaustive. Le paquet AlphaForge inclus dans Simulation apporte les prix historiques, actifs et opérations sur titres; il ne fournit pas les actualités, publications sociales, fondamentaux d’entreprise, données ESG ou compositions complètes des FNB. Les champs absents doivent rester « indisponibles » et ne pas être inférés par un modèle.

L’authentification dépend du mode : le développement local est sans connexion; les stacks AWS documentées utilisent Cognito et des contrôles JWT/admin. Le produit de démonstration utilise des personas, portefeuilles et comptes fictifs; il n’accède pas à des comptes financiers réels et n’exécute pas de transactions. L’état de déploiement précis est consigné par stack dans les README Terraform; il doit être confirmé par des appels réels, pas extrapolé du code ou d’un plan Terraform.

Seuls les statuts et étapes issus d’opérations réellement appelées peuvent être présentés comme des exécutions réelles. Une collecte partielle, une source indisponible ou une couverture manquante doit rester visible dans l’analyse et ses visualisations.

## Recherche documentaire et skills

Les modules `research/` et `knowledge/` font partie du code API. Si `RESEARCH_API_URL`
est configurée dans le runtime profil, `start_analysis` relaie vers l’API de recherche;
le backend de recherche peut lancer ses collectes et son workflow configurés. Cela ne
prouve pas que toutes les stacks pointent vers cette API, que les tâches AWS sont
déployées ou qu’une exécution réussit. Les routes Knowledge Base de `knowledge/`
permettent les opérations déclarées par leur configuration; le nouveau pipeline
automatise l’indexation des uploads autorisés après déploiement, mais l’usage des
passages par l’Assistant reste à brancher et vérifier séparément. Les procédures
approuvées sont découvertes avec `search_skills` et lues avec `load_skill`; elles ne
sont pas éditées par le runtime. Voir [profiles/SKILLS.md](src/investoros_api/profiles/SKILLS.md)
et [profiles/README.md](src/investoros_api/profiles/README.md) pour les contrats et
les limites. Une recette NVDA documentée ou un ancien appel réel n’atteste pas l’état
actuel du déploiement.

`research/coverage.py` distingue la fin d’exécution et la couverture de la demande;
`documents.py` borne la lecture des sources primaires; `report.py` restitue les faits
numériques/datés et les points de vigilance conditionnels; `validation.py` contrôle
les dates des constats d’émetteur par rapport aux passages cités. Le CIK reçu doit
correspondre à l’entreprise demandée. Une simulation conditionnelle n’est lancée que
si des hypothèses de projection ont été explicitement demandées.
