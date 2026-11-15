---
name: company-analysis
description: "Analyser une entreprise ou un titre pour un horizon donné : recherche sourcée, événements, fondamentaux et risques."
---

# company-analysis

Une demande « analyser NVDA la semaine prochaine » est une demande de recherche, pas automatiquement une projection de prix. Charge `analysis-planning` pour clarifier l’intention et obtenir la validation du périmètre avant `start_analysis`. Identifie entreprise, question et horizon; demande seulement les précisions qui changent les sources ou la méthode. Ne demande pas de chocs arbitraires pour autoriser cette recherche. Après validation, lance `start_analysis` avec une question explicite qui inclut les faits utiles du profil actif et les axes approuvés. Conserve analysis_id, puis consulte get_analysis_status ou get_analysis_result lors du suivi. Running ou partial n’est pas completed. Présente faits sourcés, événements datés, risques et informations manquantes. Ne prédis pas le cours. Si le moteur est indisponible, dis-le et propose l’historique réellement disponible. Une réponse de lancement ne constitue pas une analyse terminée.

## Exécution et critères de réussite

- Une demande explicite d’analyse ne lance pas immédiatement start_analysis : propose d’abord le plan et attends la validation du périmètre. Une fois validé, lance réellement start_analysis; décrire un plan sans identifiant confirmé ne remplit pas la demande.
- Transmets l’horizon relatif sans inventer de dates : le moteur le résout par rapport à son horloge. Demande une recherche en français, couvrant calendrier officiel à venir, communiqués récents, fondamentaux datés, risques et points de surveillance.
- Utilise les outils pertinents de la plateforme : collecte primaire SEC et émetteur, calendriers officiels pour un horizon futur, calcul historique déterministe et documents RAG disponibles. Les outils de profil/portefeuille ne sont nécessaires que si le contexte personnel ou les expositions changent l’analyse. Les simulations conditionnelles exigent une demande de projection et des hypothèses explicites; ne les lance pas pour remplir une liste d’outils.
- Inspecte coverage et execution_status : l’exécution peut être terminée et la couverture partielle. N’annonce jamais une analyse complète lorsque le calendrier demandé, les preuves ou la synthèse manquent.
- Montre le suivi dans Agents, Skills utilisés et Résultats de recherche. Les faits futurs sont des événements annoncés, jamais des résultats financiers ou des variations de cours anticipés.

- Lorsque l’utilisateur demande d’afficher le parcours d’une analyse existante et que son résultat est disponible, utilise `prepare_analysis_journey` si présent dans les outils autorisés. Réutilise son UUID et son onglet. Les événements annoncés gardent leurs dates et preuves; une carte géographique exige des relations documentées. Une estimation de référence reste distincte de la semaine étudiée et des chocs hypothétiques.

- Conserve clairement le seul émetteur étudié dans la question transmise à start_analysis; évite les mentions comparatives ou négatives d’autres sociétés qui pourraient détourner une collecte mono-entreprise. Pour afficher un résultat disponible, consulte get_analysis_view_options puis laisse orchestrate_analysis_ui choisir les vues utiles. Un calendrier spécialisé ou un réseau absent doit rester explicitement indisponible.
