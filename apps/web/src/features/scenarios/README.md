# Simulation : observations et hypothèses

La page `/app/scenarios` sépare les observations datées des trajectoires hypothétiques. Les repères historiques sont cliquables sur le graphique et dans les listes : l’utilisateur peut inspecter les cours ajustés après un événement d’entreprise, un acte du Federal Register ou un dépôt SEC, puis transmettre ce contexte à l’Assistant.

## Sources affichées

- Les séries de cours, actifs et événements d’entreprise viennent du paquet configuré par `SIMULATION_DATA_DIR`. L’interface montre sa source et sa date de fin. Dans le jeu de départ, les séries Yahoo Finance sont historiques et peuvent être différées ou révisées.
- Les actes réglementaires sont chargés par l’API Simulation depuis le Federal Register. La page distingue la publication de la date d’entrée en vigueur et peut fournir le PDF de l’édition officielle GovInfo. La présence d’un acte ne prouve pas qu’il s’applique à l’émetteur.
- Les formulaires SEC sont optionnels. L’API les demande directement depuis les endpoints EDGAR, avec `SEC_USER_AGENT` configuré côté serveur. Le navigateur ne reçoit aucune information d’authentification. Si l’entête n’est pas configuré ou que la source échoue, l’écran l’indique.
- La couverture récente vient de GDELT DOC 2.0 et reste une source secondaire de découverte : elle est datée, cliquable et accompagnée d’une limite visible. Le titre d’un article n’est pas traité comme un fait vérifié, une mention confirmée de l’émetteur ou une cause du rendement. Une limitation temporaire de la source est montrée sans données de remplacement.
- Le rendement après publication n’est calculé que lorsque le paquet contient des cours postérieurs. Une date de dépôt plus récente que le dernier cours donne « — », jamais une réaction supposée.

## Scénarios conditionnels

Le calcul requiert deux à quatre branches, un horizon de 20, 60 ou 120 séances, une condition nommée, un pourcentage de choc explicitement saisi par la personne et un jalon dans l’horizon. Un événement historique sélectionné peut préremplir le libellé de condition, mais ne remplit pas le choc. L’API refuse les amplitudes hors de −80 % à +100 %.

Pour chaque jalon, le service calcule les 10e, 50e et 90e centiles des rendements glissants historiques du même titre. Il applique le choc utilisateur à partir du jalon indiqué. Le graphique trace les médianes conditionnelles et leur bande empirique; les cartes montrent la fourchette de fin. Ces quantiles marginaux ne décrivent pas des trajectoires individuelles cohérentes et ne sont ni probabilités ni prévisions.

## Relais vers l’Assistant

Depuis une observation sélectionnée, le bouton de relais envoie à l’Assistant le ticker, la date, la source et les rendements calculés disponibles. Les prompts doivent séparer la coïncidence temporelle de la causalité et demander quelles preuves manquent. Une analyse d’une déclaration SEC récente doit dire explicitement quand la série de prix s’arrête avant le dépôt.

Les personas Amira, Mateo et Robert restent des profils de démonstration séparés de l’univers des tickers. Aucun symbole de ce jeu ne doit être présenté comme une position réelle d’un persona sans correspondance documentée.

## API

- `GET /v1/simulation/assets` : univers configuré.
- `GET /v1/simulation/history/{ticker}` : prix, événements d’entreprise et rendement observé après événement.
- `GET /v1/simulation/regulations?topic=...` : documents datés par thème.
- `GET /v1/simulation/filings/{ticker}` : dépôts EDGAR; nécessite `SEC_USER_AGENT`.
- `GET /v1/simulation/news/{ticker}` : couverture récente GDELT, avec cache et gestion des limitations.
- `POST /v1/simulation/scenarios` : quantiles historiques et chocs utilisateur. Chaque entrée est validée et chaque réponse inclut date source, méthode et limites.

Tout changement de source doit conserver la provenance, les dates de disponibilité, la devise et les limites du jeu. Aucun service payant, collecte de réseau social ou scraping n’est requis par cette page.
