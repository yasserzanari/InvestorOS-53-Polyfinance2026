# API Assistant, Simulation et jobs de chat

Cette stack relie `/v1/profiles/*` et `/v1/simulation/*` à la Lambda `investoros-dev-assistant-simulation`. API Gateway vérifie les JWT Cognito et la Lambda exige le groupe `administrators`. Le prévol `OPTIONS` reste sans authentification; `/health` est public. La configuration CORS de la passerelle doit autoriser `PUT` pour la mémoire, en plus de `GET`, `POST`, `PATCH` et `OPTIONS`.

Le state S3 propre à cette stack est `dev/assistant-simulation/terraform.tfstate`. Le state canonique fournit notamment API, tables fictives et paramètres Cognito; aucune ressource ne doit en être retirée pour appliquer cette tranche. Les CSV historiques sont intégrés à l’archive locale ignorée produite par `scripts/build-api.sh`. Le script vérifie aussi l’import de l’API depuis un répertoire peu profond, proche du paquet Lambda; `docs/` et les jeux privés ne sont pas commités.

## Chemin des réponses Profile

L’intégration HTTP API tamponne la réponse Lambda et reste plafonnée à environ 29 secondes. Le NDJSON direct `/v1/profiles/chat` est conservé; il ne garantit pas une progression visible depuis cette passerelle. Le frontend utilise les jobs lorsque `/v1/profiles/status` annonce `chatTransport: async`.

```text
Navigateur connecté → POST /v1/profiles/chat/jobs → réponse 202
                                  ↓ invocation Lambda Event
                       profile-chat-worker → Bedrock/outils
                                  ↓ progression réelle
                       profile-chat-jobs (DynamoDB)
Navigateur connecté → GET /chat/jobs/{jobId}?accountId=…&after=…
```

La table utilise `job_id` comme clé et `expiresAt` comme TTL. Les identifiants de l’API restent nommés `jobId`. Le worker prend le job par écriture conditionnelle, ce qui évite une double exécution lors d’une livraison répétée. Les curseurs de lecture suivent des événements append-only; les fragments de texte en attente peuvent être regroupés avant publication.

| Réglage | Valeur / effet |
|---|---|
| `PROFILE_CHAT_JOBS_TABLE` | Table DynamoDB des événements et statuts. |
| `PROFILE_CHAT_WORKER_FUNCTION` | Fonction dédiée invoquée par la Lambda API; avec la table, active le transport asynchrone. |
| Worker | Python 3.12, 512 Mo, timeout 120 secondes. |
| Invocation asynchrone | Âge maximal 60 secondes, aucune relance automatique. |
| Délai applicatif du job | 180 secondes, puis état terminal explicite au polling. |
| Conservation | Expiration applicative après 3 600 secondes; suppression TTL DynamoDB différée. |
| Bornes | Requête 200 000 octets; journal environ 378 000 octets, avec erreur explicite si dépassement. |
| Recherche du worker | `RESEARCH_LAMBDA_FUNCTION=investoros-dev-api`, via IAM, sans transmettre le JWT navigateur. |

`POST /v1/profiles/chat/jobs/{jobId}/cancel?accountId=…` demande l’arrêt. Le worker vérifie l’état entre événements et opérations. Un appel AWS déjà engagé peut finir; l’arrêt n’annule pas les effets d’une opération accomplie. Les lectures et arrêts vérifient le persona fictif propriétaire. La table ne conserve ni JWT, ni mot de passe, ni corps de requête de lancement.

`profile-chat.tf` définit sept ressources : table, groupe de logs, rôle worker, politique worker, fonction worker, configuration d’invocation et politique de dispatch de l’API. Le dispatch possède `GetItem`, `PutItem`, `UpdateItem` sur la seule table de jobs et `InvokeFunction` sur le seul worker. Le worker possède les opérations de table nécessaires, Bedrock et les accès bornés aux données et à l’entrée IAM de recherche. La Lambda API conserve sa concurrence réservée de deux; le worker utilise la capacité non réservée du compte.

La mémoire durable du profil est distincte des jobs temporaires : `SOURCE_WORKSPACE_TABLE` ou `PROFILE_WORKSPACE_TABLE` désigne la table de comptes. Seul l’attribut `profile_workspace` est modifié par l’adaptateur de mémoire, avec révision optimiste et contrôle des clés via `DEMO_CONTEXTS`.

## Préparer et examiner

Depuis la racine du dépôt :

```sh
./scripts/build-api.sh
cd infrastructure/terraform/environments/assistant-simulation
terraform init -reconfigure
terraform plan -out=/tmp/investoros-assistant-simulation.tfplan
terraform show /tmp/investoros-assistant-simulation.tfplan
```

Le 15 novembre 2026, les sept ressources de chat créées dans AWS dev ont été importées dans ce state. Aucun `apply` Terraform global n’a été exécuté pour cette intervention. Relever l’état réel et le plan avant une mise à jour : ne pas recréer une ressource déjà importée, ni appliquer un plan qui supprime, remplace ou modifie des ressources hors de cette stack. La configuration CORS de l’API partagée appartient à son module propriétaire; sa présence dans le code ne prouve pas son application dans AWS.

L’archive API doit être cohérente entre Assistant/Simulation et worker pour que contrats, outils et skills correspondent. Terraform l’envoie dans le bucket privé `investoros-<environment>-<account>-lambda-artifacts-<region>` sous une clé adressée par contenu; les deux fonctions déploient le même objet S3, ce qui supporte les archives dépassant la limite d’envoi direct Lambda. Le chiffrement S3 AES-256 est activé. Les anciennes clés d’artefacts ne sont pas supprimées automatiquement afin de conserver un retour arrière. Un déploiement du frontend seul ne met pas à jour ces fonctions. Vérifier le statut de mise à jour des fonctions avant l’essai connecté.

## Vérifications observées

Le parcours public Profile a réussi le 15 novembre 2026 à 16:33 UTC sur `https://d10hypspu2l2nc.cloudfront.net` : huit champs Robert, confirmation humaine, alignement, comparaison AAPL/MSFT, scénario AAPL recalculé de 20 à 30 séances, note créée puis fermée sans recalcul d’ancien scénario, lecture du portefeuille fictif et restauration depuis un navigateur neuf conservant les 30 séances. Le navigateur utilise réellement Cognito, Bedrock, la table de jobs et DynamoDB; aucune réponse n’est interceptée dans cet essai. Le catalogue compte 19 skills 1.8.18; les événements identifient les procédures réellement chargées à chaque tour.

Le smoke test API connecté a vérifié des routes protégées `200`, le refus `401` sans JWT, la mémoire `PUT 200`, le conflit concurrent `409` et un job `202` suivi d’un résultat calculé. Les contrôles déterministes de progression et d’annulation utilisent des interceptions explicites; ils ne remplacent pas un essai AWS.

Depuis la racine :

```sh
node scripts/test-profile-deployed-api.cjs
PROFILE_DEPLOYED_MODE=1 PROFILE_LIVE_PORTFOLIO=1 node scripts/test-profile-aws-live.cjs
```

Ces commandes utilisent exclusivement le compte Cognito de test et le fichier ignoré décrits dans `AGENTS.md`; ne jamais afficher les secrets ni capturer le formulaire rempli. Elles écrivent la mémoire du persona fictif Robert. Les preuves sont conservées localement sous `docs/prep/profile-workbench-evidence/aws-renewed/`, dont `deployed-ui/summary.json` et `phases.json`. La correction de réévaluation des anciennes cartes a aussi réussi le parcours public de 16:33 UTC : la carte précédente est conservée dans le workspace, mais son texte ne sert pas de base factuelle au nouveau constat.

## Limites

- Ces preuves concernent le parcours Profile testé, pas tous les connecteurs ni le lancement de toute recherche documentaire.
- Les conversations restent locales au navigateur; profil et documents sont restaurables depuis le serveur. Les jobs expirent et ne remplacent pas cette mémoire.
- L’univers historique est fini et n’est pas un flux de marché en direct. Les scénarios sont conditionnels; aucun conseil financier personnalisé ni transaction n’est fourni.
- Le modèle par défaut est `us.anthropic.claude-sonnet-4-6`; quotas, concurrence disponible et coûts dépendent du compte AWS.
- X Recent Search reste désactivé; aucun secret X n’est lu.
- Inscriptions Cognito et récupération autonome du mot de passe restent désactivées. Ne pas modifier le pool ou les comptes pour un smoke test.
