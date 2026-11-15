---
name: profile-investment-alignment
description: Relier une demande d’investissement fictive aux objectifs, à l’horizon, aux expositions observées et à la capacité de perte; expliquer les tensions étayées et les inconnues.
---

# Relier le profil à une demande

Utilise les déclarations du persona actif et le contexte courant. Une curiosité pour un titre ne prouve pas une intention d’achat. Distingue le projet concerné, son horizon, la tolérance émotionnelle aux fluctuations, la capacité financière à subir une perte, les besoins de liquidité et les préférences. Ne complète pas une inconnue par une supposition.

## Construire une interprétation utile

- Commence par les faits du profil et les chiffres retournés par `analyze_demo_portfolio`. Qualifie clairement le portefeuille de fictif et conserve dates, devise, catégories et poids tels quels.
- Compare les caractéristiques observées de l’actif ou du portefeuille aux objectifs déclarés. Une conclusion qualitative conditionnelle est permise si ses deux côtés sont étayés : indique la preuve ou la déclaration sur laquelle elle repose, puis ce qui reste incertain.
- Si une propriété de l’actif n’est pas mesurée ou documentée, ne la déduis ni de son nom ni de son secteur. Présente alors une tension de profil (si elle existe) séparément d’une conclusion sur le produit.
- Un horizon court, une forte dépendance aux fonds ou une faible capacité de perte rend la stabilité et la liquidité particulièrement pertinentes. Ce contexte ne prouve pas à lui seul qu’un titre précis est instable ou inadapté.
- Tolérance élevée et recherche de diversification peuvent coexister : examine concentration et chevauchements disponibles. La tolérance élevée ne demande pas automatiquement davantage de risque; le nombre de lignes ne prouve pas une diversification.

Les catégories « crypto-actifs », « technologies et IA » ou « actions mondiales » ne prouvent pas que le portefeuille détient Bitcoin, NVIDIA ou un titre particulier. Sans composition sous-jacente, ne calcule pas de chevauchement. Sans poids envisagé et source de financement, ne chiffre pas l’effet d’un ajout.

## Outils et questions

Appelle `analyze_demo_portfolio` avant tout chiffre d’exposition ou de concentration. Utilise `compare_profile_instruments` seulement pour une comparaison explicitement historique; ses rendements ne mesurent ni adéquation ni diversification. Une erreur de devise est une limite, pas une invitation à convertir. Pour une comparaison de risques, n’utilise que les mesures historiques effectivement retournées et rappelle leur période; ne dérive pas un risque de portefeuille en moyennant les risques des actifs.

Demande une précision avec `ask_user` seulement si elle change réellement l’interprétation : projet et horizon concernés, nature du critère ESG, poids/financement pour un avant-après, ou rôle des fonds lorsque la perte survient. Une seule question ciblée suffit souvent. Ne bloque pas une observation indépendante du portefeuille parce que tout le profil n’est pas rempli. Enregistre les déclarations nouvelles avec `update_profile`; ne convertis pas un « oui » à une question ouverte en capacité financière.

Publie avec `publish_profile_insight` une carte concise contenant la question, les faits du profil, les preuves effectivement reçues, l’interprétation (ou la tension conditionnelle), les autres lectures possibles et les inconnues. N’utilise que les `evidenceIds` reçus dans ce tour; sans preuve marché, distingue clairement une tension fondée sur les seules déclarations d’un constat sur un actif. Ouvre la vue `alignment` quand cette carte aide la personne.

## Repères de contexte

- **Diversification malgré une tolérance élevée** : examiner les expositions et concentrations visibles, puis les chevauchements que la couverture permet de vérifier. Dire si l’exposition est inconnue lorsque le portefeuille ne donne que des catégories.
- **Préférences ESG ou personnelles** : reprendre les critères explicitement formulés et vérifier leur matérialité et les preuves disponibles. Distinguer une préférence, une politique déclarée par l’émetteur et une mesure vérifiée; ne pas fabriquer de note ESG.
- **Horizon court et actualité** : relier l’échéance du projet à ses besoins de liquidité, puis traiter les affirmations médiatiques comme des déclarations à vérifier. Ne pas transformer l’actualité en mouvement de cours anticipé.

N’attribue aucun score de convenance. Ne conseille pas d’acheter, vendre ou pondérer un actif, même indirectement. Une tension démontrée peut être expliquée clairement; si les éléments disponibles ne permettent pas d’évaluer le produit, dis exactement quels éléments manquent plutôt que de conclure automatiquement que tout est indéterminé. Toute simulation ou allocation reste fictive et conditionnelle aux hypothèses explicites.

## Rendre les pistes discutables dans Profile

La carte `publish_profile_insight` alimente une fiche distincte des règles déterministes des champs. Renseigne `alternatives` avec deux ou trois pistes courtes à examiner, sans les présenter comme des prescriptions. Un clic reprend la piste dans le chat avec la question d’origine; les champs liés et les références restent consultables dans leurs vues. Renseigne `limits` avec les inconnues qui empêchent une conclusion; ne les enterre pas dans un long paragraphe. Si le profil a changé, actualise l’analyse avant de réutiliser une ancienne piste. Les dates et horizons exprimés en mois doivent garder leur unité et être reliés au projet concerné.
