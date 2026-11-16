# Espace Profile interactif

## Nouvelle fiche investisseur (local, 15 novembre 2026)

Le panneau Profil présente maintenant exactement six onglets : **Aperçu, Objectifs, Situation, Risque, Préférences et Mémoire**. Les anciens onglets Comparer, Scénarios et Preuves ne sont plus dans la fiche; ils restent des capacités d’analyse accessibles par leurs espaces/outils distincts. L’onglet Objectifs propose une chronologie à jalons calculés depuis l’horizon de chaque projet. Les repères sont explicitement marqués comme exemples de démonstration et ne sont ni des échéances déclarées ni des prévisions.

Les trois personas ont des objectifs fictifs spécifiques. La mémoire contient aussi des plages financières synthétiques étiquetées comme exemples; la validation du schéma de mémoire les sépare des huit réponses envoyées au modèle. Les exemples se synchronisent via la mémoire existante DynamoDB/SQLite sous les clés de démonstration déjà configurées. Aucun profil de client réel n’est introduit. La situation financière affiche en clair **facultatif** et peut être passée. La formulation juridique précise que les renseignements requis dépendent de l’activité réglementée; le prototype ne prétend pas réaliser une évaluation de convenance.

Les compteurs de complétude couvrent les huit déclarations du profil et n’incluent pas la situation facultative. La fiche n’affiche pas la date de mise à jour ni la version interne. Cette implémentation est locale sur `codex/profile-investor-tabs`; elle n’est pas encore publiée sur AWS.

## Alignement modifiable et explications sourcées

Assistant et Profils partagent maintenant la vue structurée `components/decision-panels/InsightPanel.tsx`. Chaque réponse du profil peut être modifiée sur place ou précisée dans le chat. Les explications au survol/clic/clavier montrent les déclarations exactes et les fondements AMF/OCRI. Le rouge est réservé à une incompatibilité explicitement reconnue d’échéances pour la totalité du même capital; la différence tolérance/capacité reste une clarification en ambre. La méthode, ses limites lexicales et les sources sont dans `profile-consistency.md`. Aucun seuil automatique de trois/huit ans ne suffit à qualifier une incohérence.

Une modification conserve l’ancien snapshot et replie la synthèse périmée jusqu’à actualisation. La restauration d’historique préserve les déclarations déjà chargées par la mémoire du profil. Vérification déterministe via `scripts/test-assistant-decision-panels.cjs` (aussi appelé par `scripts/test-profile-alignment-workbench.cjs`) : mémoire et conversations interceptées, sans mutation de compte. Les relevés historiques plus bas décrivent leurs versions antérieures, pas les sélecteurs actuels.

## Périmètre et parcours

La route `/app/profiles` conserve le chat à gauche et six vues à droite : Profil, Alignement, Comparer, Scénarios, Preuves et Mémoire. Documents apparaît lorsqu’une note, une tâche ou un résultat de recherche est créé. Le panneau se redimensionne et s’agrandit; la mise en page garde le cadre dans la fenêtre, avec défilement interne pour les contenus longs. Sur petit écran, Conversation et Profil et analyses alternent dans le même espace.

- **Profil** : huit rubriques en quatre pages courtes. Les modifications conservent origine, date et version, et retirent la confirmation. Seule la personne confirme ses réponses; cette confirmation ne certifie pas la convenance d’un investissement.
- **Alignement** : le constat de l’IA est distinct des règles de champs et des inconnues. Chaque piste reprend la discussion; les champs concernés sont accessibles directement. Une modification du profil rend la carte périmée et désactive ses anciennes pistes jusqu’à actualisation. Les règles reconnaissent les horizons en mois, dont 18 mois, en tenant compte des négations.
- **Comparer** : `POST /v1/profiles/compare` calcule rendement ajusté, repli maximal et écart-type échantillonnal non annualisé sur les mêmes dates communes et la même devise. La courbe est en base 100; seul l’affichage est échantillonné. Méthode, période, limites et SHA-256 des entrées restent dans le document. Des devises différentes sont refusées sans conversion implicite.
- **Scénarios** : Synthèse, Paramètres et Méthode séparent résultat et hypothèses. Modifier un paramètre rend les anciens résultats indisponibles jusqu’au recalcul ou au rétablissement. Chaque document possède son propre brouillon; changer de scénario ne réutilise pas les paramètres du précédent. La navigation IA peut cibler un `documentId`; sinon le dernier scénario est sélectionné. Le recalcul est mémorisé. Les centiles sont conditionnels, sans probabilité future annoncée.
- **Preuves** : les références reçues sont conservées par identifiant, y compris lorsque deux preuves partagent une URL. Le filtre « Liées au constat » utilise les `evidenceIds` de la carte. Une référence ouverte ne prouve pas que toute son information a été validée.
- **Mémoire** : état de synchronisation, version, confirmation, provenance des huit rubriques, rechargement et export du contexte.

Dans Assistant, l’action **Notes** ajoute un onglet de conversation à droite. Les notes Markdown s’ouvrent en lecture confortable avec aperçu, estimation du temps de lecture, copie et téléchargement; le mode Modifier garde le texte éditable. Les notes et l’historique de conversation sont synchronisés avec le compte actif. Dans Profil, les notes restent dans la mémoire de démonstration synchronisée par l’API.

## Outils et skills

### Dictée vocale en direct

Le mode vocal Profile utilise Amazon Transcribe Streaming en français canadien : l’API Profile signe une URL WebSocket temporaire (60 secondes), le navigateur envoie l’audio microphone en PCM 16 kHz et affiche les segments provisoires puis finalisés dans le champ de saisie. La permission du microphone reste gérée par le navigateur; l’audio n’est pas archivé par l’application. L’orbe visualise le niveau audio local, sans analyse ni stockage biométrique. Cette fonction est distincte de la génération audio des réponses de l’assistant, qui n’est pas incluse.

État après la PR #75 (15 novembre 2026) : code présent et fusionné; permission IAM `transcribe:StartStreamTranscriptionWebSocket` appliquée au rôle API dev; API `investoros-dev-assistant-simulation` mise à jour (SHA-256 Lambda `KBVBLlBp5+ZO4Fm4IcSyxvZs6tGCT4g34EWxyTbaemY=`); frontend déployé sur CloudFront. Une invocation de l’endpoint a confirmé la création d’une URL signée vers `transcribestreaming.us-east-1.amazonaws.com:8443`. L’essai réel microphone → WebSocket → texte dans un navigateur reste à confirmer; le contrôle d’émission de l’URL n’est pas une preuve de transcription de bout en bout.

`compare_profile_instruments` calcule et conserve la comparaison. `publish_profile_insight` valide la carte et refuse les références de preuve non reçues. Le résumé doit contenir un constat; une clarification exige une question ciblée, une tension ou une analyse partielle exige une piste ou une question. Le serveur joint les expositions effectivement lues à `portfolioBasis`, indépendamment du texte généré, et Alignement affiche les poids. Une carte refusée reçoit une consigne de reformulation ciblée; après trois essais invalides le tour termine avec une erreur explicite. Les brouillons des tours d’outils sont tamponnés; seul le texte final est publié dans le chat. S’il est vide après une carte ou un calcul réussi, le serveur reprend le résumé de la carte ou confirme l’action effectivement terminée, sans nouveau chiffre. Une demande limitée à une note ne peut pas rejouer un ancien scénario. `open_profile_view` ouvre une vue et peut cibler un document existant; un identifiant inconnu est refusé. Les événements de navigation restent distincts, même après une navigation manuelle. En mode Profile, `upsert_tab` ouvre la note créée ou modifiée.

`close_profile_document` ferme uniquement le document demandé. Une demande explicite nommant exactement un document est routée vers cet outil; profil et autres documents sont conservés. Les identifiants réservés aux comparaisons et aux cartes ne peuvent pas être écrasés par une note arbitraire. `update_profile`, `ask_user` et les outils historiques/scénarios complètent le parcours. Une demande explicite de calcul ou de création de scénarios lit les capacités disponibles et ne peut être présentée comme terminée sans résultat calculé.

`publish_plan` permet au modèle d’écrire un plan structuré dans la conversation : titre, contexte facultatif et trois à six étapes, chacune avec un titre et un détail facultatif. L’API valide puis émet l’événement de plan que la carte rend directement; le texte équivalent reste dans l’historique afin que la confirmation et les tours suivants gardent le contexte. Cette publication n’exécute aucune étape. Une recherche importante attend ensuite `ask_user` et une validation explicite. `upsert_tab` avec `kind: tasks` sert à conserver une liste de tâches dans Documents; c’est distinct de la carte de plan. État de cette modification : implémenté dans le frontend et l’API; le déploiement de chaque couche doit être vérifié séparément.

Pour une demande strictement historique, le runtime charge `profile-workspace` et limite les outils aux données, calculs et vues nécessaires : ce tour ne modifie pas le profil et ne publie pas une carte d’adéquation. Le résultat ouvre Comparer. Ses symboles et sa période sont restaurés dans les contrôles, sans écraser une saisie en cours.

Le mode `workspaceMode: profiles` charge réellement `investor-profile` et `profile-investment-alignment` dans le contexte Bedrock, avec attribution `runtime-bootstrap`. `profile-workspace` décrit les vues et commandes. Les sources versionnées `agent-skills/` et le snapshot API sont synchronisés par `scripts/sync-agent-skills.py` : **19 skills, version 1.8.18**, avec contenu et SHA-256 concordants au relevé du 15 novembre 2026. `/v1/profiles/status` et les événements `load_skill` permettent de vérifier la version exécutée.

## Déclaration connue et information manquante

`profile_declarations` indique la disponibilité du texte pour les huit champs, sans certifier sa vérité financière. « Je ne peux pas absorber une perte compromettant ce projet » est une contrainte qualitative connue; le montant exact peut rester inconnu. Le validateur refuse les formulations observées qui nient cette déclaration dans une carte ou le texte final. Ce contrôle ciblé ne remplace pas une validation sémantique exhaustive. Une réponse finale contradictoire peut être corrigée deux fois avant une erreur explicite; elle n’est pas publiée telle quelle.

Exemple de discussion : « Mon portefeuille correspond-il à mon objectif de préservation pour un projet essentiel à 18 mois ? Lis le portefeuille fictif puis publie constats, pistes et inconnues dans Alignement. » La vue doit montrer les poids réellement retournés, relier le besoin de fonds à l’échéance et distinguer tolérance émotionnelle, capacité qualitative et montant non chiffré. L’ancienne sortie observée déclarait à tort la capacité inconnue et masquait les poids dans une réponse générique; les régressions portent sur ces erreurs. Les catégories seules ne permettent pas de mesurer le risque historique ni de conclure que le capital est garanti.

## Mémoire et protection du contexte

`useProfileMemory.ts` restaure la mémoire serveur avant d’autoriser les éditions, les envois, les réponses aux questions et les calculs mutables. La mémoire serveur est la référence au chargement; un ancien onglet ne doit pas écraser un document récent. Profil, documents et jusqu’à 80 références sont synchronisés après modification. Les lectures mémoire/statut/jobs retentent au maximum trois fois les erreurs réseau, 429 et certaines erreurs serveur, avec attente annulable; les écritures et créations de jobs ne sont pas rejouées automatiquement.

`GET/PUT /v1/profiles/memory/{amira|mateo|robert}` utilise une révision optimiste. Un conflit `409` bloque l’écrasement et demande un rechargement. Un échec n’est jamais affiché comme une sauvegarde réussie. Dans Assistant, une modification de profil produit une sauvegarde sans remplacer les documents et sources partagés.

| Configuration | Stockage |
|---|---|
| Sans table AWS | SQLite dans `~/.local/share/investoros/profile-memory.sqlite3`, configurable avec `PROFILE_MEMORY_DB`. |
| `PROFILE_WORKSPACE_TABLE` ou `SOURCE_WORKSPACE_TABLE` | Attribut `profile_workspace` de la table de comptes DynamoDB; clés autorisées par le mapping serveur `DEMO_CONTEXTS`. Permissions `GetItem` et `UpdateItem`. |

Les conversations sont synchronisées côté serveur et isolées par compte de démonstration. Après migration initiale, elles se rouvrent depuis un autre navigateur connecté au même compte. Cette mémoire de démonstration n’est pas un système de comptes clients réels.

## Transport AWS des réponses

La passerelle HTTP API tamponne les réponses Lambda et impose un délai d’environ 29 secondes. Le frontend choisit le transport annoncé par `/v1/profiles/status` :

- `stream` : NDJSON direct, conservé pour le développement local et les serveurs sans jobs configurés.
- `async` : `POST /v1/profiles/chat/jobs` renvoie `202`, puis le navigateur lit `GET /v1/profiles/chat/jobs/{jobId}?accountId=…&after=…` toutes les 800 ms. Les événements d’outils, de texte et de navigation sont ceux du worker Bedrock; le curseur évite de les rejouer.

`PROFILE_CHAT_JOBS_TABLE` et `PROFILE_CHAT_QUEUE_URL` activent le mode asynchrone. Les jobs ont une expiration applicative d’une heure, un délai terminal de 900 secondes et une TTL DynamoDB `expiresAt`. SQS fournit une livraison durable, trois tentatives de traitement puis une DLQ; le worker Lambda est limité à 300 secondes et sa concurrence à deux. La requête est bornée à 200 000 octets et les événements à environ 378 000 octets; un dépassement termine avec une erreur explicite et conserve la progression déjà publiée.

L’arrêt demande `POST /v1/profiles/chat/jobs/{jobId}/cancel?accountId=…`. Le worker vérifie l’état entre ses événements et opérations; un appel AWS déjà engagé peut finir. L’arrêt ne promet aucun retour arrière d’une opération exécutée. Aucun JWT ni mot de passe n’est stocké dans la table de jobs; les outils de recherche du worker passent par l’entrée IAM configurée.

## État vérifié le 15 novembre 2026

Le worker Profile utilise `us.anthropic.claude-sonnet-4-6`, sélectionné après comparaison réelle avec Nova Lite et Nova Pro sur les défauts de sorties observés. Ce choix est propre à cette stack; il ne valide pas automatiquement la justesse de toutes les futures réponses.

Le frontend Profile est publié sur `https://d10hypspu2l2nc.cloudfront.net/app/profiles`, derrière Cognito. L’API Assistant/Simulation et le worker de chat sont déployés. La lecture des groupes Cognito sérialisés a été corrigée et la méthode CORS `PUT` autorisée pour sauvegarder la mémoire.

| Preuve | Portée observée |
|---|---|
| Tests API : 257; cohérence : 12 | Contrats, calculs, outils, mémoire, orchestration, jobs et règles de profil. |
| `test-profile-workbench-state.cjs` | Avec interceptions explicites : brouillons de scénarios isolés, preuves de même URL préservées, opérations bloquées pendant la restauration, expositions rendues et paramètres de comparaison restaurés sans perdre la saisie. |
| `test-profile-async-chat.cjs` | Avec interceptions explicites : progression, curseurs, navigation et arrêt du chat asynchrone; ne prouve pas un appel AWS. |
| `test-profile-deployed-api.cjs` | Vrai compte Cognito : routes protégées `200`, sans JWT `401`, sauvegarde DynamoDB `200`, conflit `409`, job `202` puis résultat réel et navigation. |
| `PROFILE_DEPLOYED_MODE=1 test-profile-aws-live.cjs`, 16:33 UTC | Chrome sur le site public, sans interception : huit rubriques Robert, carte d’alignement, confirmation humaine, comparaison AAPL/MSFT, scénario AAPL 20 puis 30 séances, création/fermeture ciblée d’une note, restauration DynamoDB dans un navigateur neuf et carte du portefeuille fictif dont les poids correspondent exactement à la lecture serveur. La note ne relance aucun scénario; les 30 séances sont conservées après restauration. Les traces chargent les skills 1.8.18; aucune erreur de page relevée. |

Les preuves locales ignorées par Git sont dans `docs/prep/profile-workbench-evidence/aws-renewed/`, notamment `deployed-ui/summary.json` et `deployed-ui/phases.json`. L’essai public valide ce parcours et ses formulations; il ne certifie pas tous les autres modules InvestorOS ni toutes les demandes futures. La réévaluation de l’alignement a été vérifiée sur le site : la nouvelle carte distingue les deux dimensions du risque, respecte le besoin à 18 mois et ne reprend plus la difficulté de financement inférée auparavant. Pour ce nouveau constat, le texte de l’ancienne interprétation est écarté des entrées du modèle; le document reste dans la mémoire jusqu’à sa mise à jour.

TypeScript et le build isolé utilisé pour le déploiement ont réussi, avec authentification activée. Le bundle principal conserve un avertissement de taille d’environ 1,18 Mo. Certains lancements directs ont terminé avec le code 139, de cause non établie. Les reconstructions depuis le checkout, avec `npm run build --workspace @investoros/web -- --outDir /tmp/<dossier-unique>/dist --emptyOutDir` et la configuration AWS publique, ont ensuite réussi. Le hash du frontend servi correspond au dernier artefact. Journaux et commande exacte : `aws-renewed/final-build.json` et `final-build.log`.

Le contrôle Chrome public à 1440×950 et 1440×800 couvre les six vues : aucun débordement vertical ou horizontal de la page, footer visible et agrandissement fonctionnel. À 1440×950, les six vues de référence tiennent dans leur panneau, sans défilement. À 1440×800, Comparer conserve 85 px de défilement interne; les cinq autres vues tiennent. Les pistes de discussion apparaissent avant le détail des déclarations et restent visibles au premier regard à 950 px. Le redimensionnement au clavier et à la souris ainsi que l’agrandissement ont été vérifiés. Les détails longs restent défilables. Les 19 maquettes ImageGen restent dans `docs/prep/ui-imagegen-2026-11-15/` : elles ne prouvent pas l’implémentation de leurs propositions pour les autres modules.

## Cas de régression à conserver

| Demande | Défaut reproduit | Résultat attendu |
|---|---|---|
| « Tolérance élevée, fonds indispensables dans 18 mois, perte compromettant le projet inacceptable : explique les tensions. » | Carte générique, emprunt inféré ou capacité déjà déclarée présentée comme absente. | Déclaration qualitative reconnue; confort émotionnel distinct des conséquences financières; montant non chiffré visible; pistes qui respectent les contraintes. |
| « Compare historiquement AAPL et MSFT et ouvre Comparer. » | Modification du profil et carte d’adéquation non demandées. | Calcul sur dates/devise communes, Comparer sélectionné, aucun changement de profil. |
| « Crée une note rappelant que les scénarios sont conditionnels. » | Un ancien scénario était relancé après la note et écrasait le recalcul de 30 séances par celui de 20. | Note créée dans Documents, aucun outil financier exécuté, scénario de 30 séances conservé au rechargement. |
| « Lis mon portefeuille fictif puis publie constats, pistes et inconnues. » | Poids masqués, classement de concentration sans seuil et conclusion sur la stabilité depuis les seuls libellés. | Poids joints par le serveur; interprétation conditionnelle; catégories, garanties, liquidité, historique et risque mesuré distingués. |
| Carte refusée pour longueur ou contenu. | Même appel répété jusqu’au délai Lambda. | Message de validation ciblé, deux reformulations possibles, erreur explicite après trois essais invalides. |
| Résultat créé puis fin du modèle sans texte. | Réponse chat vide malgré le document calculé. | Résumé validé de la carte ou confirmation serveur du calcul effectué, sans chiffre ajouté. |

Ces assertions couvrent les régressions observées. Elles ne sont pas une certification automatique de la justesse financière de toute phrase générée; inspecter le contenu réel de la carte lors d’un changement de modèle ou de skill.

## Reproduire les contrôles

Depuis la racine du dépôt, vérifier la cible API active dans Vite avant les essais locaux. Adapter l’URL au serveur démarré; aucun port n’est imposé par ce module.

```sh
npm run typecheck --workspace @investoros/web
npm run build --workspace @investoros/web
PYTHONPATH=apps/api/src .venv/profile-api/bin/python -m unittest discover -s apps/api/tests -q
node --test apps/web/src/features/profiles/profile-consistency.test.mjs
PROFILE_WEB_URL=http://127.0.0.1:5185 node scripts/test-profile-workbench-state.cjs
PROFILE_WEB_URL=http://127.0.0.1:5185 node scripts/test-profile-async-chat.cjs
node scripts/test-profile-deployed-api.cjs
PROFILE_DEPLOYED_MODE=1 PROFILE_LIVE_PORTFOLIO=1 node scripts/test-profile-aws-live.cjs
```

Les deux dernières commandes utilisent le compte Cognito de test décrit dans `AGENTS.md`; elles lisent le fichier local ignoré sans afficher ses identifiants et modifient la mémoire fictive Robert. Ne pas lancer simultanément plusieurs essais qui écrivent ce même persona.

Les historiques du starter sont un univers fini, pas des cours en direct. Les comparaisons sont descriptives; les scénarios sont des hypothèses; les cartes sont des interprétations et clarifications, sans conseil d’achat, de vente ou d’allocation personnalisée.


## Widgets financiers inline

Le chat Assistant peut recevoir `financial_widget` depuis `render_portfolio_widget` et afficher cinq vues : valeur/historique, positions, répartition, contributions et secteurs. Le module dédié `components/financial-widgets/README.md` décrit ses contrats et sources visuelles. Les périodes, versions de messages et comptes sont conservés; seul le couple vue/période revient au modèle. Les phrases des demandes uniquement visuelles utilisent les résultats déterministes.

La publication exige le frontend et les deux fonctions Assistant/worker avec le même snapshot de skills. Les catégories des portefeuilles AWS ne donnent pas automatiquement un historique ni leurs titres sous-jacents. Le script local `scripts/preview-financial-widgets.py` sert un exemple illustratif séparé, calculé à partir du paquet AlphaForge, avec Bedrock réel. Les essais et captures sont dans le dossier local ignoré `docs/agentic/chat-financial-widgets/`.

### Tab Chaîne d’approvisionnement

`inspect_supply_chain` produit un document `network` version 2 pour le nom/ticker demandé. `SupplyChainTab` rend Graphe, Liste, Pressions et Événements; la source de chaque relation et constat reste cliquable. Les lignes financières sont les revenus USD des fournisseurs, avec comparaison de trimestres autonomes contigus calculée côté serveur. La couverture insuffisante et les données manquantes restent visibles. Le pipeline, les limites et le plan de vérification sont décrits dans `SUPPLY_CHAIN_WORKSPACE.md`. Les tests navigateur utilisent des fixtures explicitement indiquées; ils ne prouvent pas un appel AWS.

Vérification de la tranche Chaîne le 16 novembre 2026 : snapshot AWS 1.8.26, parcours navigateur public NVIDIA terminé sans erreur avec quatre vues, sources, deux séries financières et restauration des messages/documents. Le test API public Apple est terminé sans erreur; il utilise notamment sa liste officielle FY2023. Le runtime évite la recopie du dossier dans `upsert_tab`; les sauvegardes de conversation sont sérialisées avec retries bornés. Voir `SUPPLY_CHAIN_WORKSPACE.md` pour les preuves, limites et commandes reproductibles.
