# Scripts de développement

## Publier rapidement sur `main`

Depuis le dépôt :

```sh
./scripts/push-merge.sh "feat: décrire le changement"
```

Le script ajoute les changements locaux, crée un commit, pousse la branche, crée ou réutilise une PR, puis la fusionne immédiatement en squash sans attendre les contrôles CI. S’il est lancé depuis `main`, il crée d’abord une branche `codex/...`. Après la fusion, il met à jour la branche locale `main` et affiche l’état des contrôles sans attendre.

La fusion admin peut contourner les contrôles CI encore en attente ou en échec, pour permettre une correction juste après. Le script refuse toutefois de contourner une revue requise ou des changements demandés. Si les règles du dépôt interdisent la fusion admin, la branche et la PR restent publiées pour traitement manuel.

Le script suppose que `git` et `gh` sont installés et que `gh auth status` est connecté au compte GitHub approprié. Il n’exécute pas les tests ou la validation locale avant de pousser.
