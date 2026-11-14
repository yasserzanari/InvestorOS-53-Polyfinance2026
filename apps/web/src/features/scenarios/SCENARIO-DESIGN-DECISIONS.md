# Décisions de conception — Simulation et démonstrations

Ce document relie les références visuelles préparatoires aux données et interactions réellement disponibles. Il sert à faire évoluer les scénarios sans construire une page dédiée à Amira, Mateo, Robert ou à un ticker particulier.

## Références examinées

Les captures locales se trouvent dans `docs/prep/references-visuelles/` et ne sont pas distribuées avec l’application.

| Référence | Élément utile | Limite des données actuelles | Décision |
|---|---|---|---|
| `cartes-scenarios-agents.png` | Comparer plusieurs hypothèses côte à côte et ouvrir leur détail. | Les cartes représentent des équipes d’agents, des émetteurs suivis et des scénarios qui ne sont pas produits par le moteur Simulation. | Garder les branches génériques et leurs courbes calculées; ne pas reproduire la chaîne d’agents ni fabriquer des émetteurs. |
| `graphe-orchestration-agents.png` | Relier une demande aux étapes et aux preuves visibles. | Un graphe agentique complet et durable relève de l’implémentation des agents de recherche, confiée à DEV2. | Ne pas ajouter de faux nœuds, de progression ou de dépendances dans Simulation. |
| `espace-agents-3d.png` | Montrer une équipe comme espace spatial. | Aucun besoin opérationnel ou événement de données n’est mieux expliqué par une scène 3D; elle masquerait la traçabilité et l’accessibilité. | Ne pas intégrer la scène 3D à ce module. |
| `portefeuille-analyse.png` | Densité analytique : série temporelle, allocation, positions et indicateurs liés. | Les métriques de cette capture et les séries de portefeuille affichées ne sont pas fournies pour les personas. Les positions fictives ne sont pas reliées aux tickers du jeu historique. | Ne jamais reprendre ses valeurs. Garder le module Portefeuilles distinct du graphique historique Simulation. |
| `reseau-approvisionnement-risques.png` | Naviguer entre événements, preuves et exposition d’une chaîne. | Le jeu courant ne contient aucun graphe fournisseur, coût logistique, score de pression, niveau de service ou estimation d’impact par composant. | Ne pas dessiner de réseau ni d’impact fournisseur avant d’avoir des relations et des sources vérifiables. |
| `reseau-approvisionnement-tarifs.png` | Relier une règle à des composants et afficher des scénarios comparables. | Un acte du Federal Register ne prouve pas l’exposition commerciale d’un émetteur; aucune nomenclature de produits, origine douanière ou dépendance fournisseur n’est fournie. | Afficher le document réglementaire, ses dates et son texte source; laisser l’utilisateur expliciter une hypothèse de choc dans le moteur générique. |

## Système de Simulation à préserver

1. L’actif et l’historique viennent de l’univers chargé par l’API, avec source, date d’extraction, devise et période visibles.
2. Les dividendes/fractionnements et dépôts SEC sont des observations datées; leurs sources s’ouvrent. Le Federal Register fournit des documents réglementaires, pas une conclusion d’applicabilité.
3. GDELT est une source secondaire de découverte. Les vignettes éventuelles ne sont pas une preuve visuelle de l’événement.
4. X Recent Search est optionnel et désactivé par défaut. Quand l’exploitant l’active et configure son jeton, la recherche porte sur le nom et le symbole de l’émetteur pour les sept derniers jours. La personne peut aussi fournir jusqu’à cinq comptes à inclure; l’application ne valide pas leur identité et n’en découvre aucun. Une publication et ses médias sont des déclarations publiques à vérifier; ils ne sont ni un événement de prix ni un facteur de calcul.
5. Les rendements postérieurs sont des comparaisons temporelles quand les observations existent. Ils ne mesurent pas un effet causal.
6. Les trajectoires sont calculées par le backend à partir des rendements historiques du même titre et de chocs explicitement saisis. Les quantiles de chaque jalon sont marginaux; les courbes ne constituent pas des trajectoires conjointes, des probabilités ou des prévisions.
7. L’Assistant reçoit uniquement la sélection et les résultats disponibles lors du relais. Il peut expliquer, demander une précision et préparer des tâches liées aux modules; il ne prétend pas exécuter une action que l’API ne prend pas en charge.

## Recette réutilisable pour ajouter un scénario de démonstration

Ajouter une entrée dans `PERSONA-SHOWCASE.md` avec :

- le persona ou le profil fictif et les faits réellement disponibles;
- un prompt utilisateur adaptable, sans réponse pré-écrite présentée comme un résultat du modèle;
- les outils et sources qui doivent être appelés pour répondre;
- l’information manquante qui déclenche une question interactive;
- les surfaces à montrer : conversation, onglet, source cliquable, actif/événement ou simulation générique;
- le résultat attendu en termes de comportement, les limites à afficher et les affirmations interdites;
- les étapes de vérification, incluant le cas où une source est désactivée ou indisponible.

Ne pas ajouter un champ, une branche de calcul ou une règle de rendu nommée d’après un scénario. Si un nouveau cas exige un comportement métier durable, définir son contrat générique puis l’exercer avec le scénario.
