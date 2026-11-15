# Dossier d’analyse

`AnalysesPage` ouvre les recherches du compte actif. `AnalysisDossier` organise le résultat autour du graphique existant, de la synthèse, des preuves et des vues Entreprise, Événements, Carte, Dépendances, Simulations et Activité. Les vues de marché, réseau et rapport réutilisent les composants du produit.

`ResearchActivity` construit les intervenants depuis les événements réellement reçus. Les connexions du canevas proviennent des tâches émises par le planificateur; les nœuds ne représentent pas des identités humaines. Sélectionner un nœud filtre le journal. Le lecteur montre les documents extraits et les données structurées; il ouvre le site original dans un nouvel onglet. Il ne représente pas une session vidéo du navigateur. Le libellé API Anything vient de la méthode enregistrée sur la preuve.

Le suivi lit l’API toutes les quatre secondes pendant une exécution, avec au plus 40 lectures automatiques, puis propose une reprise manuelle. Une erreur de rafraîchissement conserve les données déjà reçues. Le pont `research_snapshot` récupère aussi les preuves d’une recherche en cours, sans attendre la synthèse. Aucune nouvelle analyse n’est créée par cette lecture.

Les compteurs viennent des preuves, événements et constats reçus. Le nombre de critères documentés est une mesure de couverture, pas une note de fiabilité. Photos et visuels sont affichés seulement lorsqu’une source fournit une URL d’image; sinon un pictogramme contextualise le document.

Validation locale : `npm run typecheck`, `npm run build`, tests API et `node scripts/test-analysis-dossier.cjs`. Le test navigateur lit un dossier existant, contrôle ses sources, événements, agents, carte, dépendances et mobile, puis rejoue ses données pour vérifier les résultats partiels et une panne de rafraîchissement. Ce rejeu est uniquement un test; le produit affiche l’API réelle. Les captures du test sont décodées avec contrôle CRC PNG avant publication. Cette évolution n’a pas été déployée sur AWS dans cette intervention.

Références de conception : les références locales `docs/prep/ui-dashboard/analyses.png` et `docs/prep/references-visuelles/graphe-orchestration-agents.png`, conservées hors Git. Le composant 21st adapté est documenté dans `registry/README.md`.
