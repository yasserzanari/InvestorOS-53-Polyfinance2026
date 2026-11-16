# API Assistant, Simulation et jobs de chat

## Déploiement automatique depuis `main`

Le workflow GitHub Actions `Deploy assistant simulation infrastructure` lance un plan à chaque push sur `main` et applique les créations/modifications détectées dans ce state. Les plans qui contiennent une suppression ou un remplacement échouent avant l'application. Le workflow `CI` valide séparément les trois roots Terraform; le root global `dev` ne fait pas partie du déploiement automatique.

Le job utilise GitHub OIDC, sans clé AWS statique, avec le rôle dédié dont l'ARN est stocké dans la variable de dépôt `AWS_TERRAFORM_ROLE_ARN`. Ce rôle doit autoriser uniquement le state `dev/assistant-simulation/terraform.tfstate` (et son fichier de verrou), la lecture du state de fondation `dev/terraform.tfstate`, le préfixe d'artefacts `assistant-simulation/`, les trois CSV privés sous `alphaforge_starter/`, `ssm:GetParameter` sur `/investoros-dev/knowledge/{documents-bucket,knowledge-base-id,data-source-id}`, et les ressources AWS gérées par ce root. Son trust doit être limité à ce dépôt et à `refs/heads/main`. Pour le déploiement `workflow_dispatch` avec `runtime_only=true`, il lui faut aussi `lambda:GetFunction`, `lambda:GetFunctionConfiguration` et `lambda:UpdateFunctionCode` sur la seule fonction `investoros-dev-research-worker`; cette autorisation est portée par la policy managée `investoros-dev-research-worker-code-publisher`. Les droits de lecture SSM restent limités à leurs trois paramètres; un plan qui rencontre `AccessDenied` s'arrête avant tout apply.

Pour les changements API, skills ou Terraform, le job récupère les trois CSV privés depuis le bucket de recherche et reconstruit l'archive Lambda avec `scripts/build-api.sh`. Pour les autres changements, il reprend l'archive de la Lambda active afin que son hash reste stable et qu'un push sans rapport ne redéploie pas le code API. Une exécution manuelle `workflow_dispatch` reconstruit toujours l'archive. L'option manuelle `runtime_only=true` publie le même paquet sur l'API Assistant, son worker de chat et le worker de recherche API-Anything, en préservant leur configuration; le script contrôle les empreintes et restaure les versions précédentes si une mise à jour échoue.

Le rôle OIDC est un prérequis à installer une seule fois hors du workflow, car le workflow ne peut pas créer le rôle qui lui donne accès à AWS. Aucun secret AWS longue durée n'est requis. Les suppressions/remplacements bloquent l'application, à l'exception de la rotation de l'objet `aws_s3_object.api_package` lorsque sa seule clé de remplacement est `key`; l'application supprime alors l'ancienne clé d'archive suivie par Terraform. Toute autre action destructive demande une revue humaine avant toute évolution du garde-fou.

Cette stack relie `/v1/profiles/*` et `/v1/simulation/*` à la Lambda `investoros-dev-assistant-simulation`. API Gateway vérifie les JWT Cognito et la Lambda exige le groupe `administrators`. Le prévol `OPTIONS` reste sans authentification; `/health` est public. La configuration CORS de la passerelle doit autoriser `PUT` pour la mémoire, en plus de `GET`, `POST`, `PATCH` et `OPTIONS`.

Le state S3 propre à cette stack est `dev/assistant-simulation/terraform.tfstate`. Le state canonique fournit notamment API, tables fictives et paramètres Cognito; aucune ressource ne doit en être retirée pour appliquer cette tranche. Les CSV historiques sont intégrés à l’archive locale ignorée produite par `scripts/build-api.sh`. Le script vérifie aussi l’import de l’API depuis un répertoire peu profond, proche du paquet Lambda; `docs/` et les jeux privés ne sont pas commités.

## Chemin des réponses Profile

L’intégration HTTP API tamponne la réponse Lambda et reste plafonnée à environ 29 secondes. Le NDJSON direct `/v1/profiles/chat` est conservé; il ne garantit pas une progression visible depuis cette passerelle. Le frontend utilise les jobs lorsque `/v1/profiles/status` annonce `chatTransport: async`.

```text
Navigateur connecté → POST /v1/profiles/chat/jobs → réponse 202
                                  ↓ SQS durable + DLQ
                       profile-chat-worker → Bedrock/outils
                                  ↓ progression réelle
                       profile-chat-jobs (DynamoDB)
Navigateur connecté → GET /chat/jobs/{jobId}?accountId=…&after=…
```

La table utilise `job_id` comme clé et `expiresAt` comme TTL. Les identifiants de l’API restent nommés `jobId`. Le worker prend le job par écriture conditionnelle, ce qui évite une double exécution lors d’une livraison répétée. Les curseurs de lecture suivent des événements append-only; les fragments de texte en attente peuvent être regroupés avant publication.

| Réglage | Valeur / effet |
|---|---|
| `PROFILE_CHAT_JOBS_TABLE` | Table DynamoDB des événements et statuts. |
| `PROFILE_CHAT_QUEUE_URL` | File SQS qui active le transport asynchrone avec la table de jobs. |
| Worker | Python 3.12, 512 Mo, timeout 300 secondes; concurrence réservée et maximale SQS de deux. |
| File / DLQ | Visibilité 1 800 secondes, trois réceptions avant DLQ; alarmes sur messages DLQ et âge de file. |
| Délai applicatif du job | 900 secondes, puis état terminal explicite au polling. |
| Conservation | Expiration applicative après 3 600 secondes; suppression TTL DynamoDB différée. |
| Bornes | Requête 200 000 octets; journal environ 378 000 octets, avec erreur explicite si dépassement. |
| Recherche du worker | `RESEARCH_LAMBDA_FUNCTION=investoros-dev-api`, via IAM, sans transmettre le JWT navigateur. |

`POST /v1/profiles/chat/jobs/{jobId}/cancel?accountId=…` demande l’arrêt. Le worker vérifie l’état entre événements et opérations. Un appel AWS déjà engagé peut finir; l’arrêt n’annule pas les effets d’une opération accomplie. Les lectures et arrêts vérifient le persona fictif propriétaire. La table ne conserve ni JWT, ni mot de passe, ni corps de requête de lancement.

`profile-chat.tf` définit la table de jobs, la file et la DLQ SQS, le worker et son mapping SQS, ainsi que les rôles et alarmes. Le dispatch possède les opérations nécessaires sur la seule table et le droit `SendMessage` sur cette file. Le worker possède les opérations de table nécessaires, Bedrock et les accès bornés aux données et à l’entrée IAM de recherche. La Lambda API conserve sa concurrence réservée de douze; le worker et son mapping SQS sont limités à deux.

## Documents autorisés et garde-fous Bedrock

Les routes d’upload signent les dépôts vers le préfixe `documents/` du bucket Knowledge Base configuré par SSM. La notification S3 transmet les créations d’objets à SQS; un dispatcher attend le sidecar de métadonnées autorisées puis démarre une exécution Step Functions qui lance et suit l’ingestion Bedrock. Les échecs SQS vont en DLQ après dix réceptions. `POST /v1/knowledge/sync` reste disponible pour un lancement manuel. La route de récupération existe, mais le chat ne consomme pas encore ses passages comme contexte.

La stack déclare aussi un Bedrock Guardrail et son binding SSM. Les appels du chat et des agents spécialisés appliquent le garde-fou actif et échouent explicitement si sa configuration existe mais ne peut être chargée. L’onglet Admin **Garde-fous** permet de consulter et modifier la configuration active. Les paramètres d’exécution ne sont pas une preuve de déploiement : après une fusion, vérifier les exécutions GitHub Actions et les ressources AWS avant d’annoncer cette capacité comme active.

## Dictée vocale en direct

`POST /v1/profiles/voice/session` signe une URL WebSocket Amazon Transcribe en français canadien. Le navigateur envoie du PCM mono 16 kHz par blocs de 128 ms, assemble les segments AWS dans leur ordre temporel et détecte la fin de parole après 1,6 s de silence. Il envoie ensuite le bloc audio vide requis par Transcribe afin de recevoir la fin de la phrase avant de fermer le micro. La stabilisation partielle reste désactivée pour privilégier la précision.

La ressource `aws_transcribe_vocabulary.finance_fr_ca` contient des noms d’entreprises et des termes financiers fréquents. Elle est déclarée dans Terraform et déployée `READY` en `us-east-1`; l’import bloc la rattache au state au prochain plan. Le 15 novembre 2026, l’API vocale active a généré une URL incluant ce vocabulaire; le WebSocket AWS a accepté des blocs PCM puis le bloc de fin sans exception. Le test a validé le chemin AWS, pas la qualité d’une phrase prononcée par un utilisateur.

### Vocabulaire français canadien

Le vocabulaire AWS porte le nom `investoros-dev-assistant-simulation-finance-fr-ca` et utilise la langue `fr-CA`. La sélection recommandée comprend des sociétés et symboles boursiers (`NVIDIA`, `NVDA`, `TSMC`, `ASML`, `Micron`, `Broadcom`, `AMD`, `Intel`, `Samsung`, `Hynix`, `Nasdaq`, `AAPL`, `MSFT`, `GOOGL`, `AMZN`, `META`, `TSLA`, `AVGO`, `MU`, `QCOM`), des instruments (`ETF`, `FNB`, `actions`, `obligations`, `options`, `indice`, `bourse`, `cotation`, `spread`, `volume`, `cours`, `coupon`, `duration`), des indicateurs (`PER`, `PBR`, `BPA`, `ROE`, `ROIC`, `EBITDA`, `capitalisation`, `benefice`, `revenus`, `marge`, `consensus`, `guidance`, `analyste`), des notions de risque et portefeuille (`rendement`, `rendements`, `volatilite`, `volatilites`, `portefeuille`, `liquidite`, `allocation`, `diversification`, `risque`, `croissance`, `plus-value`, `moins-value`, `surperformance`, `sousperformance`) et des notions macroéconomiques ou sectorielles (`taux`, `inflation`, `recession`, `capital`, `materiaux`, `semiconducteurs`, `semi-conducteurs`, `dividende`).

Ces entrées aident Transcribe à reconnaître les noms de sociétés, les symboles boursiers et le vocabulaire financier propre à l’application. Elles ne garantissent pas la transcription exacte et ne remplacent pas le contexte de la phrase.

La console Admin contient l’onglet **Vocabulaire vocal** : il explique le rôle de la liste, affiche l’état AWS, permet de rechercher dans les termes, d’en ajouter ou retirer, puis d’enregistrer la liste complète. Les routes `GET/PUT /v1/admin/voice-vocabulary` réutilisent la session Cognito de l’application; API Gateway valide le JWT et le handler de la Lambda exige le groupe `administrators`. Aucun jeton Admin supplémentaire n’est demandé. API Gateway envoie `/v1/admin/*` à la Lambda `investoros-dev-api` via sa route générique `/{proxy+}`; les routes `/v1/profiles/*` et `/v1/simulation/*` vont à `investoros-dev-assistant-simulation`. La modification remplace la liste AWS entière; il faut donc envoyer la liste complète. La console autorise jusqu’à 256 entrées et attend que le vocabulaire ait fini son traitement avant un nouvel enregistrement.

Le bloc `aws_transcribe_vocabulary.finance_fr_ca` dans `main.tf` contient la sélection initiale, et `RECOMMENDED_FINANCE_VOCABULARY` dans `admin_console.py` alimente le bouton de restauration. La Lambda `investoros-dev-api` reçoit `VOICE_TRANSCRIBE_VOCABULARY_NAME` et les permissions `GetVocabulary`/`UpdateVocabulary`, limitées à l’ARN de ce vocabulaire. La Lambda `investoros-dev-assistant-simulation` conserve uniquement le droit de démarrer la transcription en direct. Terraform ignore les changements ultérieurs de `phrases` afin de préserver les termes gérés depuis l’Admin; le bloc Terraform reste la sélection de départ si la ressource doit être recréée. `POST /v1/profiles/voice/session` lit le nom du vocabulaire depuis son environnement d’exécution et signe l’URL WebSocket avec le paramètre AWS `vocabulary-name`. Le vocabulaire doit rester en `us-east-1` et en `fr-CA`, comme le flux Transcribe. Les changements faits dans l’Admin s’appliquent après que le statut AWS retourne à `READY`.

À la vérification du 15 novembre 2026, le vocabulaire AWS était `READY` avec la première sélection de 20 entrées (`NVIDIA`, `NVDA`, `TSMC`, `ASML`, `Micron`, `Broadcom`, `AMD`, `Intel`, `Samsung`, `Hynix`, `Nasdaq`, `ETF`, `FNB`, `PER`, `dividende`, `capitalisation`, `rendement`, `volatilite`, `portefeuille`, `semiconducteurs`). La sélection recommandée élargie à 68 termes est disponible dans le code et Terraform. Le backend Admin est déployé sur `investoros-dev-api`; son endpoint a répondu `200` en réutilisant la session administrateur Cognito et a lu les 20 termes directement depuis Transcribe. Pour activer les 68 termes, choisir **Restaurer la sélection recommandée** puis **Enregistrer dans AWS** dans l’onglet Admin; l’enregistrement remplace la liste AWS et lance son traitement. L’import Terraform déclaré plus haut l’attachera au state lors du prochain plan; cette étape d’import n’est pas encore attestée comme terminée. Le test du flux vocal a confirmé la transmission du nom du vocabulaire, sans mesurer la précision sur une voix humaine.

La mémoire durable du profil est distincte des jobs temporaires : `SOURCE_WORKSPACE_TABLE` ou `PROFILE_WORKSPACE_TABLE` désigne la table de comptes. Seul l’attribut `profile_workspace` est modifié par l’adaptateur de mémoire, avec révision optimiste et contrôle des clés via `DEMO_CONTEXTS`.

## Historique de conversation — déploiement vérifié

Le 15 novembre 2026, l’essai connecté d’Alignement a révélé une erreur `500` sur `/v1/profiles/conversations/robert` : la variable `PROFILE_CONVERSATIONS_TABLE` était absente et le repli SQLite tentait d’écrire dans le système de fichiers Lambda en lecture seule.

Les ressources déjà déclarées `aws_dynamodb_table.profile_conversations` et `aws_iam_role_policy.profile_conversations` ont été appliquées depuis le plan Terraform ciblé : **2 créations, aucun changement et aucune destruction dans ce plan**. La table `investoros-dev-profile-chat-conversations` et son index `account-last-used` sont `ACTIVE`, avec chiffrement, protection contre la suppression et restauration à un instant donné. Les droits du rôle existant sont limités à cette table et à ses index. Ces ressources sont enregistrées dans le state S3 de cette stack.

La variable `PROFILE_CONVERSATIONS_TABLE` de `investoros-dev-assistant-simulation` a ensuite été configurée en préservant les autres variables; sa mise à jour est `Successful`. La route publique authentifiée a répondu `200` et le parcours réel Cognito → mémoire/historique → Bedrock → carte Alignement a réussi. Cette intervention ne constitue pas un apply global des autres ressources encore déclarées dans la stack.

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

L’archive API doit être cohérente entre Assistant/Simulation et worker pour que contrats, outils et skills correspondent. Terraform l’envoie dans le bucket privé `investoros-<environment>-<account>-lambda-artifacts-<region>` sous une clé adressée par contenu; les fonctions déploient le même objet S3, ce qui supporte les archives dépassant la limite d’envoi direct Lambda. Le chiffrement S3 AES-256 est activé. Lors d’une rotation du paquet, Terraform supprime l’ancienne clé suivie par son state; l’objet courant reste adressé par son contenu. Un déploiement du frontend seul ne met pas à jour ces fonctions. Vérifier le statut de mise à jour des fonctions avant l’essai connecté.

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
- Les conversations sont synchronisées dans la table DynamoDB dédiée, par compte de démonstration; profil et documents de Profil utilisent leur mémoire serveur distincte. Les jobs expirent et ne remplacent pas cet historique.
- L’univers historique est fini et n’est pas un flux de marché en direct. Les scénarios sont conditionnels; aucun conseil financier personnalisé ni transaction n’est fourni.
- Le modèle par défaut est `us.anthropic.claude-sonnet-4-6`; quotas, concurrence disponible et coûts dépendent du compte AWS.
- X Recent Search reste désactivé; aucun secret X n’est lu.
- Inscriptions Cognito et récupération autonome du mot de passe restent désactivées. Ne pas modifier le pool ou les comptes pour un smoke test.

## Veille des titres et dossiers

`portfolio-monitor.tf` configure une fonction déclenchée toutes les six heures par EventBridge Scheduler. Elle examine les tickers explicitement présents sur les positions ou ajoutés depuis la page Portefeuille; les catégories fictives ne sont jamais converties en symboles par inférence. Les titres ajoutés sont limités à l’univers Simulation.

La fonction utilise GDELT pour découvrir des articles, relit la page HTTPS sans suivre les redirections et demande à Bedrock de filtrer les événements matériels récents avec un extrait littéral. Les dossiers persistés dans DynamoDB apparaissent dans les notifications du Dashboard avec résumé, source, extrait et prochaine action de vérification humaine. Les entrées sont idempotentes. Les sources restent secondaires et doivent être vérifiées; aucune action sur le portefeuille n’est exécutée.

Les notifications sont affichées dans l’application uniquement. Cette configuration Terraform est présente dans le dépôt; le calendrier ne devient actif dans AWS qu’après examen puis application du plan de cette stack. Un merge ne déploie pas la fonction ni l’API.

Depuis le Dashboard, **Actualiser** met en file un scan asynchrone du persona actif, répond immédiatement avec l’état `pending`, puis passe à `running`, `completed` ou `failed`. Le navigateur interroge le dossier de scan et recharge les notifications lorsque le worker a terminé. Les états sont conservés un jour dans DynamoDB; aucun appel Bedrock ou réseau long ne bloque la passerelle HTTP.
