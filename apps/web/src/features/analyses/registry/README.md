# Source du composant

`ToolCallsSection.tsx` est une adaptation du composant enregistré **Tool Calls Section** de heygaia, ID 20123, récupéré avec `21st get 20123 --json` le 15 novembre 2026.

Source : https://21st.dev/@heygaia/components/tool-calls-section

Structure de dépliage, pile d’icônes et chronologie conservées. Les adaptateurs remplacent les dépendances de l’application d’origine par Lucide et un rendu de texte/JSON du projet, sans exécuter le contenu des outils. Libellés traduits et attributs de dépliage accessibles ajoutés. Les entrées proviennent exclusivement des événements `skills_loaded` du serveur; ce panneau n’affiche pas de raisonnement interne.
