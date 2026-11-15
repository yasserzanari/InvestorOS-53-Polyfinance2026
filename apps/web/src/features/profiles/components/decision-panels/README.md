# Résultats structurés dans l’Assistant

`ProfilesPage` dirige les onglets `kind: decision` vers `DecisionPanel`, avant le rendu des documents éditables. Le contenu JSON reste le format de stockage; il n’est jamais présenté comme un éditeur à l’investisseur.

- `decision-data.ts` valide les résultats `insight` et `comparison`. Les anciens documents sans discriminant ne sont récupérés que pour les identifiants `profile-alignment` et `profile-comparison`. Un résultat incomplet affiche une proposition de reprise dans le chat.
- `InsightPanel` présente le constat, les réponses actuelles, les limites, les pistes et les preuves liées. Il est partagé par Assistant et la vue Alignement de Profils. Un snapshot absent est distingué du profil actuel. Après modification, la synthèse historique est repliée et ses pistes sont désactivées jusqu’à actualisation. Le snapshot conservé reste inchangé.
- `AlignmentProfile` permet de modifier les huit réponses ou d’en discuter, via les fonctions de mémoire/chat existantes. Une saisie non enregistrée peut être annulée. Le composant est réinitialisé au changement de compte/conversation.
- `AlignmentExplanation` utilise le Popover de Base UI déjà installé : survol, clic, clavier, Échap, déplacement du pointeur vers l’explication et positionnement dans la fenêtre. Les modifications passent par les réponses du profil; les chiffres calculés et les sources historiques ne deviennent pas des valeurs éditables.
- `alignment-review.ts` distingue une incompatibilité explicite d’échéances pour la totalité du même capital (rouge), une distinction tolérance/capacité à discuter (ambre) et une réponse absente. Ses références AMF/OCRI justifient ces distinctions, sans constituer une validation réglementaire. Les vues historiques de profil réutilisent ce moteur via `profile-consistency.ts`; les anciens seuils de trois/huit ans sont supprimés. Voir [la méthode](../../profile-consistency.md).
- `ComparisonPanel` transforme les indices en base 100 du serveur en variations cumulées (`indice − 100`) pour l’affichage. Les métriques, dates communes, méthodes et sources restent celles du calcul serveur.

Les badges de statut adaptent la structure du composant archivé **Badge Tag / PrebuiltUI** du skill FrontUI. Les graphiques utilisent le kit Recharts déjà présent dans le projet. Aucune nouvelle dépendance ni source financière externe.

Les liens AMF/OCRI sont des fondements éducatifs de la revue des déclarations. Ils sont présentés séparément des preuves reçues par l’agent; leur présence ne signifie pas qu’un historique de marché a été consulté ni qu’une déclaration de l’investisseur a été vérifiée indépendamment.

La restauration asynchrone de l’historique conserve le profil courant, car la mémoire peut avoir déjà chargé des réponses plus récentes. L’historique ne réinjecte jamais le profil initial de démonstration après cette restauration. Le test de sauvegarde/rechargement impose cet ordre de réponses pour protéger cette régression.

Vérification locale : `npm run build --workspace apps/web`, puis `node scripts/test-assistant-decision-panels.cjs` avec le serveur Vite sur 5200 (ou `DECISION_WEB_URL`). Le script intercepte mémoire et réponse modèle, sans modifier de compte. Il couvre anciens résultats, profils périmés, données invalides, sources indisponibles, sélection de piste, comparaison et édition des notes. Une vérification du site publié est distincte de ce test déterministe.
