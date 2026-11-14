# Sources et méthode

`EvidencePage` donne accès aux fournisseurs actuellement utilisés et aux limites qui conditionnent la lecture des résultats. La page charge `GET /v1/simulation/assets` au montage et affiche la provenance, la date d’extraction, l’univers et les limites retournés par l’API. En cas d’échec, elle signale l’indisponibilité sans remplacer le statut par une valeur de démonstration.

## Fournisseurs référencés

- L’historique de prix et les événements d’entreprise viennent du paquet local configuré pour Simulation. Un lien Yahoo Finance permet de consulter le titre correspondant; ce lien ne représente pas une archive immuable du paquet local.
- Les dépôts SEC, les actes du Federal Register et les articles GDELT sont chargés par Simulation à la demande. Leur carte documente le fournisseur et son domaine de validité; elle ne promet pas que le fournisseur répondra pour chaque émetteur ou requête.
- X Recent Search est désactivé par défaut, limité à sept jours et potentiellement facturable. La carte renvoie à sa documentation et précise que les publications et médias ne sont pas vérifiés.
- Les comptes de portefeuille Amira, Mateo et Robert sont fictifs. Leur provenance DynamoDB et leurs limites sont expliquées dans les notes de méthode lues par l’Assistant; ces fixtures ne sont pas connectées à un courtier.

Les fournisseurs sont déclarés dans le tableau `sources` de `EvidencePage.tsx`. Toute nouvelle source doit préciser si elle est primaire ou secondaire, ses dates et limites, sa documentation directe, son statut de configuration et si elle influence un calcul. Ne pas déduire une disponibilité réelle d’un lien de documentation.

## Méthodes affichées

La page reprend les règles de Simulation : les rendements après une date ne sont pas des impacts causaux; les scénarios sont conditionnels à des chocs utilisateur; les quantiles historiques ne sont ni probabilités, ni prévisions, ni trajectoires conjointes. La méthodologie détaillée et les entrées sont affichées près des résultats dans Simulation.

La route `/app/evidence` est dédiée à cette page et exclue du fallback de destinations préparatoires de `ModuleLanding`. Les fournisseurs et les méthodes restent génériques et ne dépendent d’aucun persona ni ticker particulier.
