---
name: portfolio-visual-widgets
description: Afficher dans le chat le portefeuille actif, ses positions, sa répartition, ses gains et pertes ou les variations par secteur avec des données serveur.
---

# Montrer le portefeuille dans la conversation

Utilise ce parcours pour « montre mon portefeuille », « affiche mes positions en carte de chaleur », « où est mon argent ? », « qu’est-ce qui fait varier mon portefeuille ? » ou « montre la variation par secteur ». Il affiche un widget directement dans le chat ; aucun onglet ni dossier de recherche n’est nécessaire. Une demande d’adéquation au profil relève de portfolio-exposures ; une comparaison historique de titres relève de historical-market ; un choc conditionnel relève de conditional-scenarios.

Appelle réellement `render_portfolio_widget` avec seulement `view` et `period`. Choisis la vue selon la question :

| Besoin | view |
|---|---|
| Valeur du portefeuille et courbe | portfolio |
| Positions, poids et variations en tuiles | heatmap |
| Répartition de l’argent | allocation |
| Gains et pertes apportés par chaque position | contributions |
| Variations regroupées par secteur | sectors |

Les périodes autorisées sont `1D`, `1W`, `1M`, `1Y` : jour, semaine, mois, année. Reprends celle donnée dans la demande ou le contexte. Sans période précisée, utilise `1M` pour portfolio et `1D` pour les autres vues ; ne bloque pas un simple affichage par un questionnaire. Si une période explicite ne correspond pas à ces choix, utilise `ask_user` plutôt que de la remplacer silencieusement.

Le serveur choisit le compte actif et construit les données. Ne fournis aucun compte, ticker, montant, poids, rendement, secteur, série, HTML ou JavaScript dans les arguments. Un libellé « actions mondiales », « technologie », « obligations » ou « crypto-actifs » ne révèle pas les instruments détenus. Un fonds ne révèle pas ses composants ni son exposition sectorielle : conserve la part non couverte renvoyée. N’invente ni prix historiques, ni taux de change, ni gains pour remplir une courbe ou une carte. Une valeur indisponible n’est pas zéro.

Pour les contributions, changeValue mesure le gain ou la perte monétaire de la position; contributionPct mesure son impact en points sur le portefeuille de début de période. changePct est la variation propre de la position, jamais sa contribution au portefeuille. Ne les confonds pas.

Lis l’état, les dates, la devise, la classification et les limites du résultat. Une période demandée peut manquer d’historique commun ou de conversion FX ; conserve ces limites, sans substituer une autre période, un actif voisin ou une estimation mémorisée. Une sortie partielle ne justifie pas un total exhaustif. Une visualisation de démonstration reste fictive ; un historique ne devient pas une cotation en direct. Les variations observées ne prouvent pas la cause de ces variations.

Le widget n’est affiché que si l’outil confirme le résultat. En cas d’erreur ou d’outil absent, dis brièvement ce qui manque ; ne prétends pas avoir ouvert une vue. Pour une simple demande visuelle, le widget et une phrase utile suffisent. Utilise les mots « valeur », « part », « hausse », « baisse », « gains » et « pertes » ; n’expose pas les noms d’outils, les identifiants techniques ni le journal d’exécution dans la réponse. Ne recopie pas toutes les lignes du widget en prose et ne transforme pas le résultat en conseil d’achat, vente ou réallocation.
