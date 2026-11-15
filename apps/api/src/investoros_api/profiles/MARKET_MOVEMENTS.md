# Variations de marché et documents lus

## Analyse détaillée d’une séance

La fiche ouvre maintenant `POST /v1/profiles/research/{analysis_id}/movement-investigation` avec le compte, le titre et les deux dates. Le serveur vérifie le dossier et recalcule le mouvement; aucun prix ni pourcentage envoyé par le navigateur n’est utilisé comme fait.

Le résultat compare SPY et QQQ sur les deux clôtures exactes, distingue les documents déjà lus du contexte des cinq jours précédents et exclut les publications après la clôture. Une annonce de conférence future n’est pas promue en publication de résultats ni en facteur explicatif. Les facteurs interprétatifs issus de Bedrock restent des hypothèses, avec contrepoint et citation textuelle vérifiée dans un document reçu avant la clôture. Le cache de synthèse est limité, lié au compte/dossier et à l’empreinte des données; l’accès au dossier est revérifié avant chaque utilisation.

Une recherche GDELT bornée aux dates concernées découvre des pistes de presse. Aucun contenu de site arbitraire n’est téléchargé; les titres indexés sont présentés comme non lus et ne sont jamais utilisés pour établir une cause. Une indisponibilité de presse ou de modèle est explicite. Les comparaisons de marché restent descriptives : ni attribution causale, ni étude événementielle ajustée au bêta, ni preuve de flux institutionnels. QQQ est un proxy Nasdaq-100, pas un indice pur des semi-conducteurs.

Vérification locale réelle sur NVDA du 29 au 30 octobre 2026 : NVDA −4,22 %, SPY −1,77 %, QQQ −3,47 % dans le jeu fourni. Le communiqué du 28 octobre annonce une conférence du 17 novembre; cette confusion avec des résultats déjà publiés est rejetée. La recherche GDELT n’a pas abouti lors de cette vérification; aucune cause de presse n’est donc annoncée. Le moteur conserve un résultat partiel. Une invocation réelle de Bedrock a aussi vérifié le contrat JSON, sans constituer une validation générale de la justesse des interprétations.

Tests : `test_movement_investigation.py` contrôle les clôtures identiques, la temporalité, les citations fabriquées, les annonces de calendrier, le refus intercomptes et le fonctionnement partiel. `node scripts/test-movement-investigation.cjs` ouvre la fiche réelle, vérifie comparaisons, passage et lien source, limites et absence de débordement mobile. Ces ajouts sont locaux et n’ont pas été déployés sur AWS dans cette intervention.

`market_movement_service.py` relie les variations de l’historique configuré aux documents d’un dossier de recherche du compte actif. `market_movement_evidence.py` calcule les retours et rapproche les publications sans leur attribuer automatiquement un effet causal. L’endpoint est `GET /v1/profiles/research/{analysis_id}/movements`; les outils de l’Assistant sont `list_research_analyses` et `inspect_market_movements`.

Le dossier et le titre sont vérifiés avant toute utilisation du cache. La nouvelle lecture documentaire exige la politique effective renvoyée par le moteur de recherche. Elle est actuellement implémentée uniquement pour le flux officiel NVIDIA, avec domaine HTTPS fixe, redirections refusées, fenêtre de publication, limite de six documents parmi 40 entrées RSS récentes et budget de lecture borné. Ce flux ne constitue pas une archive exhaustive. Les communiqués horodatés après la clôture précédente peuvent contextualiser le premier intervalle demandé; leur date ne prouve pas une causalité. Les retours restent disponibles lorsque la nouvelle lecture est bloquée.

## Blocage constaté avant le déploiement du 15 novembre 2026

- Le calcul des mouvements depuis les cours et les preuves déjà reçues fonctionne localement : un appel réel sur NVDA du 12 octobre au 12 novembre 2026, au seuil de 3 %, expose huit mouvements, dont des documents associés aux 10 et 12 novembre.
- Les deux transports de recherche sont configurés localement. `research_bridge.py` donne priorité à `RESEARCH_LAMBDA_FUNCTION` sur `RESEARCH_API_URL`.
- Avant le correctif, l’entrée IAM déployée refusait la lecture du catalogue `/v1/research/sources`, car son ancienne liste de routes ne comprenait que les dossiers `/analyses`. Elle répondait 403 à cette opération. Les lectures des dossiers existants restaient autorisées.
- L’alternative HTTPS configurée répond 401 au catalogue en l’absence de JWT. Le code Terraform protège son catch-all avec JWT et le wrapper déployé requiert le groupe `administrators`. Aucun transport public déjà autorisé n’a été trouvé pour cette politique. L’espace local des sources et les ressources de la console Admin ne sont pas cette politique effective et ne sont pas utilisés comme substitution.
- Le premier correctif local autorisait le `GET` exact `/v1/research/sources`. Le déploiement ciblé décrit ci-dessous a ensuite conservé les protections de l’artefact AWS existant et ajouté uniquement cette lecture.

Ce blocage produisait `collection.status = "unavailable"`. Le lecteur ne s’est pas rabattu sur un catalogue par défaut ni sur un accès dépourvu d’autorisation.

## Correctif AWS déployé et vérifié

Le 15 novembre 2026 à 05:07 UTC (00:07 à Toronto), `investoros-dev-api`, région `us-east-1`, a reçu un artefact dérivé du ZIP réellement déployé. Une seule entrée change : `investoros_api/research/iam_handler.py`. Les contrôles d’enveloppe, de chemin et de suppression des claims existants sont conservés. Aucune configuration, identité IAM, fonction worker ou infrastructure n’a été remplacée. Le SHA-256 du code est `btc6fndb3HX+mgB10gYDFxNLReYwgt+a2xyOgz0wbmc=` ; Lambda confirme `Active` et `Successful`.

Une invocation réelle du catalogue renvoie HTTP 200, quatorze politiques et `read_only`. Une tentative PATCH sur une politique est refusée HTTP 403. Il ne s’agit pas d’une ouverture des écritures administratives.

Le lecteur local relié à cette Lambda a ensuite lu six nouveaux communiqués NVIDIA : six tentatives, zéro échec. Sur NVDA du 12 octobre au 12 novembre 2026, au seuil de 3 %, le rapport compte onze documents reçus, huit variations et trois mouvements avec contexte documentaire, contre deux avant le correctif. Le 9 novembre bénéficie notamment des communiqués du conseil du 8 novembre et de collaboration du 9 novembre. Cela ajoute un contexte vérifiable, pas une preuve causale.

Le test navigateur réel a vérifié les huit repères et ouvert les nouveaux documents et leur fiche. Depuis une conversation existante, « Approfondir avec l’Assistant » transmet une seule demande avec le bon dossier, les clôtures du 6 au 9 novembre et le seuil de 3 %. Nova Pro a appelé `inspect_market_movements`, reçu deux nouveaux documents correspondant à cet intervalle et terminé sans relancer d’analyse. La réponse n’a pas toujours repris les heures et citations demandées : cette limite de qualité figure dans l’audit. Les traces du test sont conservées dans le rapport de release local. Une tentative distincte de nouvelle recherche pour le 16–22 novembre a été refusée HTTP 429 ; aucun nouveau dossier n’a été annoncé comme créé.

Deux corrections de parcours sont vérifiées : consommation du lien d’approfondissement dans une conversation existante et placement d’un communiqué publié le 28 octobre à 17 h New York sur la prochaine clôture observée, le 29 octobre. Les captures CRC-validées et décodées sont `docs/prep/generated-ui/nvda-aws-source-context-20261115.png` et `nvda-aws-agent-response-20261115.png`.

**Périmètre publié :** seul le correctif IAM ci-dessus a été déployé sur AWS. Le frontend, le lecteur de mouvements, l’investigation détaillée et les deux corrections de parcours sont vérifiés sur l’environnement local relié aux données et modèles AWS ; cette opération ne publie pas l’ensemble de ces modules locaux dans le cloud.

## Parcours et contrôles réalisés

L’Assistant peut retrouver les dossiers du compte actif avec `list_research_analyses`, puis appeler `inspect_market_movements` avec le titre et la période. La lecture d’un dossier existant ne relance pas l’analyse et ne demande pas de nouvelle validation de plan. Les sources reçoivent leurs indices de citation dans le même registre que les autres outils. La réponse doit résumer les faits lus et les horaires, puis séparer toute interprétation conditionnelle de l’observation. Un simple catalogue de titres ne remplace pas cette explication. Les spécialistes de profil gardent leur rôle et leurs outils propres.

Deux appels réels à Amazon Bedrock Nova Pro ont effectivement choisi `inspect_market_movements` sur le dossier NVDA existant. Les réponses citent les documents de gouvernance, conservent les mouvements sans raison établie et ne lancent pas de nouvelle recherche. Le second appel décrit les faits rapportés, les horaires et un mécanisme présenté comme hypothèse.

Les vérifications ciblées du moteur ont contrôlé hausse et baisse, clôture précédente avant le début demandé, publication avant/après clôture, annonce future, exclusion des index seuls, provenance illustrative et absence d’horloge fictive hors NASDAQ/NYSE. Le parcours navigateur a vérifié les huit repères du mois au seuil de 3 %, le survol, le clavier, les documents cliquables, le changement de seuil/calque, la liste complète et la reprise après une indisponibilité injectée. Un rejeu de la trace du second appel Bedrock a vérifié l’adaptateur du chat : rattachement du dossier, bouton de résultats, onglets qui restent fermés jusqu’au clic, sans nouvelle analyse. Ce rejeu ne représente pas un troisième appel modèle. Compilation web et TypeScript validés. Aucune suite de tests supplémentaire ni vérification mobile dans cette intervention.

Les premières captures validées CRC et décodées sont conservées localement dans `docs/prep/generated-ui/market-moves-chart-v1.png` et `market-moves-detail-v1.png`. Elles précèdent le déploiement IAM et ne prouvent pas à elles seules la lecture des six nouveaux documents.
