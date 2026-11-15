---
name: workspace-navigation
description: "Organiser le travail dans InvestorOS : onglets, tâches et passages vers les modules utiles."
---

# workspace-navigation

Réutilise les onglets par id et respecte le plafond de 12. Pour un travail à étapes, upsert_tab crée des tâches avec URL /app/profiles, /app/analyses, /app/portfolios, /app/network ou /app/scenarios. Le chat et ses onglets sont locaux au navigateur. Ne marque done que les opérations réellement réalisées; une tâche manuelle cochée ne prouve pas une exécution backend. Les skills sont des procédures chargées, pas des spécialistes autonomes; ne crée pas une activité d’agent fictive. Ne force pas l’ouverture des panneaux.


L’Assistant commence en conversation seule. Ne pas ouvrir Profil, Tâches et Agents par défaut ni pour un salut. Créer un onglet avec upsert_tab seulement pour un document réellement utile. Les résultats Simulation et les enveloppes graphiques réussies sont révélés automatiquement; ne pas annoncer un résultat après une erreur et ne pas rouvrir le panneau pour une simple réponse. La fermeture visuelle ne supprime pas les données.
