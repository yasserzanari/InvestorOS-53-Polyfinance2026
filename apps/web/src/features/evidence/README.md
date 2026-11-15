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

## Catalogue API Anything et profils X

`SourceExplorer` charge le catalogue installé via `/v1/simulation/source-catalog` et les opérations documentées via `/source-operations/{site}`. Le serveur exécute uniquement `sites`, `ops` et `call x getUser` avec API Anything 0.4.0, sans shell, avec validation des identifiants et délai maximal de 35 secondes. Ce runtime nécessite Node et npx sur le serveur; il doit être intégré à l’image d’exécution pour un déploiement AWS.

La recherche X attend un username exact. Les champs absents restent indisponibles. L’opération locale `x-public-timeline.getRecentPosts` lit les données Relay intégrées au HTML public du profil X via API Anything. `scripts/read-x-posts.mjs` extrait les publications de l’auteur, écarte les citations imbriquées et trie par date; un tweet épinglé ne devient pas automatiquement le plus récent. La recette est versionnée dans `apps/api/src/investoros_api/source_specs/`. Les résultats constituent la liste publique partielle renvoyée par X, sans garantie d’exhaustivité. Aucune clé X n’est nécessaire pour cette lecture. Le bouton Actualiser recharge les données (cache de lecture maximal de 60 secondes). Les profils précédemment enregistrés sont enrichis automatiquement.

Les préférences Sources, le dernier résultat, les recherches et les profils autorisés sans limite de nombre sont enregistrés via GET/PUT `/v1/simulation/source-workspace/{account}`. Le serveur local les conserve dans SQLite (`SOURCE_WORKSPACE_DB`, par défaut `~/.local/share/investoros/sources.sqlite3`). Simulation relit la liste sur le serveur et répartit les requêtes X par groupes de cinq. Les personas démo ne constituent pas une authentification de production. Pour AWS, monter un volume persistant ou remplacer ce stockage par DynamoDB avant déploiement Lambda.

## Sélection et apprentissage de sources

Le sélecteur affiche les sources installées avec recherche et suppression en un clic. La suppression retire une source de la liste du compte, sans effacer les recettes partagées par les autres comptes; `hidden_sources` et `learning_job` sont persistés côté serveur.

« Ajouter » ouvre un dialogue natif : URL HTTPS publique, puis activité de l’agent à gauche et captures réelles du navigateur à droite. `/v1/simulation/source-learning/{account}` démarre un processus local (240 secondes maximum) et conserve le journal dans `~/.local/share/investoros/source-learning`. Les captures PNG sont intégralement décodées, avec validation CRC, puis publiées par renommage atomique. Les requêtes aux réseaux privés sont bloquées. Un seul navigateur apprend à la fois.

Le planificateur Bedrock configuré choisit un groupe de pages comparables; en cas d’indisponibilité, la sélection automatique est annoncée dans le journal. API Anything inspecte deux exemples et vérifie un troisième. Une réparation HTML de lecture est tentée lorsque les captures le permettent. Seules les opérations passant le holdout et le replay public sont annoncées comme terminées. Les opérations sont locales au serveur (`API_ANYTHING_LOCAL_ONLY=1`); aucun apprentissage n’est publié au catalogue. Le navigateur est visible via des captures périodiques, pas une session interactive contrôlable par l’utilisateur. Les pages demandant une connexion ou une interaction complexe peuvent échouer explicitement.

Dépendances d’exécution locales : Node 22.13+, API Anything 0.4.0, pngjs 7, Chrome et l’environnement Python de l’API. Pour AWS, fournir un worker navigateur avec stockage persistant avant déploiement.

## Sources retirées du produit

`apps/api/src/investoros_api/source_policy.json` retire globalement 51 sources du catalogue et de la consultation d’opérations, tout en conservant `nasa-images`. Cette règle s’applique indépendamment des suppressions personnelles de chaque compte et du bouton de restauration.

Le service AWS ECS `investoros-dev-research/api-anything` applique la même sélection aux sources embarquées avec `serve --sites …`. Révision appliquée : `investoros-dev-api-anything:3` (63 sources embarquées autorisées). Le catalogue local comporte aussi trois opérations/sites locaux supplémentaires. Pour changer cette sélection, mettre à jour la politique et régénérer la liste autorisée à partir des sites embarqués, en préservant les autres paramètres du service ECS.

### Stockage AWS des profils autorisés

En AWS, `SOURCE_WORKSPACE_TABLE=investoros-dev-accounts` sélectionne DynamoDB. L’espace est enregistré dans l’attribut `source_workspace` du compte déterminé par `context_for(persona)`, sans modifier le payload du compte. Le rôle de l’API doit disposer de `dynamodb:GetItem` et `dynamodb:UpdateItem` sur cette table uniquement. Les routes restent protégées par l’authentification administrateur existante. En local, SQLite reste utilisé lorsque cette variable n’est pas définie.

Les profils institutionnels fédérale américaine, Banque du Canada, Statistique Canada français, BLS et SEC ont été ajoutés au compte Mateo dans les deux environnements. Une lecture de profil peut omettre son type de badge ou son URL : `read-x-profile.mjs` conserve ces champs comme facultatifs.
