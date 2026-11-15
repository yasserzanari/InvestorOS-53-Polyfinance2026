# Profiles : architecture et extension

## Démarrage local

Depuis la racine du dépôt, lancer `bash scripts/dev-profile-api.sh`, puis le serveur Vite habituel (`npm run dev`). L’API écoute sur `127.0.0.1:8010`; le navigateur utilise le proxy dédié `/profile-api` de Vite. Le proxy `/api` existant reste réservé à l’API AWS du reste du produit. Le script installe les dépendances Python manquantes dans `.venv/profile-api`, ignoré par Git. `PROFILE_API_PYTHON` permet de réutiliser un interpréteur préparé.

Le modèle local par défaut est `amazon.nova-pro-v1:0`, région `us-east-1`. Surcharger `BEDROCK_MODEL_ID`, `AWS_REGION` et éventuellement `PROFILE_API_PORT` dans l’environnement du processus. Aucun identifiant AWS n’est envoyé au navigateur. Boto3 utilise sa chaîne habituelle de credentials et les rôles IAM disponibles sur l’hôte.

## Responsabilités

- `ProfilesPage.tsx` compose la conversation et les onglets du compte actif dans le shell commun.
- `profile-model.ts` décrit les champs et les exemples fictifs de départ.
- `profile-api.ts` est l’adaptateur de transport NDJSON et les types d’événements côté navigateur. Il utilise `/profile-api` en développement et `VITE_API_BASE_URL` dans le build.
- `useProfileWorkspace.ts` porte l’état de conversation et les mises à jour par événement. L’historique est migré depuis le navigateur puis synchronisé via `/v1/profiles/conversations/{persona}`; le serveur résout la persona vers le compte DynamoDB. Les messages ne sont plus conservés dans le stockage navigateur.
- `components/` contient les composants de chat réutilisables et les sources UI archivées. Les exemples de démonstration des composants ne sont pas des données de production.
- `apps/api/src/investoros_api/profiles/models.py` valide requêtes, champs et onglets.
- `tools.py` expose les outils autorisés au modèle; `sources.py` contient les notes réellement consultables.
- Le routeur et le service Bedrock gèrent l’appel au modèle et publient les événements. Modifier le prompt et les outils côté API, pas dans le rendu React.

## Assistant partagé

L’entrée **Assistant** du menu latéral ouvre `/app/assistant`. Cette route et
`/app/profiles` utilisent le composant de chat réutilisable
`features/assistant/AssistantChatPanel.tsx`, le même workspace et le même transport Bedrock, les
mêmes cartes de questions, activités, citations, tâches et onglets. Les messages,
le profil et les onglets sont conservés par compte dans
`investoros.workspace.v2.<accountId>`; l’onglet sélectionné est conservé à part
pour que la navigation entre les deux routes garde le même contexte.

Le compositeur du tableau de bord transmet aussi sa demande initiale à l’Assistant
partagé. Ainsi, il n’existe qu’un historique de conversation et un seul chemin
d’exécution pour les demandes qui commencent sur le tableau de bord ou dans
l’espace de profil. Le contexte Bedrock inclut le catalogue des modules; pour une
demande qui traverse plusieurs espaces, il peut construire un onglet Tâches avec
des liens directs. Les opérations réelles restent bornées aux outils serveur
disponibles; il ne doit pas annoncer comme faites les actions qu’aucun outil ne
prend en charge.

## Contrat HTTP

`POST /v1/profiles/chat` reçoit `{message, history, profile, tabs, accountId}`. `history` contient `{role, content}`, avec `role` limité à `user` ou `assistant`. Les comptes acceptés sont les personas fictifs Amira, Mateo et Robert. Les champs de profil autorisés sont `objective`, `horizon`, `riskTolerance`, `lossCapacity`, `liquidity`, `constraints`, `preferences`, `knowledge`.

La réponse est du NDJSON : chaque ligne JSON complète possède un `type`. Le lecteur doit conserver le fragment incomplet entre deux blocs réseau et traiter l’erreur même après un HTTP 200 (la réponse peut avoir déjà commencé).

| Événement | Contenu et usage |
| --- | --- |
| `status` | `label` : étape de travail courante |
| `text` | `delta` : texte de réponse à ajouter |
| `tool` | `id`, `name`, `status`, `input`, `output`/`error` : appel réel et résultat |
| `agent` | `id`, `name`, `status`, `task`, `summary`, `startedAt`, `durationMs` : invocation spécialiste réelle |
| `workspace` | `profile`, `tabs` : état validé à appliquer au compte courant |
| `sources` | `citations` : documents effectivement lus et liens ouvrables |
| `followups` | `prompts` : questions envoyables par clic |
| `done` | `modelId`, `usage` : fin normale du tour |
| `error` | `message`, `code` : échec explicite, sans réponse simulée |

`GET /v1/profiles/status` indique la configuration serveur; une configuration présente ne garantit pas l’autorisation d’invoquer un modèle. Un vrai tour réussi constitue la vérification de cette autorisation. `GET /v1/profiles/sources/{id}` rend les notes du catalogue, pas des résultats d’une recherche web.

## Onglets et outils

Un onglet possède `{id,title,kind,content,items}`. Les rendus acceptés sont `profile`, `note`, `tasks`, `agents`, `sources`, `simulation`. Un onglet `simulation` conserve le JSON d’un résultat validé de `project_market_scenarios`; son rendu affiche les quantiles, branches, hypothèses explicites, provenance et limites. Il est créé ou actualisé automatiquement par ticker à la fin de l’outil. Le JSON reste sous la limite de contenu de l’API et est associé au compte fictif courant dans le navigateur. Un élément de liste possède `{id,title,status,url?}`. Les états de tâche sont `pending`, `active`, `done`, `failed`, `skipped`.

`upsert_tab` crée ou remplace un onglet en réutilisant son id. `update_profile` ne met à jour que les faits explicitement fournis; la confirmation du profil appartient à l’utilisateur. `run_specialist` lance un appel Bedrock distinct et borné. `read_sources` lit exclusivement le catalogue autorisé. `suggest_followups` publie les questions suivantes. `inspect_simulation_history` lit les prix ajustés et événements depuis le même jeu de Simulation que le module; son résultat comprend les observations, leur méthode, un lien vers le ticker dans Simulation et un lien fournisseur Yahoo Finance. Ce dernier est une référence consultable, pas une archive immuable de l’extraction. `project_market_scenarios` réutilise le moteur de quantiles Simulation et exige deux à quatre branches avec des chocs fournis explicitement par l’utilisateur. Aucun événement ou article ne devient automatiquement un choc. Les paramètres du modèle sont validés comme toute autre entrée externe.

Pour ajouter un rendu, étendre l’union de `kind`, le schéma API et le registre frontend ensemble. Pour ajouter un outil, définir son schéma dans `tools.py`, son exécuteur dans le service, et l’événement visible correspondant. Conserver une limite de tours et d’appels spécialistes pour borner coût et latence.

## Données, activités et limites

Les personas sont fictifs. Les conversations et onglets de travail sont stockés côté serveur sous la clé du compte de démonstration résolue par l’API. L’API n’accepte que les personas configurées et isole chaque historique par compte; ce stockage ne constitue pas une gestion de comptes clients réels.

Les traces visibles montrent les opérations effectivement exécutées, leurs entrées, sorties et temps. Elles ne révèlent pas une chaîne de pensée interne et ne simulent pas d’étapes avec un minuteur. Un spécialiste est un autre appel de modèle, sans session navigateur. Un aperçu navigateur ne peut apparaître qu’après intégration d’un véritable outil de navigation qui fournit une capture validée; aucune fausse capture ou animation de site n’est utilisée comme preuve.

La dictée dépend des capacités et permissions du navigateur; HTTP sur une adresse LAN peut empêcher l’accès au microphone. Le texte dicté doit rester modifiable avant envoi. Copier dépend du presse-papiers ou d’un mécanisme de repli; régénérer relance réellement l’API. Le feedback local ne constitue pas un entraînement du modèle.

## Vérifications réalisées le 14 novembre 2026

Le serveur local a été démarré avec le script fourni et un environnement Python isolé. Deux tours réels avec `amazon.nova-pro-v1:0` en `us-east-1` ont été vérifiés : conversation simple, puis demande d’enregistrement de l’objectif et de l’horizon, création d’une note, consultation d’un spécialiste, lecture de la méthode et suggestions suivantes. Le second tour a produit 216 événements, une fin `done`, aucune erreur et un spécialiste terminé en 1,5 seconde. Les entrées/sorties totalisaient 7 018/687 tokens sur ce tour. Les balises de raisonnement Nova ont été filtrées. Les sources du catalogue répondent en texte lisible. Cette vérification porte sur l’API locale et de vrais appels AWS; elle ne prouve pas un déploiement public ou une sauvegarde DynamoDB du module.

## Déploiement

Le lanceur local n’effectue aucun déploiement AWS. L’environnement d’hébergement doit fournir le modèle, la région, des permissions `bedrock:InvokeModel`/`bedrock:InvokeModelWithResponseStream` limitées aux modèles utilisés, et un transport qui conserve le flux NDJSON. Ajouter authentification, autorisation par compte, quotas et stockage serveur avant d’exposer des profils réels ou un endpoint public. Le wrapper Lambda/API Gateway existant doit être vérifié séparément pour le streaming.

## Composants retenus

Les composants exacts component library `Subagent` (45574), `ResearchProgress` (45508),
`ThinkingPill` (42983) sont intégrés dans les rendus des événements réels.
`ToolBrowser` (45524) est conservé pour une future connexion à un navigateur :
il ne reçoit aucune capture fictive. Les vues actuelles montrent les vraies entrées
et sorties des outils et les résultats des spécialistes Bedrock. Le composant
`MessageActions` vient de l’archive FrontUI; les wrappers du compositeur, des
citations et de la minimap adaptent les exemples fournis aux données du produit.
Le micro utilise la dictée du navigateur : un contexte HTTPS (ou localhost) et
les permissions sont nécessaires. Sur l’adresse HTTP du réseau, le texte reste utilisable.
Les likes/dislikes sont conservés localement; ils ne réentraînent aucun modèle.

## Limites actuelles

Ce module local utilise le SDK AWS côté serveur et aucun secret dans le navigateur.
Le serveur écoute sur 127.0.0.1:8010, Vite relaie `/profile-api` et reste sur 0.0.0.0.
Il n’y a pas de recherche web ni de navigateur d’agent : les sources sont les notes
produit effectivement lues par `read_sources`. Pour ajouter un navigateur, créer un
outil serveur isolé, émettre ses vraies actions/captures validées puis passer ces
événements à `ToolBrowser`. Les réponses sont en streaming réseau, sans minuterie
de simulation. Le streaming de production via API Gateway/Mangum demande une
validation spécifique et un transport adapté avant publication.

Dans l’onglet Agents, `ToolBrowser` sert également de cadre agrandissable au
**contenu réel de la consultation** (prop ReactNode `screenshot`, titre explicitement
« Aperçu du résultat »). Ce cadre ne représente pas une capture navigateur et
n’affiche aucune action de navigation inventée. La vraie sortie textuelle Bedrock
est identique dans l’aperçu et dans le résultat du spécialiste.

## Fiche et contrôles de cohérence

`ProfileInspector.tsx` rend les huit champs en trois groupes, avec icônes,
édition directe et défilement dans l’inspecteur. Le titre de la route vit dans
la navbar partagée; aucune seconde barre de titre ne réduit l’espace utile.
`profile-consistency.ts` est une fonction pure, exécutée à chaque édition ou
mise à jour reçue de Bedrock. Elle relève les réponses incomplètes et trois
combinaisons explicites à clarifier : horizon court avec forte tolérance,
retraits proches avec horizon long, forte tolérance avec conséquences graves
explicitement déclarées. Les alertes citent les champs concernés et permettent
de les ouvrir ou de demander une clarification à l’assistant. Elles n’affirment
pas qu’un profil est adapté ni exempt de toute contradiction. La fonction ne
fait aucun appel AWS et reste testable indépendamment de la vue. Ajouter une
règle ici, son cas de négation et un test dans `profile-consistency.test.mjs`.

## Questions interactives (`ask_user`)

L’assistant choisit le format selon le besoin : `single_choice`, `multiple_choice`
ou `text`, avec une option de réponse libre lorsqu’elle est pertinente. Il émet
`questions.request` avec un identifiant unique et une à trois questions. Le tour
se termine avec `done.awaitingUser=true` : aucune réponse de l’utilisateur n’est
simulée et aucun choix n’est présélectionné.

Le contrat TypeScript se trouve dans `question-model.ts`; le schéma Python dans
`profiles/models.py`. `AskUserCard.tsx` affiche les questions, la navigation
numérotée, les erreurs et le résumé après validation. Le brouillon est conservé
localement par identifiant de demande. Fermer la carte la réduit sans effacer les
réponses. Les étapes restent consultables et les champs requis sont vérifiés à
l’envoi final. Les questions attendues et le résumé envoyé sont conservés dans
l’historique du compte fictif.

`useProfileWorkspace.answerQuestions` envoie `questionRequest` et `questionAnswer`
ensemble au même endpoint de chat. L’API vérifie la correspondance de demande,
les identifiants, les choix autorisés, leur cardinalité et les champs obligatoires.
Les réponses structurées alimentent le contexte utilisateur de Bedrock au tour
suivant. La carte n’affiche « Réponses envoyées » qu’une fois ce tour terminé;
si le réseau échoue, le brouillon reste disponible pour réessayer.

Un message libre peut reprendre la conversation sans remplir la carte; les cartes
précédentes non répondues deviennent alors inactives. Les anciens messages de
questionnaire rédigés avant cette évolution restent du texte dans l’historique.

## Onglet Agents

L’onglet Agents agrège les événements `agent` émis par les appels réels à
`run_specialist`. Il affiche le coordinateur, la mission confiée, l’état,
la durée et le résumé effectivement transmis. Il n’affiche pas les outils,
leurs entrées/sorties ni d’aperçu navigateur. Un état vide précise qu’aucun
spécialiste n’a encore été appelé.

Assistant et Profils partagent les messages, les onglets, le profil et le
transport Bedrock par compte. Seul l’onglet sélectionné est mémorisé par espace
de navigation : Assistant ouvre les Tâches par défaut et Profils ouvre la fiche.

### Position des questions en attente

La dernière demande `ask_user` non répondue est affichée dans `pw-question-dock`,
fixé au-dessus du compositeur dans le même conteneur. Elle ne figure plus comme
formulaire actif dans la liste des messages. La carte et la barre de saisie ont
la même largeur, des bordures jointives et les couleurs bleues du produit. La
hauteur du dock est bornée; les longues questions défilent dans leur propre zone,
et les commandes restent visibles. Après envoi validé, le résumé rejoint
l’historique et la nouvelle question éventuelle prend sa place dans le dock.
