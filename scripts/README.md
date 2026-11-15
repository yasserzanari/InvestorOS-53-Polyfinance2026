# Scripts de développement

## Publier rapidement sur `main`

Depuis le dépôt :

```sh
./scripts/push-merge.sh "feat: décrire le changement"
```

Le script ajoute les changements locaux, crée un commit, pousse la branche, crée ou réutilise une PR, puis la fusionne immédiatement en squash sans attendre les contrôles CI. S’il est lancé depuis `main`, il crée d’abord une branche `codex/...`. Après la fusion, il met à jour la branche locale `main` et affiche l’état des contrôles sans attendre.

La fusion admin peut contourner les contrôles CI encore en attente ou en échec, pour permettre une correction juste après. Le script refuse toutefois de contourner une revue requise ou des changements demandés. Si les règles du dépôt interdisent la fusion admin, la branche et la PR restent publiées pour traitement manuel.

Le script suppose que `git` et `gh` sont installés et que `gh auth status` est connecté au compte GitHub approprié. Il n’exécute pas les tests ou la validation locale avant de pousser.

## Vérifier un parcours NVDA existant

Avec le frontend et l’API démarrés et une analyse NVDA terminée pour Mateo :

```sh
npx playwright install chromium
INVESTOROS_TEST_ANALYSIS_ID=<uuid> node scripts/test-analysis-journey.cjs
```

`INVESTOROS_TEST_URL` change l’URL locale (défaut `http://127.0.0.1:5175`). `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permet de réutiliser un Chromium déjà installé. Le test lit une recherche AWS existante, calcule localement une simulation et vérifie les interactions, le rechargement, le mobile et les onglets Agents/Skills/Résultats. Il ne lance pas de nouvelle recherche. Les captures utilisent des noms uniques, une validation CRC et un décodage navigateur avant publication atomique.

Pour vérifier spécifiquement la présentation du graphique et du rapport :

```sh
INVESTOROS_TEST_ANALYSIS_ID=<uuid> node scripts/test-analysis-presentation.cjs
```

Ce test vérifie les courbes et bandes réellement dessinées, les aperçus d’événements au survol et au clavier, les sources compactes, les dates et périodes financières, le mobile et les images optionnelles. Les cas d’image utilisent des données contrôlées distinctes des captures du parcours réel.

Pour vérifier l’utilisation de l’espace et le réseau de dépendances :

```sh
INVESTOROS_TEST_ANALYSIS_ID=<uuid> node scripts/test-network-presentation.cjs
```

La recette couvre aussi le redimensionnement du chat, les détails en superposition, les sources par carte, le filtrage par fonction, le clavier et la largeur des tableaux. Les mêmes variables d’URL et de navigateur s’appliquent.

Pour vérifier l’espace de comparaison des simulations :

```sh
INVESTOROS_TEST_ANALYSIS_ID=<uuid> node scripts/test-simulation-workspace.cjs
```

La recette calcule une référence et plusieurs hypothèses avec l’API réelle, contrôle les écarts attendus, le moment d’application, les horizons, les sources et les jalons cliquables, la persistance, la suppression et le clavier mobile. Elle injecte ensuite une panne, une réponse incohérente et un retard pour vérifier la reprise, le rejet et l’annulation des calculs dépassés. Elle ne lance pas de recherche supplémentaire.
