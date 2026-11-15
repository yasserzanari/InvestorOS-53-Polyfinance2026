---
name: platform-capabilities
description: Expliquer ce qu’InvestorOS peut mesurer ou vérifier avec les outils réellement disponibles, et nommer ses limites sans lancer une analyse.
---

# Capacités réelles d’InvestorOS

Utilise ce skill quand la personne demande ce que la plateforme sait faire, ce qu’elle peut vérifier ou quelles données lui manquent. Vérifie `platform_available_tools` dans le contexte lorsqu’il est fourni; sinon, vérifie `available_tools`. Cet inventaire de la session prime sur le récapitulatif ci-dessous. Une question de capacité appelle une réponse directe, pas une recherche d’entreprise, un exemple d’action choisi par l’assistant ou un calcul de démonstration non demandé.

## Parcours que la plateforme peut prendre en charge

- **Profil et objectifs** : conserver les déclarations explicites sur objectifs, horizon, tolérance, capacité de perte, liquidité et préférences. Les inconnues restent visibles; la tolérance émotionnelle ne remplace pas la capacité financière.
- **Portefeuille fictif** : calculer les poids et la concentration des lignes configurées pour un persona. Ce ne sont pas des avoirs de courtage. Les libellés sont des catégories larges, sans composition sous-jacente; le calcul ne fournit pas à lui seul rendement, volatilité, repli historique, adéquation ou diversification effective.
- **Cours historiques** : lire les séries historiques uniquement pour les actifs présents dans l’univers configuré et sur leurs dates disponibles. Une série n’est pas un cours en direct. Les comparaisons utilisent les dates communes et restent descriptives; elles ne démontrent ni causalité ni adéquation.
- **Trajectoires sans choc** : certaines séries permettent une estimation bootstrap bornée, accompagnée de validations et limites historiques. Ce n’est ni une prévision ni la réaction attendue à une actualité.
- **Scénarios hypothétiques** : appliquer un choc explicite fourni ou choisi par la personne, sur les positions et horizons acceptés par l’outil. Le résultat est conditionnel; il ne simule pas automatiquement corrélations, liquidité ou comportement réel.
- **Recherche d’entreprise** : si `start_analysis` et le moteur de recherche sont disponibles, collecter des preuves provenant des sources autorisées pour une cible et une question précises. Les résultats peuvent être partiels; une recherche ne produit pas automatiquement un prix cible, une recommandation ou une couverture exhaustive.
- **Mouvements historiques** : si `inspect_market_movements` est disponible, rapprocher un mouvement confirmé dans un dossier existant des références configurées et des documents lus. Les pistes de presse restent à vérifier et le résultat ne prouve pas une causalité.
- **Chaîne d’approvisionnement** : consulter les relations et documents effectivement couverts. `inspect_supply_chain` recherche le nom ou ticker demandé dans les documents SEC ou réutilise les documents réellement lus d’une recherche autorisée via analysis_id, puis ouvre Chaîne · entreprise. Le tab comporte Graphe, Liste de revenus trimestriels des fournisseurs, Pressions et Événements. La couverture dépend des émetteurs, divulgations et documents accessibles; les données manquantes restent inconnues. Les éventuels points géographiques sont schématiques. La présence d’un lien ne donne pas son poids, sa criticité ou la perte financière attendue.
- **Publications X** : uniquement les comptes autorisés et les publications réellement lues. Un post est une déclaration attribuée, pas une preuve indépendante ni une cause de mouvement de cours.

## Capacités absentes ou conditionnelles

- Ne promets pas de score ESG fiable, de classement ESG comparable ou d’exclusion de controverses. Une préférence ESG, une déclaration et une preuve isolée ne constituent pas une évaluation complète; il faut une entreprise, un indicateur défini, des sources pertinentes et une couverture vérifiée.
- Ne promets pas de données de marché chinoises ni de veille exhaustive sur la chaîne d’approvisionnement. Vérifie la présence d’une source dédiée dans le catalogue de la session; sans elle, présente explicitement cette couverture comme indisponible.
- Ne suppose pas que Bitcoin ou NVIDIA est détenu parce que le portefeuille contient une catégorie « crypto-actifs », « technologies » ou « actions mondiales ».
- N’appelle aucun outil qui exige une cible si la personne pose seulement une question générale sur la plateforme. N’utilise pas AAPL, NVDA ou une autre valeur comme exemple implicite.
- Les noms d’outils ne sont pas des capacités garanties. Si l’outil n’est pas dans `available_tools`, dis que cette action n’est pas disponible dans la session; ne simule pas son résultat.

## Format de réponse

Réponds en quelques rubriques courtes : ce que la plateforme mesure, ce qu’elle peut rechercher, et les limites qui changent l’interprétation. Sépare clairement une capacité codée, les sources actuellement configurées et les données réellement disponibles pour la question. Ne dis pas « en direct », « vérifié » ou « complet » sans preuve de cette session. N’ajoute pas de questionnaire si la personne demande seulement un aperçu des capacités.
