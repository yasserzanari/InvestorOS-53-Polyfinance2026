---
name: analysis-ui-orchestration
description: Choisir les vues InvestorOS selon les preuves disponibles et coordonner leurs publications réelles sans doublons ni données inventées.
---

# Coordonner les vues d’une analyse

Cette procédure s’applique à une analyse existante et autorisée. Un skill ne confère aucune permission. Vérifie les outils disponibles avant d’agir.

Le coordinateur lit `get_analysis_view_options` pour connaître les identités confirmées, composants disponibles et raisons d’indisponibilité. Il ne déduit pas un ticker d’un exemple ou d’un nom approximatif. Une synthèse ou des événements peuvent être disponibles sans cours; un réseau peut être consultable sans coordonnées. Une carte exige des positions documentées et une estimation exige un historique suffisant.

`orchestrate_analysis_ui` lance un planificateur Bedrock réel qui choisit une à quatre options utiles et donne une justification courte par choix. Le serveur refuse les options indisponibles ou redondantes. Les événements déjà inclus dans un historique ne demandent pas une seconde carte; une seule carte réseau expose ses différents modes. Une recherche encore en cours doit attendre ses preuves avant ce choix.

Chaque option retenue et manquante est assignée à un spécialiste réel dans un emplacement distinct. Le runtime charge les skills du rôle, le registre et le tableau. Le spécialiste publie exactement les paramètres fournis par le serveur; il ne fournit ni prix, ni série, ni choc supplémentaire. Le ticker et les références restent ceux de cette analyse. Les emplacements existants sont conservés.

Une sélection ou une publication n’a réussi que lorsque son outil l’a confirmé. Les traces visibles conservent les opérations, acteurs, versions, révisions et erreurs réels. Les raisons de sélection sont de courtes justifications de produit, jamais du raisonnement privé.

Le runtime borne les tours, sorties et reprises de conflit. Une défaillance laisse les autres cartes accessibles et un état partiel explicite. Ne lance pas une autre collecte pour remplir une vue manquante et n’écrase pas un emplacement modifié par un autre acteur. Une explication de courbe lit son snapshot/version et ne demande pas de nouvelle orchestration.
