# Architecture du code

Ce document explique comment les principaux morceaux d’InvestorOS s’assemblent. Il complète les README locaux des modules. Pour le schéma AWS et les procédures Terraform, voir [architecture d’exécution et déploiement](runtime-and-deployment.md).

## Vue d’ensemble

Le dépôt est organisé autour d’une interface web, d’une API Python et d’infrastructure décrite séparément :

| Zone | Responsabilité | Entrée utile |
| --- | --- | --- |
| `apps/web` | Interface React, TypeScript et Vite; routes, vues, état UI et adaptateurs HTTP | [`App.tsx`](../../apps/web/src/app/App.tsx) |
| `apps/api` | API FastAPI; validation, logique métier, appels Bedrock et accès aux données | [`main.py`](../../apps/api/src/investoros_api/main.py) |
| `services/workflows` | Définitions AWS Step Functions pour les travaux orchestrés | [`analysis/`](../../services/workflows/analysis/) |
| `infrastructure/terraform` | Ressources AWS, IAM, configuration et stacks par environnement | [`environments/`](../../infrastructure/terraform/environments/) |
| `agent-skills` | Prompts versionnés, outils et instantanés de compétences utilisés par les agents | [`README`](../../agent-skills/README.md) |
| `scripts` | Démarrage local, empaquetage de l’API et outils de maintenance | [`README`](../../scripts/README.md) |

## Parcours d’une requête

1. `apps/web/src/app/App.tsx` crée le routeur, charge les pages à la demande et installe les fournisseurs d’authentification et de compte de démonstration.
2. Les pages sous `apps/web/src/features/` composent l’expérience d’un module. `apps/web/src/shared/` contient le shell, l’accès API, l’authentification et les primitives utilisées par plusieurs modules.
3. Les adaptateurs du frontend envoient les requêtes vers l’API. La configuration Vite distingue les appels de développement local des appels du mode AWS; les clés et secrets ne sont pas placés dans le navigateur.
4. `apps/api/src/investoros_api/main.py` construit FastAPI et branche les routeurs de profils, conversations, tâches, recherche, connaissances, simulation, sources et administration. Mangum expose la même application sous forme de handler Lambda.
5. Les routeurs valident les entrées, puis délèguent le travail aux services du domaine. Ceux-ci lisent les données autorisées et, selon la fonction, appellent DynamoDB, Bedrock, S3 ou un worker externe.
6. Les traitements longs utilisent des tâches/queues et des workers plutôt que de garder une requête navigateur ouverte. Le statut et les résultats sont persistés puis relus par l’interface.

## Où se trouve la logique produit

- `apps/web/src/features/profiles/` : espace de travail du profil et conversation avec l’assistant. Le contrat serveur de l’agent est décrit dans [profile-agent-contract.md](profile-agent-contract.md) et le module possède aussi son [guide de travail](../../apps/web/src/features/profiles/WORKBENCH.md).
- `apps/api/src/investoros_api/profiles/` : routes, modèles, décisions, mémoire, analyses de mouvements et travaux du profil.
- `apps/web/src/features/portfolios/` et les modules `profiles/portfolio*.py` : vues de portefeuille, mesures déterministes, expositions et interprétation contextualisée.
- `apps/web/src/features/analyses/`, `analysis-workspace/` et `analysis-interactions/` : dossiers d’analyse, sources, résultats et interactions de preuve.
- `apps/web/src/features/scenarios/`, `simulation-workspace/` et `apps/api/src/investoros_api/simulation.py` : scénarios conditionnels et calculs associés.
- `apps/web/src/features/network/` et `apps/api/src/investoros_api/knowledge/` : relations d’entreprises, fournisseurs, documents et événements de chaîne d’approvisionnement. Voir le [guide de la chaîne](../product/supply-chain-workspace.md).
- `apps/web/src/features/evidence/` et `apps/api/src/investoros_api/research/` : pièces justificatives, provenance et collecte de sources selon les politiques configurées.

Chaque module peut avoir son propre `README.md`; ces fichiers sont la référence pour ses détails d’implémentation et ses commandes spécifiques.

## Données et limites

Les routes de démonstration utilisent des personas, comptes et portefeuilles fictifs. Les séries calculées doivent rester déterministes et traçables aux paramètres d’entrée. Une publication proche d’un mouvement de prix donne du contexte, mais ne démontre pas une causalité. Les valeurs manquantes, la couverture partielle et les hypothèses doivent rester visibles dans l’interface.

Ne déduisez pas le statut opérationnel d’une fonction uniquement de son composant UI ou de son code serveur. Vérifiez séparément :

1. le code présent;
2. les ressources et permissions décrites dans Terraform;
3. le déploiement réel de la stack concernée;
4. un appel ou parcours de bout en bout daté.

La [matrice d’alignement](../product/hackathon-alignment.md) conserve ces distinctions.

## Modifier le code sans dupliquer une fonction

1. Lire les consignes du module (`AGENTS.md`, `README.md` et contrats applicables).
2. Suivre le flux déjà en place depuis la route UI jusqu’au routeur API et au service de domaine.
3. Garder les calculs financiers purs et testables hors des composants de présentation.
4. Ajouter ou modifier le contrat API et sa source de vérité avant de copier des champs dans plusieurs vues.
5. Mettre à jour les README/contrats concernés et noter le statut réel de la vérification.

Les règles générales sont dans [`AGENTS.md`](../../AGENTS.md); le vocabulaire de conception UI est dans [le contrat UX](../design/ux-contract.md).
