---
name: conditional-scenarios
description: Calculer une simulation conditionnelle avec les chocs, jalons, unités et horizon explicitement choisis, sans les modifier pour contourner une erreur.
---

# Simulations conditionnelles

Utiliser pour une simulation chiffrée explicitement demandée; une recherche d’entreprise ou de nouvelles relève de company-analysis et ne nécessite pas de chocs inventés.

## Entrées et capacités

- Lire get_simulation_capabilities avant un calcul sur un titre. Vérifier ready, supportedTickers et les limites du contrat. Si le dataset manque, expliquer la panne de configuration, sans demander à l’utilisateur de changer ses hypothèses ni inventer des cours.
- Conserver le ticker, les pourcentages signés, chaque jalon et l’horizon donnés par l’utilisateur dans ce tour ou ses messages précédents. Les exemples de l’assistant ne sont pas des choix de l’utilisateur. Une réponse choisie dans ask_user est une entrée utilisateur; une option non choisie ne l’est pas.
- Pour « +10 % après 10 jours sur un horizon de 30 jours », conserver exactement +10 %, J10, J30. Employer horizonDays:30 et eventAfterDays:10. Un jour calendaire n’est pas une séance de bourse.
- Pour des séances ou observations explicitement demandées, employer horizonObservations et eventAfterObservations. Ne fournir qu’une unité par demande et par branche; ne convertir ni arrondir l’horizon en silence.
- Une seule branche est valide. Ne pas ajouter une branche à 0 %, ni élargir 30 à 60, pour satisfaire une contrainte technique. Une référence sans choc doit être explicitement demandée pour devenir une branche. Les quantiles historiques sont déjà une référence de calcul, pas une hypothèse choisie à la place de la personne.
- Si une donnée indispensable manque réellement, appeler ask_user avec seulement cette donnée. Si tout est présent, calculer directement. Ne pas imposer un questionnaire pour les faits déjà donnés.

## Exécution et restitution

Chaque branche de project_market_scenarios exige id, title, shockPct et le jalon dans l’unité choisie. `event` est un libellé bref en français décrivant l’hypothèse fournie (par exemple « Choc hypothétique de −10 % »), pas l’affirmation d’un événement observé. Il est facultatif pour cet outil : le serveur reprend title en le qualifiant d’hypothèse s’il manque. Ne demande pas à l’utilisateur de rédiger ce libellé technique et n’invente pas une nouvelle hypothèse pour le remplir. Si une validation indique un paramètre financier manquant, demande uniquement la précision utile sans changer les chiffres fournis.

Appeler project_market_scenarios pour un titre; analyze_demo_scenario pour les positions du portefeuille, avec leurs identifiants et chocs explicites. Les bornes et champs retournés par le contrat sont la référence.

Si le serveur refuse user_intent_mismatch ou missing_user_assumptions, ne pas contourner le refus avec d’autres chiffres. Relire les messages utilisateur, corriger seulement une transcription erronée; demander via ask_user si un choix est ambigu. Une erreur de données absentes doit être annoncée comme telle et ne se résout pas en changeant l’horizon.

Après succès, rappeler les valeurs réellement calculées, leur unité, la date d’arrêt du dataset, sa classification et ses limites. Le cours de départ appartient au paquet historique configuré, pas au marché en direct. Un choc est une hypothèse conditionnelle; les quantiles marginaux ne sont ni des probabilités de scénario ni des prévisions individuelles cohérentes.

Le résultat réussi de project_market_scenarios crée automatiquement son onglet de visualisation. Ne pas fabriquer un onglet de réussite après un échec. L’utilisateur peut replier l’espace et retrouver son résultat. Pour une explication ultérieure, lire le résultat actif plutôt que recréer une simulation.
