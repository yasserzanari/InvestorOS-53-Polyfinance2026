# Revue de cohérence du profil

`assessProfile` adapte le moteur partagé `components/decision-panels/alignment-review.ts`. Assistant et Profil emploient les mêmes critères; aucune borne arbitraire «3 ans» ou «8 ans» ne permet de qualifier une incohérence.

- **Rouge — incohérence à clarifier** : les réponses décrivent explicitement la totalité du même capital comme indisponible avant une durée et nécessaire plus tôt. Les durées sont comparées dans la même unité. Un retrait partiel, un compte séparé, une négation, un conditionnel, une plage ou plusieurs projets empêchent ce constat automatique.
- **Ambre — point à clarifier** : tolérance émotionnelle élevée et incapacité déclarée à subir une perte compromettant le projet. Ces dimensions peuvent coexister; leur différence ne prouve pas une contradiction et n’invalide pas la réponse.
- **Information manquante** : aucune réponse exploitable. Une capacité qualitative connue reste connue même si le montant exact est à préciser.

Le rouge signale une contradiction bornée entre déclarations, pas une violation réglementaire, un risque de marché mesuré ou un verdict de convenance. Le moteur est lexical, volontairement conservateur et incomplet. L’absence d’alerte ne valide pas un profil. Les références justifient les distinctions financières; les formulations reconnues sont des choix de produit, pas des règles prescrites par les régulateurs.

Le validateur Python des cartes et des réponses contrôle aussi une dérive observée : transformer « une perte qui compromettrait mon projet est inacceptable » en capacité financière mesurée à zéro. Certaines affirmations de capacité « nulle » sont refusées lorsque cette valeur n’est pas explicitement déclarée, puis soumises à la reformulation bornée existante. Une déclaration explicite de zéro, une négation, une question ou une définition pédagogique restent distinctes. Ce garde-fou ciblé ne chiffre pas la capacité et ne certifie pas l’exactitude de toute interprétation générée.

## Fondements vérifiés

- [OCRI, Comprendre le risque](https://www.ciro.ca/office-investor/understanding-risk), section «Your Individual Risk Profile» : disposition émotionnelle et capacité financière s’évaluent séparément.
- [ACVM/OCRI, avis 31-368 du 10 décembre 2025](https://www.ciro.ca/media/15051/download), section A.1, pp.4–6 : une faible capacité peut coexister avec une tolérance élevée; discuter les informations incompatibles et en documenter la résolution. Section A.2, pp.7–8 : examiner les circonstances financières et besoins de liquidité.
- [AMF, Votre profil d’investisseur](https://lautorite.qc.ca/grand-public/outils-et-calculateurs/calculateurs/votre-profil-dinvestisseur), introduction et questions2–4 : différents comptes peuvent poursuivre différents objectifs et horizons. Les retraits prévus et l’objectif doivent être distingués.

Ces documents encadrent des pratiques professionnelles ou de l’éducation financière. Ils ne certifient pas InvestorOS. L’interface montre la source conceptuelle, les déclarations exactes et la question à résoudre, sans prétendre corroborer les déclarations par des documents de marché.

## Interaction et vérification

Chaque réponse est modifiable dans Alignement ou discutable dans le chat. Les sauvegardes réutilisent la mémoire du profil existante. Le snapshot de l’analyse reste historique; une édition ne le réécrit pas. Une synthèse périmée est repliée et doit être actualisée.

Le triangle ouvre un popover au survol, au clic et au clavier. Le popover contient l’explication, les réponses concernées, des actions d’édition/discussion et les liens des fondements financiers. Échap le ferme; il reste lisible quand le pointeur passe dessus.

Vérification :
```sh
node --test apps/web/src/features/profiles/profile-consistency.test.mjs apps/web/src/features/profiles/components/decision-panels/alignment-review.test.mjs
node scripts/test-assistant-decision-panels.cjs
```
