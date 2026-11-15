# InvestorOS — alignement du projet Datathon Polyfinance 2026

**Note de coordination locale, mise à jour le 14 novembre 2026.** À lire avant tout travail sur les profils, les données, la recherche, les agents, les skills, les visualisations ou AWS. Elle décrit les écarts visibles entre l’objectif du hackathon, le code principal et les worktrees observés. Elle ne remplace ni les contrats API ni une vérification des déploiements AWS. Les états de conversation et de fichiers sont un instantané : actualiser avant une intégration.

## 1. Objectif du concours : la boussole commune

Le défi AlphaForge demande une solution agentique utile qui emploie des données financières publiques pour éclairer une décision d’investissement adaptée à plusieurs profils, et qui sait expliquer ses conclusions. Le travail n’est pas d’empiler des données ou des agents : il faut sélectionner des signaux pertinents, les croiser, exposer les preuves et limites, et rendre la décision compréhensible.

**Analyse approfondie et rectification de périmètre (15 novembre) :** lire `CHALLENGE_RESPONSE_STRATEGY.md`. L’énoncé p. 3 autorise explicitement une allocation fictive. Les interdictions globales d’allocation présentes dans certaines notes de recherche antérieures sont trop larges : distinguer proposition simulée pour personas fictifs et présentation comme conseil financier personnalisé. Le runtime actuel reste plus restrictif; cette clarification documentaire n’active pas un moteur d’allocation. La détection d’incohérences est un cas d’usage important (Robert), parmi la comparaison, l’explication des risques, les scénarios et les autres aides à la décision. La cible proposée est un dossier partagé d’options, preuves, compromis et sensibilité, qui relie les capacités déjà présentes.

Le barème du PowerPoint des participants est :

| Critère | Poids | Preuve attendue dans InvestorOS |
|---|---:|---|
| Solution | 20 % | Une expérience pertinente, créative et réellement fonctionnelle. |
| Approche agentique et explicabilité | 20 % | Des rôles utiles, outils appelés, contrôles, preuves, décisions et limites observables. |
| Données | 20 % | Sources adaptées, validation, traitement explicite, visualisations exactes et données manquantes visibles. |
| UX/UI | 10 % | Parcours intuitif et explications lisibles. |
| AWS | 15 % | Contribution AWS réelle et démontrable; c’est aussi une condition d’admissibilité. |
| Pitch | 15 % | Histoire convaincante, valeur utilisateur et démonstration bout en bout. |

Les quatre livrables sont prototype/code/README, vidéo (environ cinq minutes à titre indicatif), documentation technique et one pager. La performance historique d’un portefeuille simulé ne remplace pas la qualité globale de la solution.

Les profils de référence sont des tests de contextualisation : Amira (croissance longue, technologie/crypto, diversification), Mateo (équilibre, risque modéré, préférences ESG explicites), Robert (préservation, horizon plus court, intérêt possible pour une occasion risquée). Le parcours actuel de choix et d’enrichissement du profil, de détection des tensions et de clarification **est déjà une partie du produit**; ne pas le replanifier comme un manque. Il faut que ce profil dirige ensuite les données recherchées, les contrôles, l’analyse et les vues.

Garde-fous : simulation seulement; pas de transaction; pas de conseil financier personnalisé; faits, hypothèses, opinions et scénarios distincts; chiffres calculés par du code traçable; aucun chiffre ou justificatif inventé; limites et incertitudes visibles; aucune donnée financière privée réelle.

Sources originales : `docs/prep/sources/Datathon2026/Presentation_AlphaForge_AI_Participants.pptx`, `Datathon - Case Officiel 2026 FR.pdf` et `docs/prep/sources/Comprendre l'investisseur avant de bâtir la solution_V1 (1).pptx`. Les notes de préparation utiles sont dans `docs/prep/01-defi-officiel.md`, `02-comprendre-investisseur.md` et `03-donnees-et-qualite.md`.

## 2. Ce qui existe déjà dans le code

Cette section évite de confondre une fonctionnalité existante avec une tâche encore ouverte.

| Domaine | Présent dans le dépôt/code observé | Limite à garder visible |
|---|---|---|
| Profils | Sélecteur de comptes/personas fictifs, conversation de profil, fiche structurée et outils de mise à jour; `ProfileInspector.tsx` et `profile-consistency.ts` signalent les champs manquants et quelques tensions explicites entre objectif, horizon, risque, capacité de perte, liquidité, contraintes et préférences. Le spécialiste de profil est dans `profiles/service.py`. | Cette vérification est une règle indicative avec couverture bornée, pas une validation exhaustive de l’adéquation financière. Garder ses champs inconnus visibles; les personas sont fictifs et ne pas inférer ce qu’ils ne déclarent pas. |
| Portefeuilles | Vues et calculs de portefeuilles fictifs; `profiles/portfolio.py`, `demo_contexts.py`, `features/portfolios/`. | Couverture et look-through dépendent des données fournies; un graphique d’allocation ne prouve pas la composition complète d’un FNB. |
| Simulation de marché | `simulation.py` : univers configuré, historiques, événements de distribution/fractionnement, études descriptives et scénarios conditionnels; pages `features/scenarios/` et visualisations marché. | Les trajectoires sont historiques ou conditionnelles, pas des prédictions ni des probabilités. La réaction après un événement ne démontre pas la causalité. |
| Recherche et preuves | `apps/api/src/investoros_api/research/` comprend runtime, catalogue de sources, collecte, documents, données financières SEC XBRL, macro/FX, identité, extraction, validation, couverture et rapport. `features/analyses/` et `features/evidence/` rendent analyses et preuves consultables. | Le code ne garantit pas l’accès réseau, les quotas, la disponibilité ou l’exactitude de chaque connecteur dans chaque déploiement. La recherche est limitée aux opérations réellement configurées, pas un Web universel. |
| Sources présentes dans le catalogue/code | AlphaForge; SEC EDGAR et CompanyFacts; Banque du Canada; FRED; calendriers/données d’organismes selon la recherche; documents secondaires via GDELT dans Simulation; Federal Register; X via des voies bornées (oEmbed/post fourni, et une recherche récente optionnelle). Voir `research/sources.py`, `simulation.py`, `research/runtime.py`. | Un index de dépôt SEC n’est pas le contenu lu du dépôt; X est une déclaration attribuée, pas une corroboration; GDELT fournit des pistes secondaires; calendrier futur et historique ne doivent pas être confondus. |
| Visualisations | `features/analysis-workspace/` fournit des vues structurées (chronologie, propagation, scénarios, dépendances, simulateur); `features/portfolios/` contient graphiques de portefeuille; les pages analyses/scénarios ajoutent des vues de marché. Des contrats API et composants partagés sont aussi en cours dans un worktree. | Les cartes d’entreprise affichent des relations déclarées; les positions géographiques peuvent être schématiques; les risques de chaîne logistique et routes physiques ne sont pas établis par ces liens. Chaque vue doit montrer ses entrées, période, devise, source et limites. |
| Agents et activité | Assistant, tâches de recherche, événements, statut, outils et skills chargés sont représentés dans l’espace de travail recherche/Assistant (`ResearchWorkspaceTabs`, `research-workspace.ts`, API `profiles/research*`). | Une activité affichée doit venir d’un événement réel. Un lien vers un onglet ou un texte de rôle ne prouve pas qu’un agent, calcul ou outil a été exécuté. |
| Skills | Le runtime utilise le snapshot `profiles/skills_snapshot.json` avec `search_skills`/`load_skill`. Le catalogue source voisin `../InvestorOS-skills/` contient maintenant 19 procédures, version `1.8.10`; le snapshot de ce checkout correspond à la même version et aux mêmes 19 identifiants. Il comprend notamment `analysis-planning`, `market-movement-investigation`, `platform-capabilities` et `profile-investment-alignment`. | Les états DEV2/DEV6 de la note précédente ne sont pas revérifiés et peuvent être anciens; le `origin/main` et AWS ne contiennent pas encore ce snapshot dans cette intervention. Le dépôt source n’a toujours ni commit initial ni remote configuré. Le runtime ne modifie/publie pas les skills : publier le snapshot applicatif et vérifier séparément tout déploiement. |
| AWS | Terraform, API Gateway/Lambda, S3/CloudFront, DynamoDB, Cognito, Bedrock, recherche et Knowledge Base sont représentés dans le code et plusieurs états/configurations. Voir `infrastructure/terraform/environments/*/README.md`. | Code, plan, ressource existante, ressource mise à jour et appel de bout en bout sont des états différents. Les README de stack indiquent tables/fixtures ou invocation Bedrock encore à appliquer/vérifier, Step Functions non déployé dans la tranche décrite et RAG non branché. Vérifier le compte et les routes avant toute affirmation. |

### Couverture actuelle des données à ne pas surpromettre

Le starter AlphaForge couvre un univers fini d’environ 31 actifs avec prix ajustés, opérations sur titres, FX USD/CAD et séries macro. Il ne constitue pas à lui seul un historique complet du marché ni des portefeuilles clients. Les notes du starter signalent les effets de révisions, biais du survivant, calendriers désalignés, crypto UTC et un cas de split/dividende suspect.

Les données d’entreprise accessibles via SEC XBRL couvrent certains concepts standard et restent bornées par les unités, périodes et balises. Pas de jeu ESG complet ni de score ESG vérifiable n’est fourni. Les compositions complètes des FNB, frais détaillés et expositions sous-jacentes peuvent manquer. Les actualités secondaires, publications X et textes réglementaires ne doivent pas être utilisés comme faits financiers confirmés ou causes d’un mouvement de prix sans validation adéquate.

Pour chaque domaine, l’interface et le rapport doivent pouvoir distinguer : **disponible et vérifié**, **disponible partiellement**, **collecte échouée/indisponible**, **non fourni/non pris en charge**. Une couverture manquante doit produire une limite explicite, pas une valeur de remplacement.

## 3. Travaux parallèles repérés et risques d’intégration

La lecture des transcriptions des autres chats n’est pas disponible depuis cet hôte au moment de cette note. Les descriptions ci-dessous combinent les titres/résumés fournis par l’historique Codex et l’état observable des worktrees; elles ne prétendent pas reproduire chaque décision prise dans les fils. Les noms de tâches sont conservés tels qu’affichés.

| Chat/tâche | Worktree ou état observé | Travail apparent | Point de coordination |
|---|---|---|---|
| `DEV1` | `~/.codex/worktrees/network-dynamodb-persistence/InvestorOS-53-Polyfinance2026`, branche `codex/local-research-iam`, commit `a5a9add`; propre, un commit au-dessus de `origin/main`. | Le résumé du chat mentionne profils Amira/Mateo/Robert, DynamoDB, scénarios agentiques et UI de chat. Le dernier commit observable, « Restore local IAM research workspace », ajoute le pont vers l’API de recherche configurée, les outils de suivi d’analyse dans l’UI et un script de développement local. | Distinguer le périmètre historique du chat de son dernier commit. Évaluer le commit comme unité; clarifier comment profil/snapshot alimentent le résultat de recherche commun. Ne pas réécrire ce travail déjà commité. |
| `DEV2` | `~/.codex/worktrees/dataset-audit/InvestorOS-53-Polyfinance2026`, branche `codex/starter-dataset-audit`, base `9012fac`; nombreux changements non commités, env. 30 fichiers suivis modifiés et nouvelles fonctions/fichiers. | Audit du starter et large tranche recherche : sources, financials, macro, identité, navigateur/API Anything, skills, Knowledge Base, UI recherche, scripts de dataset et Terraform/recherche. | Très large tranche, avec modifications simultanées de `main.py`, `profiles/service.py`, `profiles/tools.py`, `profiles/models.py`, `api/README.md`, `api.ts` et Terraform. Scinder les responsabilités et vérifier quelle tranche peut être intégrée sans écraser `DEV6`. |
| `DEV3` | `~/.codex/worktrees/investoros-analysis-ui/InvestorOS-53-Polyfinance2026`, base `9012fac`; petits changements suivis et nouveaux fichiers de recherche/analyses/Knowledge API. | Interface d’analyse et branchement Knowledge/retrieval, selon le résumé de tâche. | Recoupe `DEV2` dans `main.py`, `App.tsx`, `api.ts`, `features/analyses/`, `knowledge/` et `modules/knowledge`. Fixer qui possède chaque point d’intégration. |
| `DEV4` | Chat dans `/home/yasser/DatathonPolyfinance/InvestorOS-53-Polyfinance2026`, état idle lors du dernier relevé. | Audit du dépôt, fichiers suivis et dépendances exclues. | Son inventaire doit distinguer code principal, changements locaux non commités et worktrees séparés; la note de préparation historique n’est pas le code courant. |
| `DEV5` | Même checkout principal, chat actif lors du dernier relevé. | Analyse des conversations, notes Markdown, documents de défi et PowerPoint. | Les fichiers sources dans `docs/` sont ignorés/local-only; conserver les originaux et ne pas forcer leur ajout. Publier les instructions de coordination dans un fichier racine partagé par Git. |
| `DEV6` | `~/.codex/worktrees/analysis-visual-tabs/InvestorOS-53-Polyfinance2026`, base `a849bc5`; changements non commités dans environ 28 fichiers et plusieurs nouveaux modules. | Contrats de visualisation API, composants de graphiques réutilisables, chat/outils, onglets partagés, paramètres et graphiques de scénarios, orchestration UI. | Recoupe largement `DEV2` sur `profiles/{models,router,service,tools}.py`, `simulation.py`, `api/README.md`, `api.ts`, pages analyses/scénarios et dépendances web. Publier un contrat visuel typé stable; ne pas ajouter une seconde représentation des mêmes résultats. |
| Checkout principal | `/home/yasser/DatathonPolyfinance/InvestorOS-53-Polyfinance2026`, `main` à `0542a2e`; plusieurs changements locaux existaient à l’ouverture de cet audit. | Modifications de `simulation.py`, `profiles/{router,service,tools}.py`, API partagée, Assistant/Scénarios, `AnalysisJourney`, `analysis-workspace`, `ScenarioMarketChart`, `forecast.py` et preuves réseau. | Ces edits locaux recoupent les domaines de `DEV2` et `DEV6`. Identifier leur auteur/objectif avant intégration ou remplacement; ne pas traiter le checkout principal comme un état propre. Les documents ajoutés par cet audit sont distincts de ces edits code préexistants. |
| `Terraform-AWS-Manager` | `~/.codex/worktrees/backend-foundation/InvestorOS-53-Polyfinance2026`, branche `feat/backend-foundation`, commit `c450fb0`; propre au relevé. | Fondation backend AWS/Terraform. | Le commit est déjà dans l’ascendance du `origin/main` observé. La fondation ne prouve pas que chaque service de l’application est déployé/validé. Vérifier l’état AWS séparément. |
### Zones de conflit technique à surveiller

1. **Backend profil/recherche** — `apps/api/src/investoros_api/profiles/models.py`, `router.py`, `service.py`, `tools.py`, `research_bridge.py`, `simulation.py` et `main.py` sont édités dans plusieurs worktrees. Il faut un seul contrat d’entrée/sortie, un seul owner par changement et une intégration séquentielle.
2. **Frontend analyses et Assistant** — `apps/web/src/features/analyses/`, `assistant/`, `profiles/`, `scenarios/`, `shared/api.ts`, `App.tsx` et `package.json` ont des changements croisés. Préserver les contrats API, les routes et les vues des branches déjà présentes.
3. **Recherche, visualisation et stockage** — un résultat de recherche doit pouvoir alimenter un résultat typé, puis une ou plusieurs vues; éviter que recherche, chat et simulation conservent trois schémas incompatibles ou perdent les mêmes evidence IDs.
4. **Skills partagés** — le catalogue source et les snapshots backend ne sont pas alignés (source/DEV6 1.4.1 avec 14; `main` 1.3.1 et DEV2 1.2.2 avec 12). Le dépôt source `InvestorOS-skills` a des changements staged/unstaged et aucun commit initial. Avant publication, décider quelle version gagne, intégrer les skills `visualization-authoring` et `analysis-ui-orchestration` (ou reporter explicitement), synchroniser tous les snapshots, vérifier version/hash et ne pas prétendre qu’un skill est chargé si la trace ne le montre pas.
5. **AWS/Terraform** — la stack `dev` signale des états séparés et un plan global susceptible de supprimer des ressources gérées ailleurs. Ne jamais appliquer un plan avant réconciliation explicite de l’état, revue des changements et vérification du compte/région cible.

## 4. Incohérences documentaires et de représentation relevées

1. `docs/prep/06-backlog-concret.md` est un backlog historique. Il affirme que l’API n’a que `/health`, que Terraform est une coquille vide et qu’aucun accès réel à plusieurs services n’existe; il ne décrit plus le code observé. Garder le document comme trace de cadrage initial, mais ne pas le présenter comme statut actuel.
2. `apps/api/README.md` mélangeait plusieurs périodes et configurations : auth décrite dans le contrat AWS mais « aucune authentification » dans les limites; modules de recherche/knowledge et `start_analysis` présentés comme intégrés alors que d’autres phrases disaient aucune Step Functions/RAG. Il faut séparer le **code présent**, la **stack configurée**, le **déploiement**, et la **validation réelle**. Cette distinction est amorcée dans le README API mis à jour; les README Terraform restent la référence par stack.
3. L’existence d’objets Knowledge Base dans un état AWS antérieur n’équivaut pas à un pipeline RAG relié au chat. Inversement, une route `knowledge/retrieve` ou un `start_analysis` dans le code n’est pas preuve que la Lambda, le workflow, les permissions, les données et l’UI sont branchés ensemble.
4. Les noms « agent », « room », « workflow » ou « exécution » dans une UI ne prouvent pas une invocation Bedrock/Step Functions. Les statuts doivent être mappés depuis les événements réellement persistés; distinguer collecteur déterministe, appel modèle, source et tâche non exécutée.
5. Une source indexée, un document listé ou un post social affiché ne suffit pas à valider le contenu. Conserver les distinctions primaire/secondaire/social, extrait effectivement lu, date, identité, indépendance, couverture et contradiction.
6. Les cartes de relations d’entreprise peuvent aider à explorer des dépendances, mais ne doivent pas suggérer des routes physiques ou des risques vérifiés si ces données ne sont pas disponibles.
7. Le dépôt principal et les worktrees ont des états locaux non commités différents. Toute phrase « présent dans la plateforme » doit préciser si elle est dans `main`, une branche/worktree ou une stack AWS réellement utilisée.

## 5. Direction fonctionnelle partagée

L’ambition reste une plateforme riche. Le flux complet attendu est une boucle intégrée, pas une liste de modules indépendants :

```text
Profil choisi et confirmé
  → question/objectif et incohérences à clarifier
  → plan des sources/outils/agents selon ce profil
  → collecte multi-domaines avec provenance et état de couverture
  → calculs reproductibles + vérification des sources contradictoires
  → synthèse conditionnelle adaptée au profil
  → graphiques, tableaux, cartes et preuves liés au même résultat
  → retour utilisateur, suivi/version et amélioration contrôlée des skills
```

Les familles à représenter dans la matrice de couverture sont :

| Famille | Questions/capacités | Vues utiles | Lacunes à rendre explicites |
|---|---|---|---|
| Profil, objectifs et portefeuille | L’objectif, horizon, tolérance/capacité de perte, liquidité, préférences, positions et contraintes se contredisent-ils? | Fiche de profil, audit des tensions, concentration/expositions, changements avant/après. | Réponses inconnues, autres comptes/actifs non déclarés, positions fictives. |
| Marché et instruments | Historique comparable? rendement total? risques de prix, devise, concentration, calendrier, événements? | Prix et rendement, distributions/fractionnements, comparaison, distribution, scénario conditionnel. | Historique borné/révisable, biais du survivant, fonds/look-through manquant, pas de causalité ni prédiction. |
| Entreprises et documents | Qu’ont déclaré l’émetteur et les dépôts réglementaires? quels fondamentaux standard sont disponibles? | Chronologie de dépôts/événements, tableaux de séries par période/unité, liens/extraits de preuve. | Document pas lu vs index seulement, balises XBRL/non standard, corrections/restatements, données non couvertes. |
| Macro et devises | Quelles conditions économiques/de change peuvent contextualiser la question? | Chronologie macro par zone/fréquence, comparaison CAD/USD, scénarios de taux/FX. | Retards/révisions, unité, fréquence, date de disponibilité réelle, corrélation ≠ cause. |
| Actualités, signaux sociaux, réglementation, ESG | Existe-t-il des déclarations ou événements pertinents et corroborés? | Chronologie séparée des cours, source primaire/secondaire/social, preuves opposées. | Couverture non exhaustive, déclaration non corroborée, ESG absent, date d’indexation ≠ publication. |
| Réseau d’entreprise/approvisionnement | Quelles relations sont rapportées, par qui, à quelle date et avec quel degré de preuve? | Graphe relationnel et table de preuve, géographie seulement si vérifiée. | Relations déclarées ou inférées à distinguer; aucune route logistique ni notation de risque sans sources. |

La détection d’« incohérence » doit être typée et traçable : (a) contradictions dans le profil; (b) demande incompatible avec une contrainte confirmée; (c) écart entre préférence et produit/exposition; (d) affirmations de sources en conflit; (e) période/devise/unité incohérente; (f) données insuffisantes. Une incohérence n’est pas automatiquement une erreur de l’utilisateur; la réponse doit montrer les champs/preuves concernés et parfois poser une question.

Chaque résultat partagé entre API, agents et UI doit au minimum préserver : `analysis_id`, profil et version, portefeuille et version, question/fenêtre, état/coverage, tâches réellement lancées et leurs traces, affirmations typées, `evidence_id`s, méthode/calcul/version, hypothèses, scénarios, limites, et identité/version des vues publiées. Ne pas créer un second schéma sans mapping explicite vers les contrats existants de `research/models.py`, `profiles/models.py` et `visualizations`.

### Cycle de vie recommandé des skills

1. Chat gestionnaire propose un skill à partir d’un problème observé, d’un exemple d’entrée/sortie et des sources/outils permis.
2. Stockage du brouillon séparé du catalogue actif; auteur, version, provenance et cas de test enregistrés.
3. Revue métier/sécurité/licence et validation sur exemple positif et contre-exemple.
4. Approbation humaine puis synchronisation du dépôt `InvestorOS-skills`, `catalog.json` et `skills_snapshot.json`; vérifier le hash et la version chargée.
5. Évaluer les réponses après publication; désactiver ou revenir à la version antérieure si régression.

Le runtime peut charger uniquement les skills déjà approuvés. Une proposition du modèle n’est jamais publication implicite. La recherche détaillée, la taxonomie, les exemples de prompts, les réponses attendues et la lecture statique des réponses actuelles sont dans `docs/prep/10-recherche-skill-incoherences.md` (document local ignoré par Git).

## 6. Ordre de travail et critères d’intégration

1. **Établir l’état de référence** : relever HEAD, changements locaux, branches/worktrees, stack/région AWS et date des derniers appels réels. Ne pas additionner mentalement des fichiers situés dans des worktrees différents.
2. **Attribuer les contrats communs** : un modèle de résultat de recherche, preuve, affirmation, coverage, profil-snapshot et visualisation; définir les champs obligatoires et limites. Désigner un owner pour chaque fichier backend partagé et frontend partagé.
3. **Finir la matrice dataset/connecteurs** : pour chaque source, usage autorisé, format, date/période, devise/unité, fréquence, méthode de validation, limitations/conditions, quota et vues qui la consomment.
4. **Brancher l’analyse complète** : le profil pilote le plan de collecte; les étapes et événements viennent des opérations réelles; la contre-vérification et les règles déterministes vérifient les constats; les absences/contradictions survivent jusqu’au rapport.
5. **Unifier les visuels sur le résultat typé** : courbes de marché, événements, scénarios, expositions, table/graphe réseau et preuves reçoivent le même contexte/version. Une vue ne peut afficher que les séries réellement présentes et doit fournir le tableau accessible équivalent.
6. **Réconcilier l’infrastructure avant changement** : ne pas appliquer le root Terraform `dev` tant que les states qui couvrent API/recherche/Knowledge Base ne sont pas réconciliés; tester auth, `/health`, profil, recherche, données et vues par les véritables routes et fonctions visées.
7. **Documenter la démonstration** : montrer au moins deux profils contrastés, les données utilisées, l’agent/outils réel, une preuve, une limite et une visualisation qui change selon le contexte; terminer README, vidéo et one pager. Cette histoire ne limite pas le produit, elle vérifie que son architecture sert bien toutes ses capacités.

Une tranche est intégrable lorsque son owner indique : fichiers modifiés, contrat ajouté/changé, dépendances d’autres branches, sources et limites, état local vs déployé, preuve de fonctionnement déjà observée, migration/config requise et conflits connus. Ne pas déclarer « terminé » sur la base de tests seulement, d’un plan Terraform ou d’un HTTP 200 sans réponse d’outil.

## 7. Sources de statut et limites de cet audit

- Code principal : `apps/api/src/investoros_api/`, `apps/web/src/features/`, `infrastructure/terraform/`.
- État par stack : README de `infrastructure/terraform/environments/dev/` et `assistant-simulation/`; les plans doivent être relus contre les states et les ressources réelles.
- Skills : catalogue externe `../InvestorOS-skills/`, snapshot backend `apps/api/src/investoros_api/profiles/skills_snapshot.json`, instructions de création `../InvestorOS-skills/AUTHORING.md`.
- Défi : originaux dans `docs/prep/sources/Datathon2026/`; dossier `docs/` est ignoré/local selon `AGENTS.md`.
- Worktrees et conversations : liste Codex du 14 novembre et systèmes de fichiers accessibles. Les transcriptions complètes de certains chats n’étaient pas lisibles depuis l’hôte; la table des tâches décrit ce que révèlent leurs résumés et leurs changements, pas une revue exhaustive des messages.
- Aucun test ni changement AWS n’a été exécuté pour produire cette note. Les changements de code des autres tâches restent dans leurs branches/worktrees tant qu’ils ne sont pas intégrés.

### Extension produit à prioriser : le conflit visible pendant le dialogue Profile

La vérification actuelle de `ProfileInspector` est utile mais ne suffit pas au cas central du défi. Elle compare quelques champs entre eux; elle ne reçoit pas encore de résultat structuré liant une demande d’actif à des caractéristiques vérifiées de cet actif et au profil. Pendant une discussion dans Profile, le panneau droit doit devenir le tableau de bord vivant de cette comparaison, sans remplacer la conversation ni transformer une règle indicative en verdict de convenance.

Voir la spécification détaillée et les cas de réponse dans `docs/prep/11-experience-alignement-profil-investissement.md` (local, ignoré par Git). Elle précise le comportement attendu, les catégories et niveaux de preuve, le contenu visuel, les questions de clarification, l’évaluation et les contrats techniques à faire converger. La spécification n’est pas une fonctionnalité déjà implémentée : le code actuellement observé reste celui décrit dans la table « Profils » ci-dessus.

### Démo, audit navigateur et backlog

Le plan de démo en cinq minutes, l’audit Chrome/Playwright local, les écarts observés, les fonctions à compléter et les mesures de cadence proposées sont dans `docs/prep/12-plan-demo-audit-navigateur-et-backlog.md` (note locale ignorée par Git). L’audit est une vérification du checkout local et des fixtures : il ne prouve pas les performances ou l’intégration en production AWS. Bugs reproduits, limitations actuelles et améliorations proposées y sont séparés.

### Tranche Profile interactive — 15 novembre

Le code principal contient désormais les six sous-onglets Profile, des outils typés de comparaison/alignement/navigation, une mémoire serveur versionnée (SQLite ou DynamoDB), des scénarios conservés côté serveur et une interface mobile alternant chat et panneau. Les procédures du profil sont réellement injectées dans le contexte Bedrock et leur chargement est attribué au runtime. L’état, les commandes de vérification et les limites sont détaillés dans `apps/web/src/features/profiles/WORKBENCH.md`. Les tableaux historiques de cette note décrivent l’instantané antérieur; cette mise à jour ne prouve pas une publication de la nouvelle UI sur AWS.
