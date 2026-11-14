# Simulation : observations et hypothèses

La page `/app/scenarios` sépare les observations datées des trajectoires hypothétiques. Les repères historiques sont cliquables sur le graphique et dans les listes : l’utilisateur peut inspecter les cours ajustés après un événement d’entreprise, un acte du Federal Register ou un dépôt SEC, puis transmettre ce contexte à l’Assistant.

## Sources affichées

- Les séries de cours, actifs et événements d’entreprise viennent du paquet configuré par `SIMULATION_DATA_DIR`. La fiche et les résultats du chat donnent un lien vers la page historique Yahoo Finance du ticker, la source extraite et la dernière date du jeu. Le lien mène au fournisseur, pas à une archive immuable de l’extraction locale. Les séries sont historiques et peuvent être différées ou révisées.
- Les actes réglementaires sont chargés par l’API Simulation depuis le Federal Register. La page distingue la publication de la date d’entrée en vigueur et peut fournir le PDF de l’édition officielle GovInfo. La présence d’un acte ne prouve pas qu’il s’applique à l’émetteur.
- Les formulaires SEC sont optionnels. L’API les demande directement depuis les endpoints EDGAR, avec `SEC_USER_AGENT` configuré côté serveur, et charge les archives de l’émetteur depuis le début de la série visible. Le navigateur ne reçoit aucune information d’authentification. Si l’entête n’est pas configuré, qu’une archive échoue ou que la limite de 50 dépôts tronque la liste, l’écran l’indique. Un dépôt dont la date tombe dans la fenêtre de prix visible reçoit un marqueur distinct; la liste permet aussi d’ouvrir les dépôts plus récents qui n’ont pas encore de cours postérieur.
- La couverture récente vient de GDELT DOC 2.0 et reste une source secondaire de découverte : ses dates d’indexation sont datées, cliquables et accompagnées d’une limite visible. Un marqueur distinct apparaît sur le graphique quand sa date d’indexation tombe dans la période de cours affichée. Le sélectionner montre la vignette éventuelle, le lien original et les rendements mesurés après la date d’indexation; ces rendements ne sont pas attribués à l’article, et la date d’indexation n’est pas nécessairement sa date de publication. Quand l’API fournit une image sociale HTTPS, elle peut être le logo du média ou ne pas illustrer l’article. Le titre et l’image ne sont pas traités comme des faits vérifiés, une mention confirmée de l’émetteur, une photo authentifiée de l’événement ou une cause du rendement. Une limitation temporaire de la source est montrée sans données de remplacement.
- Le rendement après publication n’est calculé que lorsque le paquet contient des cours postérieurs. Une date de dépôt plus récente que le dernier cours donne « — », jamais une réaction supposée.

## Scénarios conditionnels

Le calcul requiert deux à quatre branches, un horizon de 20, 60 ou 120 séances, une condition nommée, un pourcentage de choc explicitement saisi par la personne et un jalon dans l’horizon. Un événement historique sélectionné peut préremplir le libellé de condition, mais ne remplit pas le choc. L’API refuse les amplitudes hors de −80 % à +100 %.

Pour chaque jalon, le service calcule les 10e, 50e et 90e centiles des rendements glissants historiques du même titre. Il applique le choc utilisateur à partir du jalon indiqué. Le graphique trace les médianes conditionnelles et leur bande empirique; les cartes montrent la fourchette de fin. Ces quantiles marginaux ne décrivent pas des trajectoires individuelles cohérentes et ne sont ni probabilités ni prévisions.

Après le calcul, les courbes conditionnelles sont sélectionnables directement dans le graphique (clic, Entrée ou Espace). Le contrôle correspondant dans la fiche de chaque branche sélectionne la même courbe; la couleur et l’épaisseur la distinguent des autres branches. Le libellé accessible expose le nom, la condition, le choc saisi et le jalon. Les repères historiques restent des commandes distinctes et ouvrent leur propre fiche de preuve. Aucun événement futur n’est déduit automatiquement d’un article ou d’une publication.

## Relais vers l’Assistant

Depuis une observation sélectionnée, le bouton de relais envoie à l’Assistant le ticker, la date, la source et les rendements calculés disponibles. Depuis le chat, `inspect_simulation_history` lit aussi le jeu historique configuré pour le ticker et `project_market_scenarios` appelle le même moteur de quantiles que cette page, avec deux à quatre chocs et jalons explicitement fournis par l’utilisateur. Les deux résultats donnent accès au ticker dans Simulation. L’Assistant ne lance pas de recherche GDELT, Federal Register, EDGAR ou X; ces sources restent consultables dans le module. Les prompts séparent la coïncidence temporelle de la causalité et demandent quelles preuves manquent. Une analyse d’une déclaration SEC récente doit dire explicitement quand la série de prix s’arrête avant le dépôt.

Les personas Amira, Mateo et Robert restent des profils de démonstration séparés de l’univers des tickers. Aucun symbole de ce jeu ne doit être présenté comme une position réelle d’un persona sans correspondance documentée.

## API

- `GET /v1/simulation/assets` : univers configuré.
- `GET /v1/simulation/history/{ticker}` : prix, événements d’entreprise et rendement observé après événement.
- `GET /v1/simulation/regulations?topic=...` : documents datés par thème.
- `GET /v1/simulation/filings/{ticker}` : dépôts EDGAR; nécessite `SEC_USER_AGENT`.
- `GET /v1/simulation/news/{ticker}` : couverture récente GDELT, avec cache et gestion des limitations.
- `GET /v1/simulation/social/{ticker}` : posts publics X des sept derniers jours; recherche opt-in et potentiellement facturable.
- `POST /v1/simulation/scenarios` : quantiles historiques et chocs utilisateur. Chaque entrée est validée et chaque réponse inclut date source, méthode et limites.

Les marqueurs Federal Register et EDGAR sont positionnés à la première clôture disponible à la date de publication/dépôt ou après. La fiche conserve la date documentaire d’origine et distingue la période déclarée d’un dépôt. Les rendements mesurés après date ne prouvent ni causalité ni exposition de l’émetteur à une règle. Les articles GDELT restent des éléments de découverte secondaire : leur marqueur utilise l’heure d’indexation et apparaît seulement si cette date se trouve dans la fenêtre de cours visible. Leur sélection ouvre la fiche avec lien source et rendements post-indexation lorsqu’ils sont calculables. L’heure d’indexation n’est pas nécessairement l’heure de publication; ni le titre, ni l’image, ni les rendements ne confirment l’événement ou un lien causal. Aucun article n’est utilisé pour modifier les cours ou construire les scénarios conditionnels.

La recherche X est désactivée par défaut. Quand l’exploitant l’active explicitement côté serveur, la page affiche les posts publics et les liens directs renvoyés par X Recent Search; les images jointes restent des aperçus non vérifiés. Un champ permet d’ajouter jusqu’à cinq identifiants fournis manuellement. X cherche alors des publications de ces comptes qui mentionnent aussi le nom ou le symbole de l’émetteur. L’application valide le format du nom, pas l’identité ni la fonction de la personne; elle ne découvre aucun compte automatiquement. La recherche ne couvre que les sept derniers jours et n’est pas une archive. Les posts ne sont jamais utilisés pour inférer un événement historique ou alimenter le calcul de cours. X v2 est facturé à l’usage; l’activation nécessite une validation du budget et des règles de conservation. Le jeton reste côté API et peut être stocké dans AWS Secrets Manager. Voir [la documentation de l’API](../../../../api/README.md) pour le paramétrage.

Tout changement de source doit conserver la provenance, les dates de disponibilité, la devise et les limites du jeu.
