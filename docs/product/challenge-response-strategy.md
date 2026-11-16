# InvestorOS — stratégie de réponse au défi AlphaForge

Analyse du 15 novembre 2026, code principal observé à `0542a2e` avec changements locaux en cours. Ce document décrit une cible produit et ses écarts avec le code lu. Il ne certifie pas un déploiement AWS ni de nouveaux essais live. Les essais navigateur précédents restent documentés séparément dans les notes locales.

## 1. Ce que demandent exactement les sources

| Référence | Attente exprimée | Conséquence pour InvestorOS |
|---|---|---|
| Énoncé FR p. 3 | Comparer des actifs, analyser des scénarios, expliquer des risques **ou proposer une allocation fictive**; choix libre du cas et de l’architecture. | Ces formes sont des possibilités, pas quatre obligations cumulatives. Nous pouvons en combiner plusieurs dans une expérience de décision cohérente. |
| Énoncé p. 8 et PPT participants slide 5 | Agent(s) mobilisent données/outils, coordonnent tâches, adaptent et expliquent; chaque composant justifie son rôle. | Un chat et une liste d’outils ne suffisent pas à démontrer l’adaptation : les décisions de recherche et contrôles doivent dépendre de la question et du contexte. Un seul agent peut suffire. |
| PPT participants slide 4 | Amira : diversification malgré risque élevé; Mateo : critères non financiers; Robert : demande possiblement incohérente avec son profil. | L’incohérence n’est pas le seul objectif produit. Les trois cas éprouvent des aspects différents de la contextualisation. |
| Énoncé p. 8 et PPT participants slide 8 | Mettre les résultats à l’épreuve : changer une hypothèse, un scénario ou un profil. | Ajouter une comparaison de résultats avant/après avec explication des changements. Une courbe isolée n’établit pas la robustesse. |
| Énoncé p. 10–11 et PPT participants slide 6 | Données choisies selon leur pertinence; starter facultatif; aucune classe d’actifs obligatoire. | Étendre les données pour fermer une question précise; ne pas viser toute la finance pour cocher le tableau des familles. |
| Atelier investisseur slides 12–14 | Données → constats → analyse → proposition → explication. Exemple XSP/ZEQT, expositions et chevauchements. | Produire des options discutables et comparables. Une réponse limitée à des avertissements et à un questionnaire n’achève pas cette chaîne. |
| Énoncé p. 17–18 | Simulation, aucun ordre réel ni présentation comme conseil personnalisé; explications fidèles et synthétiques; historique descriptif. | Les propositions d’allocation de personas fictifs sont possibles. Les qualifier, expliquer leur construction et leurs limites; ne pas les présenter comme prescriptions pour des avoirs réels. |
| PPT participants slides 7 et 10 | AWS effectif et démontrable, admissibilité; grille 20/20/20/10/15/15. | Une preuve d’utilisation effective dans le parcours, plus une architecture adaptée; ni nombre de services ni Terraform seul. |

**Rectification de cadrage :** nos notes précédentes ont parfois interdit globalement toute allocation. Cette formulation est trop large au regard de la p. 3. Le défi autorise une allocation fictive explicable. En revanche, le code actuel et ses prompts restent plus restrictifs; la possibilité officielle ne signifie pas que cette capacité est implémentée. Ce document fait référence pour cette distinction, sans activer de nouveau comportement du runtime.

Sources originales locales : `docs/prep/sources/Datathon2026/Datathon - Case Officiel 2026 FR.pdf`, `Presentation_AlphaForge_AI_Participants.pptx`, et `docs/prep/sources/Comprendre l'investisseur avant de bâtir la solution_V1 (1).pptx`. Les numéros de slides ci-dessus sont ceux des fichiers originaux, relus pour cette analyse. La grille complète reste réservée au jury; aucune recette de victoire ne peut être déduite des pondérations seules.

## 2. Positionnement proposé pour la plateforme

**InvestorOS transforme une question d’investissement en un dossier de décision simulée : options comparées, données vérifiées, conséquences selon le profil, scénarios et explication de ce qui ferait changer la conclusion.**

Le profil fournit le contexte; les données décrivent les actifs; les calculs mesurent les effets; les agents organisent l’analyse; les vues rendent le résultat discutable et vérifiable. La détection d’une tension est une sortie possible de ce dossier, avec la comparaison, l’analyse de risque ou une allocation illustrative.

Chaque résultat doit permettre de répondre à cinq questions :

1. Quelle décision et quel objectif examinons-nous?
2. Quelles options ont réellement été comparées, y compris le statu quo?
3. Quels constats publics et quels calculs soutiennent la comparaison?
4. Quels compromis changent avec le profil ou les hypothèses?
5. Qu’est-ce qui manque, et qu’est-ce qui pourrait faire changer la lecture?

L’agent peut avancer sur ce qui est vérifiable même si certaines informations de profil manquent. Une capacité de perte inconnue empêche certaines conclusions contextuelles; elle n’empêche pas d’expliquer l’activité d’une entreprise ou de comparer deux historiques. Poser uniquement les questions dont la réponse change l’analyse demandée.

## 3. Diagnostic réel des briques présentes

| Domaine et ancrage code | Acquis observé | Écart vers le dossier de décision |
|---|---|---|
| `features/profiles/ProfileInspector.tsx`, `profile-consistency.ts` | Huit rubriques éditables, inconnues visibles, trois règles de tensions internes. | Pas de résultat structuré profil–demande–actif reliant preuves et options. L’absence d’alerte ne signifie pas profil validé. |
| `profiles/service.py`, `tools.py` | Orchestration Bedrock, questions interactives, mise à jour du profil, spécialistes bornés, outils et procédures. | Le prompt privilégie la construction de profil et interdit les conseils d’achat; aucun moteur d’allocations fictives vérifiées dans les outils lus. Il faut un mode de comparaison/simulation explicite et une reprise après clarification. |
| `research/runtime.py::plan/synthesize` | Planification et synthèse reçoivent le profil; sources autorisées, tâches bornées, références de preuves, contrôles de portée des claims. | Le profil est déjà transmis : le travail est de rendre son effet observable et de construire un contrat d’options/compromis. La présence de `evidence_id` ne prouve pas à elle seule que le texte est soutenu. |
| `profiles/portfolio.py` | Poids, valeurs, concentration; chocs utilisateur calculés sur positions fictives. | Les positions sont normalisées essentiellement en libellé/poids/valeur; leur rattachement à un instrument et ses séries/expositions n’est pas établi par ce calcul. Les limites signalent un portefeuille qui peut ne pas correspondre au persona selon la configuration. Aucun look-through complet. |
| `simulation.py`, `profiles/forecast.py` | Historiques et projections conditionnelles; bootstrap empirique déterministe par graine, diagnostic chronologique. | Pas un moteur de comparaison de portefeuilles commun aux profils. Le bootstrap décrit son modèle; ses bandes ne sont pas des probabilités futures calibrées. Fenêtre, FX et hypothèses doivent rester comparables entre options. |
| `features/analysis-workspace/` | Chronologie, dépendances, scénarios et simulateur; provenance illustrative/recherche et preuves. | Le modèle comprend coûts, délais et niveau de service de chaîne logistique. Ce contrat ne doit pas être réutilisé comme modèle de risque financier sans adaptation explicite. |
| `profiles/network_evidence.py`, outil `inspect_supply_chain` | Relations et preuves revues pour un cas NVDA; géographie signalée schématique, absence de poids/risques inférés. | Extension utile si la question concerne ces dépendances; pas un moteur universel de fournisseurs ni une estimation du prix de l’action. Distinguer ce chemin de l’écran registre local Réseaux essayé auparavant. |
| UI recherche/analyses et sources | Rapports, citations, activité et vues de données existent. | Il manque un même dossier/version partagé entre chat, profil, portefeuille et vues, avec options, hypothèses et résultats associés. |

**Diagnostic :** le projet couvre déjà une grande partie du terrain technique. Sa faiblesse principale est l’intégration sémantique : ce qui est recherché, calculé et visualisé doit répondre à une même décision. Le nombre d’écrans masque aujourd’hui cette continuité plutôt qu’il ne la démontre.

## 4. Expérience cible : un parcours, plusieurs niveaux de profondeur

### Étape 1 — Définir la décision

Exemples : « Cette idée change-t-elle mon exposition? », « Que se passe-t-il dans ce scénario? », « Quelles différences entre ces deux instruments? », « Quelles allocations fictives illustrent ces contraintes? ».

Identifier l’objectif concerné, les instruments, le portefeuille de démo lié ou son absence, l’horizon et la nature exploratoire/simulée de la demande. Ne pas rattacher automatiquement toute question au même capital.

### Étape 2 — Choisir une investigation justifiée

Le coordinateur produit un plan court montrant question, raison de chaque source et contrôle attendu. Il choisit ses branches selon le contexte : fonds → documentation/holdings; entreprise → publications/fondamentaux; rendement historique → série ajustée/FX; ESG → critères + données pertinentes; besoin proche → liquidité/échéance et effets d’une baisse. La macro ou un graphe fournisseur n’apparaît que s’il éclaire la question.

### Étape 3 — Construire une comparaison équitable

Comparer deux à trois options, dont le statu quo lorsque pertinent. Même période/devise/méthode, même périmètre des avoirs, hypothèses de financement explicites. Les inconnues restent dans le tableau; elles ne sont pas remplacées par zéro. Ne pas calculer le risque portefeuille en moyennant les volatilités individuelles.

### Étape 4 — Éprouver les résultats

Modifier une hypothèse à la fois : montant fictif, financement depuis l’encaisse ou remplacement d’une position, fenêtre historique, échéance ou scénario. Garder les autres entrées fixes et expliquer ce qui change. Le changement de profil modifie les priorités/questions, pas les cours observés.

### Étape 5 — Publier le dossier explicatif

À droite : question et périmètre; cartes « constat », « compromis », « tension », « inconnue »; tableau des options; visualisation pertinente; source et méthode; bouton « Qu’est-ce qui ferait changer cette réponse? ». Le chat développe le point sélectionné et aide à explorer une objection. Exposer la trace factuelle d’exécution, pas une chaîne de pensée interne.

## 5. Les fonctions à ajouter, ordonnées par valeur

| Priorité | Fonction | Réutiliser | Dépendance/preuve nécessaire | Acceptation observable |
|---|---|---|---|---|
| P0 | Dossier de décision partagé | Modèles recherche, état workspace, profils/version, IDs preuves. | Compte, conversation, question, hypothèses, profil/portefeuille/dataset versions. | Même résultat dans chat et panneau; pas de réponse d’un autre compte ou d’un ancien profil. |
| P0 | Tableau « statu quo / option A / option B » | Outils portefeuille et historiques. | Identité instruments, dates, devise, calculs communs. | Deux options affichent chiffres reproductibles; non comparable reste signalé. |
| P0 | Alignement profil/demande/option | Fiche et contrôles déjà présents. | Objectif/capital confirmé quand nécessaire; métrique ou document réel. | Robert : tension expliquée; Amira : concentration examinée; aucune alerte d’achat sur simple curiosité. |
| P0 | Explication structurée à droite | UI preuves, onglets, sources, activité. | Références exactes aux résultats et méthodes. | Chaque conclusion factuelle ouvre sa preuve; chaque hypothèse porte une étiquette. |
| P0 | Reprise après question et traitement des erreurs | `ask_user`, événements et suivi recherche. | État de tâche/conversation persistant, erreurs traduites. | La réponse reprend le plan; l’échec donne un résultat partiel lisible, sans diagnostic Pydantic brut. |
| P1 | Comparaison avant/après de portefeuille fictif | Concentration et scénarios arithmétiques. | Instrument mapping et financement explicite. | Poids 100 %, budget conservé, delta d’exposition montré avec inconnues. |
| P1 | Sensibilité contrôlée | Simulation/scénarios et registre d’hypothèses. | Fenêtre et méthode figées, hypothèse modifiée enregistrée. | Une entrée change; système montre delta et explication sans modifier le profil en silence. |
| P1 | Allocations fictives alternatives | Futur constructeur déterministe + comparateur. | Ensemble admissible, contraintes explicites, règles/version, données couvertes. | Deux allocations explicables ou « aucune solution avec ces contraintes »; pas de solution forcée. |
| P1 | Fonds : holdings et chevauchement | Recherche et preuves; calculs à étendre. | Documents émetteurs datés, poids, devise, sous-fonds récursifs, couverture. | XSP/ZEQT : exposition réelle calculée si couverte, sinon borne/part inconnue. |
| P1 | ESG vérifiable par critère | Collecte qualitative, policy sources. | Préférence définie et données documentées pertinentes. | Mateo : résultat par critère et date; absence de preuve reste inconnue. |
| P1 | Journal de décision exportable | Résultats, événements et citations existants. | Provenance, méthodes, versions et questions/réponses. | Relecture possible après session; même calcul reproduit depuis le snapshot. |
| P2 | Suivi de changement | Dossiers enregistrés et sources autorisées. | Fréquence, freshness, droits, définition de changement matériel. | Un changement avéré explique quelle conclusion pourrait être revue. |
| P2 | Graphe des dépendances relié aux expositions | `inspect_supply_chain`, vues réseau. | Relation sourcée, portefeuille relié, distinction constat/hypothèse. | Montre l’exposition connue à un émetteur et ses relations publiées; ne convertit pas automatiquement lien en perte chiffrée. |

La livraison d’un dossier explicable et d’une comparaison vérifiée apporte plus immédiatement au parcours que l’ajout d’une nouvelle source sans consommateur. Les extensions restent pertinentes lorsqu’elles ferment une question ouverte de l’utilisateur.

## 6. Allocation fictive : une possibilité à exploiter correctement

Le défi permet d’aller jusqu’à une proposition simulée. Cela peut enrichir notre produit : après l’analyse, montrer plusieurs constructions illustratives, leurs règles, les compromis et les contraintes non satisfaites. Les traiter comme candidats à discuter pour des personas fictifs.

Construction recommandée : univers couvert → règles/contraintes explicites → génération déterministe d’un petit ensemble de candidats → validation budget/poids/contraintes → comparaison → explication par l’agent. Le modèle peut suggérer une structure de candidat étiquetée comme hypothèse; le calculateur la valide. Le modèle n’invente ni métriques, ni rendement attendu, ni règle officielle de risque.

**Exemple purement arithmétique, sans choix de titre ni recommandation :** portefeuille fictif de 100 unités, 40 sur A, 30 sur B, 20 sur C, 10 d’encaisse. Tester le transfert de 5 unités de l’encaisse vers D donne 40/30/20/5 sur A/B/C/D et 5 d’encaisse. Le poids du plus gros titre reste 40 %. L’agent doit l’expliquer : ajouter un titre ne réduit pas automatiquement la concentration dominante. Cet exemple ne démontre ni une baisse du risque global ni une amélioration de diversification des sous-jacents, car D peut recouvrir A/B/C. Aucun rendement de l’encaisse ou des actifs n’est supposé.

Comparer aussi le candidat financé par diminution de A : les effets diffèrent, donc la question de financement fait partie du modèle et non d’un détail d’interface. Si l’utilisateur ne précise pas ce financement, l’agent peut afficher deux hypothèses fictives explicitement distinctes au lieu de deviner une transaction.

Ne pas optimiser la performance passée pour désigner le gagnant. Préférer un tableau de compromis (concentration, liquidité documentée, expositions, coûts couverts, perte historique et stress sous hypothèses), sans score composite opaque. Aucune allocation n’est automatiquement « prudente » parce qu’un pourcentage d’encaisse ou d’obligations y figure. Un instrument non couvert ne reçoit pas une caractéristique inventée.

## 7. Trois scénarios qui exploitent réellement la plateforme

### Robert — une occasion médiatisée, un objectif de préservation

**Demande :** examiner un actif identifié par rapport au capital fictif du projet à 3–5 ans.

**Travail :** confirmer le lien au capital si nécessaire; collecter les données publiques utiles; distinguer fluctuations historiques et risques documentés; lire l’exposition actuelle du portefeuille associé si disponible; comparer statu quo et hypothèse d’exposition fournie ou clairement illustrative; expliquer les effets sur liquidité/concentration et les inconnues.

**Résultat :** une tension conditionnelle documentée, tableau de comparaison, graphique historique et question utile (« quelle conséquence sur le projet si ce capital baisse au moment du retrait? »). La capacité de perte peut rester inconnue sans bloquer les observations historiques.

**Preuve de réussite :** l’utilisateur comprend ce qui entre en tension, pourquoi et ce qui pourrait faire changer la lecture; il ne reçoit pas seulement une alerte ou un questionnaire.

### Amira — croissance technologique et crypto sans abandonner la diversification

**Demande :** comparer une nouvelle exposition à celles du portefeuille de démo et à une variante illustrative plus diversifiée.

**Travail :** examiner concentrations par titre/secteur/devise et exposition sous-jacente documentée; identifier chevauchements; vérifier calendrier crypto/actions et risques non couverts; étudier stress commun sans supposer indépendance des actifs.

**Résultat :** carte des expositions avant/après, chevauchement connu/inconnu et scénarios avec hypothèses. Risque élevé ne vaut pas approbation de toute concentration.

**Preuve de réussite :** un titre supplémentaire qui recouvre les mêmes expositions n’est pas appelé diversification; l’horizon long ne devient pas garantie de récupération.

### Mateo — des préférences ESG qui influencent réellement la comparaison

**Demande :** comparer deux fonds sur un critère explicite (p. ex. exclusion documentée) et des caractéristiques financières comparables.

**Travail :** définir le critère sans inventer un score global; rechercher documents de fonds et holdings datés; afficher conformité documentaire au critère, limites de couverture et compromis de frais/concentration quand mesurables.

**Résultat :** tableau critère par critère, sources/ dates, « non vérifiable » si manque. Le profil change la recherche effectuée, pas seulement la phrase finale.

**Preuve de réussite :** aucune qualification ESG depuis le nom du fonds; la comparaison reste utile même partielle. Des critères non financiers peuvent exclure ou laisser indécidable une option illustrative.

Ces scénarios sont des propositions d’évolution, pas des sorties live déjà exécutées. La démo principale peut montrer deux personas contrastés et garder le troisième comme cas d’approfondissement.

## 8. Agentique utile et partage des responsabilités

- Coordinateur : transforme la demande en décision à éclairer; choisit les tâches utiles, suit le budget/temps et les clarifications. Son plan est révisable si une donnée manque.
- Collecte : outils autorisés pour prix, documents, fonds, macro et autres sources nécessaires. Le collecteur déterministe n’est pas présenté comme un agent autonome.
- Moteur de calcul : métriques, financement, poids, conversion, scénarios, contrôle de contraintes. Reproductible et indépendant du texte généré.
- Vérification : contrôles déterministes des entrées/références et revue ciblée des interprétations, humaine ou via spécialiste selon le besoin. Un second modèle n’est pas une preuve indépendante.
- Explication/dialogue : relie résultats et contexte, produit le tableau et les pistes de discussion; distingue faits, scénarios et interprétations; fournit les conditions de changement.

Ces responsabilités peuvent être portées par un agent avec outils. N’ajouter un spécialiste que si cela ferme un manque précis et si son intervention peut être observée dans la trace. Les skills décrivent des procédures approuvées; ils ne donnent ni accès aux données ni preuve de calcul.

## 9. Mesurer que nous répondons au défi

| Dimension | Démonstration / contrôle proposé |
|---|---|
| Utilité | L’utilisateur peut nommer le compromis, comparer les options et identifier l’information suivante utile. Mesurer sur tâches de lecture, pas seulement une note d’esthétique. |
| Adaptation | Même données + profils contrastés → questions, contrôles et interprétations différents; mêmes faits. Tester aussi qu’une préférence non pertinente n’altère pas un calcul. |
| Crédibilité | Calculs reproduits depuis leurs entrées; erreurs de devise/dates bloquées; échec de collecte visible; comparaison équitable. |
| Explicabilité | Toute affirmation factuelle ouvre les données qui la soutiennent; aucune citation ne suffit si son contenu ne soutient pas l’affirmation. Hypothèses et interprétations identifiées. |
| Robustesse | Changement de fenêtre, hypothèse ou profil enregistré; on observe si la conclusion persiste, devient incertaine ou change, et pourquoi. |
| Innovation utile | Dossier interactif reliant profil, preuves, options et sensibilité; clic sur un point du graphe alimente une question contextualisée. |
| AWS | Parcours utilisé par la démo réellement exécuté avec services AWS, trace datée et rôle explicable. Auth/permissions et production sont vérifiés dans leur propre environnement. |
| UX/cadence | Temps jusqu’au premier constat utile et aux premières preuves, reprise après clarification, erreurs compréhensibles et affichage mobile. Ne pas confondre FCP local et latence de recherche. |

Scénarios négatifs : simple curiosité sans intention d’achat; plusieurs objectifs; portefeuille non associé; capacité inconnue; actif ambigu; holdings absents; demande impossible sous contraintes; donnée ancienne présentée comme actuelle; prix brut/ajusté mélangé; source en conflit; tâche interrompue; changement de persona pendant la recherche. Le résultat attendu est une limite utile, pas une réponse fabriquée.

## 10. Ordre de réalisation et preuve à chaque tranche

1. **Assembler le dossier partagé et la boucle de clarification.** Résultat attendu : profil/tour/options/preuves partagent un même contexte, la fiche reste visible, le travail reprend après réponse et les erreurs sont compréhensibles.
2. **Livrer une comparaison d’actifs ou de positions fictives sur données couvertes.** Résultat attendu : deux options et statu quo, méthodes communes, chiffres reproductibles et explication à droite.
3. **Ajouter la sensibilité et le contraste de personas.** Résultat attendu : une hypothèse change avec son delta explicite; mêmes observations utilisées pour deux profils.
4. **Étendre à l’allocation illustrative et au look-through/ESG selon la couverture.** Résultat attendu : candidats validés ou impossibilité expliquée, sans chiffres/propriétés supposés. L’allocation est une extension facultative de valeur, pas un préalable à l’admissibilité.
5. **Prouver le trajet AWS et terminer les quatre livrables.** Résultat attendu : démo, code/README, documentation et one pager racontent le même cas réellement opérationnel.

Avant toute implémentation dans les fichiers partagés, réconcilier les changements des worktrees indiqués dans [hackathon-alignment.md](hackathon-alignment.md). Ce document ne modifie ni les prompts ni les contrats actifs. La prochaine tranche doit intégrer les briques déjà présentes plutôt que créer une seconde recherche, un second modèle de preuve ou un second simulateur.
