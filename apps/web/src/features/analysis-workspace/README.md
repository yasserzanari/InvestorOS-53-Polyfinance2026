# Visualisations d’analyse dans l’Assistant

Ce module rend un même résultat structuré sous cinq formes : chronologie géographique, propagation, scénarios, dépendances et simulateur. Il réutilise le shell et les onglets InvestorOS. Le registre de vues est déterministe : une vue n’est disponible que lorsque ses entrées requises existent.

## Fichiers et contrat

- `types.ts` : formes TypeScript partagées et noms des cinq vues.
- `schema.ts` : validation Zod stricte, bornes, dates, identifiants, références et capacités. `parseAnalysisResult(unknown)` retourne un résultat validé ou une erreur lisible. `getAvailableViews(result)` indique les vues compatibles.
- `sample.ts` : jeu illustratif Northstar, ouvert volontairement pour examiner les interfaces. Il ne doit jamais remplacer une réponse API absente ou en erreur.
- Le module API `investoros_api.visualizations` contient le contrat Pydantic équivalent. `describe_visualization_contract()` retourne le JSON Schema et les instructions d’alimentation; `validate_visualization(payload, active_persona)` valide puis contrôle le compte; `available_views(result)` applique les mêmes critères que le frontend.

Le contrat est versionné avec `schemaVersion: "1.0"`. Les objets refusent les champs non prévus. Les chaînes sont bornées, les nombres finis, les pourcentages compris entre 0 et 100 et les références vérifiées. Les identifiants sont uniques au sein de leur collection. Un schéma valide ne prouve pas l’exactitude d’une affirmation : la vérification des sources reste une étape du moteur de recherche.

## Ce que les agents doivent remplir

| Objet | Champs requis | Champs facultatifs / interprétation |
| --- | --- | --- |
| Résultat | `schemaVersion`, `analysisId`, `resultVersion`, `accountId`, `title`, `company`, `question`, `asOf`, `horizonDays`, `currency`, `costUnit`, `provenance`, `status`, `summary`, `limitations` et les cinq collections | `simulation`; `provenance` vaut `research` ou `illustrative`; `status` vaut `completed` ou `partial`. Une nouvelle exécution doit recevoir une version ou un identifiant distinct. |
| Entité | `id`, `label`, `kind`, `risk`, `detail`, `evidenceIds` | `country`, coordonnées **ensemble**, `tier`, `share` en pourcentage. Types : fournisseur, composant, site, port, produit ou politique. Un siège n’est pas une usine. |
| Relation | `id`, `source`, `target`, `kind`, `label`, `risk`, `evidenceIds` | `share` en pourcentage, `delayDays` non négatif. Types : `supply`, `transport`, `impact`, `alternative`. Le sens source → cible doit correspondre à la preuve. |
| Événement | `id`, `title`, `date`, `entityIds`, `severity`, `detail`, `evidenceIds` | `endDate` ne précède pas `date`. Décrire explicitement s’il s’agit d’un événement observé ou d’une hypothèse future. |
| Scénario | `id`, `label`, `kind`, `description`, `cost`, `delayDays`, `servicePct`, `evidenceIds`, `assumptions`, `series`, `edgeIds` | Les scénarios comparés partagent unité, devise, horizon et périmètre. Le type vaut `base`, `adverse` ou `mitigation`. |
| Point de série | `day`, `value` | `lower` et `upper` sont fournis ensemble et encadrent `value`. Les jours croissent strictement, entre 0 et `horizonDays`. Une fourchette n’est pas une probabilité. |
| Preuve | `id`, `title`, URL HTTP(S), `publisher`, `publishedAt` | `excerpt` est du texte, jamais du HTML exécuté. Les sources privées doivent être exposées par une route d’accès contrôlé avant d’être rendues cliquables. |

Les dates sont au format ISO strict (année 0001–9999, heure 00–23, décalage horaire valide, fraction de seconde limitée à trois chiffres) : `2026-11-14` ou `2026-11-14T15:00:00Z`. `currency` est un code majuscule à trois lettres; `costUnit` décrit le dénominateur exact, par exemple `USD / servomoteur`. Les identifiants acceptent lettres, nombres, `_`, `.`, `:`, `-`, jusqu’à 120 caractères. Le compte du résultat doit être celui déterminé par le serveur, jamais une autorisation choisie par le modèle.

### Bornes de charge

La charge JSON d’un résultat est limitée à 1 500 000 octets UTF-8. `resultVersion` est un entier de 1 à 9 007 199 254 740 991 afin de préserver son identité en JavaScript. Les coûts sont finis, positifs ou nuls et au plus 10¹⁵; le coût de référence du simulateur est strictement positif. Un résultat contient au maximum 500 entités, 1 000 relations, 500 événements, 20 scénarios, 500 preuves et 1 000 points par scénario. Une liste de références contient au plus 100 éléments. Les coordonnées sont limitées aux plages géographiques usuelles; tiers 0–10; horizon 1–3 650 jours. Les champs texte ordinaires sont limités à 2 400 caractères; extraits à 10 000. Les documents volumineux restent dans le stockage documentaire; ne pas les recopier dans un onglet.

### Capacités des vues

| Vue | Minimum réellement fourni |
| --- | --- |
| Chronologie | Un événement lié à une entité possédant latitude et longitude. Une projection n’est affichable que si elle est fournie. |
| Propagation | Une relation orientée `impact`. Les liens ne constituent pas une estimation quantitative à eux seuls. |
| Scénarios | Deux scénarios ou plus, produits selon un périmètre et des unités communs. |
| Dépendances | Une relation `supply` ou `alternative`. |
| Simulateur | Une entité `port` et un modèle `linear-sensitivity-v1`. |

Une comparaison de plusieurs scénarios exige un unique scénario `base`. Les séries commençant à J0 partagent leur coût de départ; un point à l’horizon doit correspondre au coût du scénario. Les références de coût/délai/service du simulateur doivent correspondre au scénario de base lorsqu’il existe. La fermeture maximale ne dépasse pas l’horizon. Un résultat `partial` explique ses limites; une recherche `completed` possède au moins une preuve. Les champs facultatifs `null` sont normalisés en absence des deux côtés du contrat.

Les agents doivent conserver une collection vide et expliquer les informations manquantes dans `limitations` lorsqu’une partie est inconnue. Il ne faut pas inventer de fournisseur, de coordonnées, de probabilité, de prix ou de lien causal pour activer une vue. Pour `research`, chaque entité, relation, événement et scénario doit référencer au moins une preuve, et le modèle éventuel doit citer les preuves de ses entrées. Toutes les références doivent exister dans le résultat. Les notes de la preuve indiquent la période, les conditions et les réserves pertinentes.

## Simulateur conditionnel

Le seul modèle accepté dans cette version est `linear-sensitivity-v1`. Ses paramètres sont déclarés par le moteur de calcul et doivent être expliqués dans `assumptions` :

| Paramètre | Unité / sens |
| --- | --- |
| `baselineCost` | Coût de référence, dans `costUnit`. |
| `baselineDelayDays` | Délai moyen de référence en jours. |
| `baselineServicePct` | Taux de service de référence en points de pourcentage. |
| `closureCostPerDay` | Coût additionnel par jour de fermeture, dans l’unité du coût. |
| `closureDelayPerDay` | Retard additionnel par jour de fermeture. |
| `tariffExposurePct` | Part du coût de référence soumise au tarif, 0–100 %. |
| `alternateCostPct` | Surcoût déclaré d’une alternative, en pourcentage du coût de base. |
| `alternateDelayDays` | Délai additionnel déclaré de l’alternative, en jours. |
| `serviceLossPerDelayDay` | Perte de service en points de pourcentage par jour de retard. |
| `maxClosureDays`, `maxTariffPct` | Bornes autorisées des contrôles. |
| `assumptions`, `evidenceIds` | Méthode, validité et sources des coefficients. |

La formule doit rester affichable avec ses unités. La variation du tarif vaut `baselineCost × tarifPct / 100 × tariffExposurePct / 100`. La fermeture sans alternative ajoute `jours × closureCostPerDay` au coût et `jours × closureDelayPerDay` au délai. Une alternative utilise son surcoût et son délai déclarés, au lieu de fabriquer une vitesse de mitigation. Le taux de service est borné à 0–100 après application de la sensibilité au retard. Les résultats sont conditionnels aux coefficients renseignés, sans confiance statistique inventée et sans prétendre prévoir une fermeture.

Les scénarios sauvegardés par le simulateur sont des variantes **locales au navigateur**, associées au compte, à l’analyse et à sa version. Ils ne constituent pas une analyse AWS publiée. Le modèle de base et ses preuves restent distincts des modifications de l’utilisateur.

## Intégration avec les agents et les onglets

1. Le moteur lance une analyse et conserve son identifiant confirmé.
2. Le workflow collecte, calcule, vérifie et produit une enveloppe de résultat.
3. L’outil `publish_analysis_result` valide l’enveloppe et contrôle le persona actif. Il émet le résultat et une référence d’onglet; la conservation de cette livraison est locale au navigateur. Le moteur AWS reste responsable de sa propre persistance.
4. L’Assistant reçoit la référence du résultat, puis ouvre une vue parmi les capacités disponibles.
5. Le frontend valide encore la charge reçue avant affichage; une erreur API ou de schéma est visible et ne déclenche aucun jeu de remplacement.

Le runtime Profils expose `get_visualization_contract` et `publish_analysis_result({result_json, view?})`. Le contrat est aussi lisible par `GET /v1/profiles/visualization-contract`. Le résultat publié est validé par Pydantic puis par Zod, enregistré par compte/version dans le navigateur et ouvert automatiquement dans un onglet. Un résultat de `get_analysis_result` peut contenir une propriété `visualization` conforme au même contrat; le frontend la traite également. Le raccord aux outils de recherche/skills de DEV5 doit conserver ces noms et ce format; ne pas remplacer les outils d’analyse existants.

La page Analyses expose « Visualiser dans l’Assistant » pour les enregistrements qui contiennent cette enveloppe validée. Elle n’invente pas de graphe pour les anciens résultats textuels. Les autres entrées peuvent être importées depuis le bouton Analyses de la barre d’onglets. Les références d’onglets ne transportent pas les gros résultats dans chaque message de chat.

Cette livraison ne déploie rien sur AWS et n’ajoute pas de persistance serveur des onglets ou des scénarios. La fermeture du navigateur conserve le cache local, mais changer de navigateur requiert un nouvel import ou la lecture du résultat côté moteur. Le moteur DEV2/DEV3 doit réellement produire ce contrat; les maquettes ne remplacent pas son analyse.

## Aperçu local

Dans ce worktree, `npm run dev -w apps/web -- --port 5191` lance Vite/HMR. `VITE_PROFILE_API_TARGET` permet de choisir un serveur local Profils différent sans interrompre celui des autres développeurs (valeur par défaut : `http://127.0.0.1:8010`). Le serveur d’aperçu utilise le port 8011. Depuis Assistant, bouton Analyses → choisir une maquette interactive ou importer un résultat JSON.

## Sources des composants

Les bookmarks 21st.dev ont été consultés. Interactive Workflow Blueprint sert à éditer des workflows de services, avec un modèle de données différent des relations de risque; les cartes et graphes utilisent donc les primitives projet et React Flow. Market/Depth/Portfolio/Cohort ne représentent pas ces séries de coût et de service. `ArchivedChart.tsx` reprend le wrapper exact de l’archive FrontUI `data-visualization/charts/recharts-chart/source/chart.tsx`, avant sa démo, avec seulement l’import `cn` adapté. Les séries sont fournies via un adaptateur et les fixtures de l’archive ne sont pas incluses.

## Vérifications de cette livraison

Build et TypeScript, validation du contrat Python avec l’exemple commun, rejet d’un autre persona et contrôle des références. Parcours navigateur desktop : cinq vues, sélection carte/graphe, paramètres du simulateur, sauvegarde/restauration et rechargement. Aucun débordement vertical de document ou erreur JavaScript dans le parcours vérifié. La vérification mobile est différée.


## Revue navigateur et corrections

Les références visuelles sont les cinq maquettes InvestorOS à chat gauche et onglet droit, relues lors de la revue. Les mesures desktop à 1453×1080 et 1720×1080 vérifient la présence du comparateur, les proportions des panneaux, les sources et l’absence de défilement de document; les contenus longs gardent leur défilement interne. Les probabilités illustrées dans les images ne sont pas reproduites lorsqu’aucun calcul ne les justifie.

Le registre `view-registry.tsx` associe chaque clé autorisée à un composant React; une clé venant d’un agent ne charge jamais du code arbitraire. Les panneaux visités restent montés sans être accessibles au clavier lorsqu’ils sont inactifs : les filtres, positions de graphe et paramètres non enregistrés survivent aux changements de vue.

Le chat joint le résultat actif validé et, dans le simulateur, les paramètres effectivement saisis. `read_active_analysis` permet à l’agent de consulter une section paginée; les longues séries sont explicitement résumées aux quatre premiers et quatre derniers points. Cette lecture provient du navigateur et ne constitue pas une nouvelle recherche AWS.

Les versions de résultat sont stockées séparément, sans éviction automatique des résultats précédents. Le format antérieur reste lisible. Les conflits de contenu sur une version immuable et les erreurs de quota sont signalés sans supprimer les autres versions.

Régressions reproductibles :

```sh
node --test apps/web/src/features/analysis-workspace/contract.test.cjs
PYTHONPATH=apps/api/src python -m unittest discover -s apps/api/tests -v
npm run build
```

Les contrôles de transport navigateur utilisent des événements d’outil déterministes pour vérifier le rendu et les références. Ils ne prouvent pas qu’une invocation Bedrock ou une collecte AWS réelle a eu lieu.


## Cache local et versions immuables

`storage.ts` conserve désormais chaque résultat dans une entrée indépendante `investoros.analysis-result.v2.<compte>.<identité>.<nonce>`. Les anciennes listes `investoros.analysis-results.v1.<compte>` restent lisibles. Aucune limite de 20 résultats ne supprime implicitement une version susceptible d’être référencée par un onglet. La limite réelle est celle du navigateur : si elle est atteinte, la sauvegarde échoue explicitement et ne retire aucun ancien résultat.

La comparaison d’une version immuable utilise un JSON canonique : l’ordre des propriétés d’objets n’a pas d’effet; l’ordre des listes reste significatif. Des écritures simultanées de résultats différents dans deux fenêtres ne réécrivent pas une liste commune. Des contenus concurrents pour un même identifiant/version déclenchent un conflit et ne remplacent pas les données déjà conservées. `resultStorageIssues(accountId)` permet au conteneur d’afficher les corruptions récupérables ou conflits rencontrés pendant la lecture. Le contrat ne traite pas le cache navigateur comme une autorisation serveur.

Après une sauvegarde, la fenêtre émet `investoros:analysis-results` avec le compte concerné. Les autres fenêtres du même navigateur reçoivent les événements `storage` natifs; chaque lecteur filtre encore le compte actif. Les valeurs corrompues sont ignorées avec diagnostic, tandis que les autres résultats restent consultables.

## Régressions ciblées

- `node --test apps/web/src/features/analysis-workspace/contract.test.cjs` : contrat, précision et chronologie, références, conservation de 25 résultats, clé de compte, égalité canonique, conflit concurrent, ancien cache, quota et corruption.
- `PYTHONPATH=apps/api/src python -m unittest discover -s apps/api/tests -p test_visualization_contract.py -v` : validations équivalentes côté API, contrôle du persona et rejet de charges surdimensionnées. Utiliser l’environnement Python de l’API avec Pydantic installé.


## Grille commune au chargement initial

La grille chat / séparateur / onglets et les contrôles partagés appartiennent à `features/profiles/profiles.css`, importé immédiatement par ProfilesPage. Le style chargé à la demande `workspace.css` ne doit pas définir la grille du shell : une visite directe à Assistant ou Profils doit fonctionner avant toute ouverture d’une analyse. La régression est vérifiée dans le navigateur sur une session vierge, après redimensionnement clavier, après retour au Profil et rechargement, et sur le build de production.

## Réseau lisible dans les onglets de l’Assistant

`NetworkView.tsx` réutilise les entités, relations et preuves du résultat. La disposition adaptative de `network-presentation.ts` privilégie des cartes lisibles : elle ne réduit plus systématiquement tous les nœuds pour les faire tenir dans le panneau. Le graphe reste déplaçable et zoomable; le nombre de colonnes suit sa largeur. Les positions déplacées par l’utilisateur restent conservées pendant les interactions.

Les détails s’ouvrent en superposition et ne prennent pas une colonne du graphe. Clic ou Entrée/Espace sélectionne un élément; le bouton de source de chaque carte ouvre directement sa preuve. La fermeture des détails rend le focus à la carte sélectionnée. Les contrôles sans données correspondantes (rang fournisseur, alternative, transport) ne sont pas affichés.

Les barres des cartes montrent la mesure indiquée : part déclarée si fournie, sinon nombre de relations documentées. La vue NVDA propose également des comptes de fournisseurs par fonction, déduits des libellés de relations réellement fournis. Samsung pouvant appartenir à deux fonctions, ces comptes ne sont pas additifs. Ils ne représentent ni poids financier, ni part d’approvisionnement, ni risque estimé. Un clic sur une fonction filtre le réseau; le filtre se retire par son bouton. Le compteur de sources est limité aux preuves effectivement référencées par les entités et relations visibles, sans compter les documents de calendrier indépendants de ce réseau.

La recette `scripts/test-network-presentation.cjs` vérifie pleine largeur, redimensionnement du séparateur, lisibilité des cartes, détails flottants, preuves, filtres, fonctions, clavier, tableau et mobile. Les captures passent par `scripts/browser-capture.cjs` (CRC, décodage complet, publication atomique).
