# Chaîne d’approvisionnement : architecture et plan de livraison

## Parcours concret

Dans le chat : « Montre la chaîne d’approvisionnement de Apple avec les revenus trimestriels de ses fournisseurs, les risques et annonces sourcés. » Le coordinateur appelle `inspect_supply_chain` avec `ticker: AAPL`. Le résultat ouvre **Chaîne · AAPL** dans le panneau droit, avec Graphe, Liste, Pressions et Événements. La personne sélectionne une entreprise, consulte la citation, ouvre le document, puis compare les revenus publiés du fournisseur.

## Réutilisation de la plateforme

| Étape | Exécution | Résultat vérifiable |
|---|---|---|
| Coordination | Assistant Bedrock, outils typés, skill `supply-chain` | Appel `inspect_supply_chain`, événements d’agent réels |
| Identité | Registre public SEC, résolution exacte ou nom unique | Ticker, nom légal et CIK; ambiguïté refusée |
| Documents | Listes fournisseurs HTML/PDF liées depuis le site officiel identifié dans Wikidata, rapports annuels et dépôts récents SEC; réutilisation de `research_snapshot` avec `analysis_id` | URL et passages réellement lus; aucune piste indexée présentée comme article lu |
| Relations | Spécialiste Bedrock via `run_skill_agent`, skill chargé dans le système | Fournisseur nommé, rôle, source et citation verbatim validée par le serveur |
| Chiffres | CompanyFacts SEC, concepts US-GAAP en USD | Revenus autonomes des deux derniers trimestres contigus, variation déterministe, dates et accession |
| Annonces fournisseurs | Dépôts 8-K/6-K des fournisseurs résolus, extraction Bedrock sourcée | Pression, opportunité ou information; tonalité explicitement interprétée |
| Logos | Recherche Wikidata, correspondance du nom exacte, propriété P154 | Image Wikimedia attribuée; icône de repli si absente ou inaccessible |
| UI | `SupplyChainTab`, intégré dans Assistant et Documents du Profil | Graphe sélectionnable, filtres, tableau, chronologie, liens HTTPS, états vides et clavier |
| Persistance | Contrat `WorkspaceTab kind=network`, conversations et mémoire existantes | Même dossier conservé avec les autres documents; taille bornée à 64 000 caractères |
| AWS | Worker chat asynchrone existant, délai 300 s, suivi 360 s | Déploiement du frontend et de l’API par les workflows main existants; aucune nouvelle infrastructure de collecte |

## Sémantique des chiffres et des pressions

Les milliards des lignes sont les **revenus du fournisseur**, pas les dépenses d’achat du client. Deux trimestres ne sont comparés que si la devise et le concept concordent et si les périodes sont autonomes et contiguës. Les cumuls annuels ne remplacent pas un trimestre manquant. Les IFRS, devises autres qu’USD et tags personnalisés ne sont pas convertis implicitement. Les montants non publiés restent inconnus.

Les relations ne déterminent ni volumes, ni dépendance, ni risque chiffré. Pressions et événements affichent les passages cités et la date du document. La classification de tonalité est une interprétation IA. Un risque hypothétique du rapport ne doit pas être formulé comme une rupture déjà survenue. Aucun impact simulé n’est fabriqué pour remplir les cartes.

## Couverture et limites opérationnelles

Le système accepte des noms/tickers génériques, sans registre de fournisseurs NVIDIA codé en dur. La collecte automatique associe les sociétés résolues dans EDGAR et les divulgations fournisseurs accessibles sur le site officiel. Les sociétés privées et émetteurs non couverts peuvent utiliser leurs divulgations officielles accessibles ou les documents déjà lus par le service de recherche autorisé via `analysis_id`; ce mécanisme n’ajoute pas un moteur Web universel. Une nouvelle recherche suit le plan approuvé de la plateforme. Un dépôt peut ne nommer aucun fournisseur. Le résultat doit alors expliquer sa couverture insuffisante et ne pas substituer un réseau de démonstration.

Les fournisseurs sans dépôt SEC compatible peuvent avoir une relation documentée mais aucun revenu comparable. Les actualités proviennent des documents lus, pas de toutes les nouvelles mondiales. Wikidata fournit une attribution de logo et non une certification financière; son nom d’entité peut être ambigu et le fallback reste disponible.

Les connexions SEC/Wikidata sont bornées en HTTPS sans redirections. La collecte des sites officiels suit au maximum huit pages de divulgations fournisseurs liées par le site retenu, dont les PDF. Chaque connexion vérifie les adresses DNS publiques puis fixe l’adresse de connexion en conservant la validation TLS du nom; les adresses privées, identifiants et ports arbitraires sont refusés. Les redirections canoniques et celles vers les PDF publics liés sont suivies, quatre au maximum, avec une nouvelle validation DNS/TLS à chaque étape. Les médias et types non documentaires sont écartés. Le modèle ne choisit pas de destination réseau. Les sources réutilisées sont celles lues par la recherche du compte actif. Un extrait financier inaccessible, une citation absente ou un JSON non valide ne produit pas de fait vérifié.

## Validation et publication

Avant fusion : tests des citations, résolution, calculs trimestriels, périodes manquantes, SSRF, résultat sans couverture, entreprise hors NVIDIA et contrat SSE agent/onglet; suite API; build TypeScript/production; parcours navigateur des quatre vues, filtre, détail fournisseur, liens et persistance. Les fixtures navigateur sont étiquetées comme telles et ne prouvent pas un appel Bedrock.

État vérifié le 16 novembre 2026 : le code et les skills sont fusionnés sur `main`, snapshot 1.8.26, frontend et API/worker publiés sur AWS. Les workflows CI et les deux déploiements du commit `0a1e8b94fb78e4ccbd36410ec88c31ff64396692` sont réussis. Le navigateur et `/v1/profiles/status` servent le snapshot 1.8.26 avec transport asynchrone.

Le parcours navigateur public authentifié NVIDIA a terminé sans erreur : ouverture automatique, quatre vues, six fournisseurs avec citation validée, deux séries financières, neuf constats, six documents, puis restauration du dossier et des messages après rechargement. Une exécution antérieure avait accepté sept fournisseurs; l’extraction est bornée et partielle, pas un inventaire exhaustif. Le contrôle API public Apple en 1.8.26 a terminé sans erreur avec huit fournisseurs, onze constats et sept sources dont la liste officielle FY2023. Aucun revenu trimestriel comparable n’a été rempli artificiellement pour Apple. Ces essais ne certifient pas la couverture de toute entreprise ou de toute période.

Les tests ont révélé et permis de corriger trois défauts : tableaux parfois encodés en texte par le spécialiste; recopie inutile du dossier déjà publié dans `upsert_tab`, avec dépassement de sortie; sauvegardes concurrentes susceptibles de bloquer le chat après une déconnexion. Le serveur décode une liste JSON au maximum une fois, peut demander une seule correction avec les mêmes preuves et conserve les contrôles de citation. `inspect_supply_chain` possède la publication du dossier; l’outil générique ne peut pas remplacer un document `network`. Les sauvegardes finales de conversation sont ordonnées, bornées en retries et ne désactivent plus le chat après un échec d’autosauvegarde. Le changement de conversation attend toujours la sauvegarde avant d’effacer l’ancien état.

Validation locale finale du runtime : 333 tests API réussis; build TypeScript/production et contrôles CI API/frontend/Terraform verts. `scripts/test-conversation-writer.cjs`, ajouté à la CI, vérifie retries bornés, ordre des snapshots, refus d’autorisation et reprise après échec. `scripts/test-supply-chain-workspace.cjs` vérifie les quatre vues, sources, filtres, restauration, sauvegarde retardée pendant un changement de conversation et absence de chevauchement de cartes aux noms longs dans le détail fournisseur. Ces fixtures sont explicitement illustratives.

`scripts/test-supply-chain-deployed.cjs` exécute une vraie demande Bedrock via le site/API AWS avec `SUPPLY_TICKER=NVDA` ou `AAPL`. Les identifiants proviennent du fichier local ignoré `apps/api/.env.codex-test.local` ou de `COGNITO_TEST_SECRETS`; ils ne sont jamais affichés. Ce test crée seulement une tâche éphémère de chat et ne remplace pas la mémoire ni les conversations du compte. `SUPPLY_REPORT_PATH` conserve un résumé sans jeton ni mot de passe; `SUPPLY_TRACE_PATH` peut conserver les événements et citations pour une revue locale.

Les listes fournisseurs historiques conservent leur exercice dans le titre quand le document le précise (exemple réel lu : liste Apple FY2023). Leur lecture en 2026 ne les transforme pas en liste actuelle. Les banques souscriptrices et trustees d’une émission obligataire sont exclus des fournisseurs opérationnels.
