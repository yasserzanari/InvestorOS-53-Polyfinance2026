# Chaîne d’approvisionnement : architecture et plan de livraison

## Parcours concret

Dans le chat : « Montre la chaîne d’approvisionnement de Apple avec les revenus trimestriels de ses fournisseurs, les risques et annonces sourcés. » Le coordinateur appelle `inspect_supply_chain` avec `ticker: AAPL`. Le résultat ouvre **Chaîne · AAPL** dans le panneau droit, avec Graphe, Liste, Pressions et Événements. La personne sélectionne une entreprise, consulte la citation, ouvre le document, puis compare les revenus publiés du fournisseur.

## Réutilisation de la plateforme

| Étape | Exécution | Résultat vérifiable |
|---|---|---|
| Coordination | Assistant Bedrock, outils typés, skill `supply-chain` | Appel `inspect_supply_chain`, événements d’agent réels |
| Identité | Registre public SEC, résolution exacte ou nom unique | Ticker, nom légal et CIK; ambiguïté refusée |
| Documents | Rapports annuels et dépôts récents SEC; réutilisation de `research_snapshot` avec `analysis_id` | URL et passages réellement lus; aucune piste indexée présentée comme article lu |
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

Le système accepte des noms/tickers génériques, sans registre de fournisseurs NVIDIA codé en dur. La collecte automatique concerne les sociétés résolues dans EDGAR. Les sociétés privées et émetteurs non couverts peuvent utiliser les documents déjà lus par le service de recherche autorisé via `analysis_id`; ce mécanisme n’ajoute pas un moteur Web universel. Une nouvelle recherche suit le plan approuvé de la plateforme. Un dépôt peut ne nommer aucun fournisseur. Le résultat doit alors expliquer sa couverture insuffisante et ne pas substituer un réseau de démonstration.

Les fournisseurs sans dépôt SEC compatible peuvent avoir une relation documentée mais aucun revenu comparable. Les actualités proviennent des documents lus, pas de toutes les nouvelles mondiales. Wikidata fournit une attribution de logo et non une certification financière; son nom d’entité peut être ambigu et le fallback reste disponible.

Les connexions HTTP sont bornées à SEC et Wikidata, en HTTPS sans redirections, avec délais et taille maximum. Le modèle ne choisit pas de destination réseau. Les sources réutilisées sont celles lues par la recherche du compte actif. Un extrait financier inaccessible, une citation absente ou un JSON non valide ne produit pas de fait vérifié.

## Validation et publication

Avant fusion : tests des citations, résolution, calculs trimestriels, périodes manquantes, SSRF, résultat sans couverture, entreprise hors NVIDIA et contrat SSE agent/onglet; suite API; build TypeScript/production; parcours navigateur des quatre vues, filtre, détail fournisseur, liens et persistance. Les fixtures navigateur sont étiquetées comme telles et ne prouvent pas un appel Bedrock.

État au développement : code et skill implémentés; registre SEC et recherche de logo Wikidata joints réellement depuis l’hôte. Le build et les tests sont exécutés avant la publication du PR. L’état AWS final dépend des workflows après fusion et doit être vérifié séparément; un test local ne prouve pas le déploiement ni un résultat réel du spécialiste Bedrock.
