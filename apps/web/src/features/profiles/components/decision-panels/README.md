# Résultats structurés dans l’Assistant

`ProfilesPage` dirige les onglets `kind: decision` vers `DecisionPanel`, avant le rendu des documents éditables. Le contenu JSON reste le format de stockage; il n’est jamais présenté comme un éditeur à l’investisseur.

- `decision-data.ts` valide les résultats `insight` et `comparison`. Les anciens documents sans discriminant ne sont récupérés que pour les identifiants `profile-alignment` et `profile-comparison`. Un résultat incomplet affiche une proposition de reprise dans le chat.
- `InsightPanel` présente le constat, les déclarations enregistrées, les limites, les pistes et les preuves liées. Un snapshot absent est distingué du profil actuel. Un profil modifié désactive les pistes historiques et propose une actualisation. Les actions passent par l’envoi habituel du chat; elles ne déclenchent aucun ordre financier.
- `ComparisonPanel` transforme les indices en base 100 du serveur en variations cumulées (`indice − 100`) pour l’affichage. Les métriques, dates communes, méthodes et sources restent celles du calcul serveur.

Les badges de statut adaptent la structure du composant archivé **Badge Tag / PrebuiltUI** du skill FrontUI. Les graphiques utilisent le kit Recharts déjà présent dans le projet. Aucune nouvelle dépendance ni source financière externe.

Vérification locale : `npm run build --workspace apps/web`, puis `node scripts/test-assistant-decision-panels.cjs` avec le serveur Vite sur 5200 (ou `DECISION_WEB_URL`). Le script intercepte mémoire et réponse modèle, sans modifier de compte. Il couvre anciens résultats, profils périmés, données invalides, sources indisponibles, sélection de piste, comparaison et édition des notes. Une vérification du site publié est distincte de ce test déterministe.
