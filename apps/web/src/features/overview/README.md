# Dashboard InvestorOS

`DashboardPage` est la vue d’accueil de `/app`. Elle présente l’état des modules, les étapes suivantes et un accès au chat; l’envoi d’une question ouvre le chat avec une transition. Le panneau de contexte reste visible pendant la conversation.

## Données et limites

Cette vue ne branche pas encore de données de portefeuille ni de service d’analyse. Les cartes montrent donc des états d’initialisation explicites. Ne pas ajouter de chiffres, d’alertes de risque ou de graphiques de marché simulés comme s’il s’agissait de données de compte. Les résultats pourront être affichés quand les API de profil, portefeuille, sources et analyses seront intégrées.

## Saisie

`DashboardPrompt` réutilise le composant `AdvancedChatInput` archivé depuis le skill `frontui`. Le bouton micro utilise l’API de reconnaissance vocale du navigateur si elle existe et affiche un message si elle n’est pas disponible. Le message utilisateur est affiché dans le chat; aucune réponse d’agent n’est fabriquée en attendant le branchement du backend.

## Graphiques et bookmarks 21st.dev

Aucun des bookmarks consultés ne convient à cet écran sans données réelles ou sans altérer le thème établi : Finance Bento et Stock Portfolio Card supposent des avoirs, prix et performances; Balance Chart et System Status affichent des séries de démonstration; Stats Card est conçu pour des revenus de freelance. Le tableau utilise donc des états vides utiles au lieu de rendre ces exemples comme des résultats financiers.

## Évolution

Brancher les cartes et le panneau de contexte sur les contrats API réels, puis remplacer les états vides par les données vérifiées. Garder le conteneur de l’application ajusté à la hauteur de la fenêtre; seuls les panneaux internes peuvent défiler lorsque leur contenu dépasse l’espace disponible.
