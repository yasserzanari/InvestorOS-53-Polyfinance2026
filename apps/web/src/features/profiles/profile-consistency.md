# Revue de cohérence du profil

`assessProfile(profile)` est une fonction pure. Elle expose les champs incomplets,
le nombre de champs renseignés et des points à clarifier avec leurs valeurs exactes.
Les alertes sont recalculées à chaque modification manuelle ou issue de Bedrock.

Les règles signalent uniquement des associations explicites : horizon de trois ans
ou moins et forte tolérance; horizon d’au moins huit ans et retrait proche; forte
tolérance et conséquences financières lourdes d’une perte. Une négation comme
« aucun retrait à court terme » n’établit pas un besoin de retrait. Toute mention
« à préciser » conserve le champ parmi les informations manquantes, même si le
reste de la réponse est renseigné.

Il s’agit d’une revue de formulaire déterministe, pas d’un conseil financier, d’une
validation de convenance ou d’un score de risque. L’absence d’alerte signifie
seulement qu’aucune des règles actuelles ne correspond au texte. Les seuils sont
explicites et modifiables dans ce module; les phrases ambiguës restent à examiner.

Vérification locale : `node --test apps/web/src/features/profiles/profile-consistency.test.mjs`
(Node 24, prise en charge native de TypeScript).
