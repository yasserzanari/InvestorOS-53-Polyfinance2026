---
name: visualization-authoring
description: Composer des cartes InvestorOS à partir de composants approuvés et de données calculées côté serveur, avec références et versions vérifiables.
---

# Composer une vue d’analyse

Lis `get_analysis_view_options` pour identifier les vues réellement possibles et leurs limites pour cette analyse. Utilise `get_ui_component_registry` pour connaître les composants et leurs schémas de paramètres, puis `read_analysis_workspace` pour lire l’analyse autorisée et sa révision. Choisis un composant selon la question et les données disponibles. Les outils sont liés au compte et à l’analyse par le serveur; n’ajoute aucun identifiant de compte, rôle ou droit dans leurs paramètres.

`publish_ui_component` accepte une référence de composant, un emplacement, un titre, des paramètres et `expectedRevision`. Le serveur calcule ou lit les données, valide le résultat et conserve sa provenance. Ne fournis ni prix, ni série, ni HTML/JavaScript, ni image illustrative pour remplir une carte. Les observations historiques ne sont pas des cotations actuelles; une simulation exige des hypothèses utilisateur explicites et des unités temporelles exactes.

Pour `market_history`, relève le ticker explicitement présent dans le contexte autorisé, puis choisis une période autorisée et les calques utiles. N’invente pas de ticker de remplacement. Pour `research_summary`, utilise les preuves conservées de l’analyse; ses paramètres sont vides et son résultat peut être partiel. Le modèle ne réécrit pas les preuves dans le payload de publication.

Pour le parcours complet d’une recherche existante, utilise `prepare_analysis_journey` si cet outil est disponible. Il ajoute uniquement les vues manquantes et conserve les paramètres déjà publiés; ne crée pas une seconde recherche ni un second onglet pour le même identifiant. La référence sur cinq observations est sans choc et part de la dernière clôture, distincte de la semaine civile recherchée.

Pour `market_forecast`, utilise le bootstrap serveur en observations avec sa validation chronologique et sa date source. Une référence zéro sans choc est permise; toute branche non nulle d’un agent conserve les hypothèses explicitement demandées. Les quantiles et la couverture historique ne sont pas des probabilités futures ni des réactions prédites aux événements.

Pour `analysis_view`, fournis seulement `{view}` parmi les vues disponibles. Le serveur valide l’enveloppe existante ou construit un graphe à partir de relations structurées réellement sourcées pour cette entreprise. La référence NVIDIA relue reste limitée à NVIDIA. Sans coordonnées, seul le graphe est proposé; sans relation, aucune carte n’est créée. Les repères sont des pays schématiques; les risques inconnus restent inconnus. Une enveloppe invalide ou un autre titre sans couverture ne peut pas être remplacé par des données inventées.

Avant une modification, lis la révision actuelle et conserve l’intention de la carte. Un conflit exige une relecture. Si un autre acteur a changé le même emplacement, conserve son travail et signale le conflit. Si seul un autre emplacement a changé, le runtime peut réessayer une fois la même intention après synchronisation. Les identifiants d’acteur et d’idempotence sont attribués par le serveur.

Une carte n’est publiée que lorsque l’outil confirme son identifiant, sa version et la révision du tableau. En cas de données absentes ou d’outil indisponible, conserve les autres cartes et expose la limite; une description de carte n’est pas une publication.


`research_events` prend des paramètres vides et expose uniquement les événements datés des preuves, même sans cours disponible. Quand un historique inclut déjà ces événements, réutilise sa carte. Ne confonds pas date annoncée, date de publication et clôture observée.
