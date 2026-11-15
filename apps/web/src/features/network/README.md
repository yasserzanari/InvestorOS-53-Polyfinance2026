# Réseaux d’entreprises

La route `/app/network` est un registre de relations que la personne saisit elle-même. Le paquet de données actuel ne fournit aucun réseau fournisseur vérifiable; la page ne préremplit donc ni n’invente d’entreprises, de flux ou d’exposition.

## Contrat de registre

Chaque entrée contient une organisation, une contrepartie, un type de relation, une classification choisie par l’utilisateur, une date facultative et un extrait facultatif. Les classifications sont « source primaire fournie », « source secondaire fournie » et « hypothèse à vérifier ». Les deux premières exigent un titre et une URL HTTPS; l’interface valide le protocole et refuse les identifiants intégrés à l’URL, mais ne vérifie ni le contenu ni l’autorité du document. L’hypothèse peut être enregistrée sans source et reste visiblement marquée comme non vérifiée.

Les données sont stockées sous `investoros.network.evidence.v1.<accountId>` dans `localStorage`. Elles ne sont ni envoyées à AWS ni synchronisées entre appareils. Changer de persona donne accès à un registre local distinct. La suppression efface l’entrée de ce navigateur.

## Relais vers l’Assistant

« Examiner avec l’Assistant » transmet les deux entités, le type de relation, le titre et l’URL fournis, ainsi que l’extrait saisi. Le prompt précise que l’Assistant ne peut pas ouvrir cette URL avec ses outils actuels. Il peut analyser l’extrait, relever les lacunes et créer des tâches de vérification; il ne peut pas certifier la relation, enrichir un graphe à partir du web ou déduire un impact financier.

Pour connecter un graphe externe, il faut d’abord choisir une source autorisée qui fournisse des relations et leurs références, définir la fraîcheur et les droits d’accès, puis valider l’isolation par compte et la provenance côté API avant de remplacer ce registre local.
