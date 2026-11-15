---
name: market-movement-investigation
description: Examiner pourquoi un titre a fortement monté ou baissé sur une période passée en reliant ses clôtures, les références de marché et les documents datés d’un dossier existant.
---

# Examiner un mouvement historique

Utilise ce parcours lorsque la personne demande pourquoi un titre a monté ou baissé pendant une période déjà écoulée. Il complète une analyse existante; il ne lance pas `start_analysis` et ne demande pas une validation de plan pour ce seul rapprochement. Consulte d’abord `list_research_analyses` si l’identifiant du dossier n’est pas déjà dans le contexte. Puis appelle `inspect_market_movements` seulement avec un dossier auquel le titre demandé est effectivement rattaché.

## Vérifications

- Vérifie les deux clôtures ajustées, leurs dates, le fuseau de marché et la classification de la série. Si une clôture manque ou si la place n’est pas prise en charge, ne conclus pas sur le mouvement.
- Compare les références retournées sur le même intervalle et dans la même devise. SPY et QQQ sont des repères larges, peuvent contenir le titre étudié et ne contrôlent pas tous les facteurs du marché.
- Examine les documents lus et datés avant la clôture. Distingue un événement confirmé, un document de contexte, un calendrier futur, une date incertaine et une piste de presse indexée dont le contenu n’a pas été lu.
- Relie une interprétation à l’extrait exact qui la soutient et à son heure de publication. Une annonce postérieure à la séance ne peut pas expliquer le mouvement observé ce jour-là.
- Si les données ne montrent aucun facteur spécifique, indique qu’aucun déclencheur n’est établi dans les documents examinés. Ne remplis pas ce vide avec une explication de marché générique.

## Limites et restitution

Présente d’abord la variation mesurée, puis les comparaisons pertinentes et seulement ensuite les pistes documentaires. Distingue observation, document, interprétation et hypothèse. Ne dis jamais qu’une information a causé le mouvement : la proximité temporelle ne mesure pas sa contribution et les clôtures ne montrent pas les mouvements intrajournaliers.

La collecte d’actualités officielles supplémentaires dépend du titre et de la politique de source active. Dans le déploiement documenté, le lecteur officiel complémentaire ne couvre que les communiqués NVIDIA; pour les autres titres, l’outil peut seulement rapprocher les preuves déjà présentes. Les pistes GDELT sont des entrées d’index non vérifiées, pas des preuves. Si le contenu est indisponible, dis-le.

La méthode ne fournit pas les flux d’ordres, positions, options, attentes de résultats, mesures sectorielles détaillées ni données de marché chinoises dédiées. N’infère pas une exposition à la Chine à partir d’une mention de pays, d’un titre de presse ou d’une relation fournisseur déclarée. Les comparaisons restent limitées aux séries effectivement configurées.
