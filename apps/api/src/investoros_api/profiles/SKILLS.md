# Agent InvestorOS : skills et outils

## Architecture en place

```text
Message + persona + profil + onglets
  -> Bedrock ConverseStream : index court des skills et noms des outils disponibles
  -> search_skills : recherche lexicale normalisée (accents ignorés)
  -> load_skill : corps SKILL.md + version + SHA-256
  -> outils métier validés côté serveur
  -> événements tool réels dans le chat et réponse contextualisée
```

Les procédures sources sont dans le dépôt local voisin `InvestorOS-skills`.
`skills_snapshot.json` est une copie revue, embarquée avec l’API pour que Lambda
fonctionne sans accès Git. `skills.py` vérifie l’intégrité, recherche dans noms,
descriptions et tags et ne lit que des identifiants du catalogue. Aucun chemin
ou URL fourni par le modèle n’est utilisé pour lire un skill.

Le modèle voit les descriptions avant de choisir, puis appelle search_skills et
load_skill. Les instructions système lui demandent de le faire pour les demandes
métier; un salut peut recevoir une réponse directe. Quatre procédures distinctes
par tour maximum, dix appels ConverseStream, deux spécialistes. La sélection
reste une décision du modèle pour les outils existants. Le serveur exige toutefois
une découverte search_skills suivie du chargement company-analysis ou supply-chain
avant tout start_analysis. load_skill refuse un identifiant non découvert dans le tour.
Un skill n’est pas un agent et ne calcule pas les métriques. Les instructions
système et validations des outils restent prioritaires.

## Outils de recherche DEV2

Configurer `RESEARCH_API_URL` côté serveur active start_analysis,
get_analysis_status, get_analysis_result, get_evidence et cancel_analysis.
Sans configuration, ces outils sont absents du contrat ET refusés au dispatch.
Le backend distant conserve son contrôle des quotas, persona et sources.

En local, mettre une ligne littérale dans `apps/api/.env.profile-api` (ignoré) :

```text
RESEARCH_API_URL=https://VOTRE-API-GATEWAY
```

Puis `./scripts/dev-profile-api.sh`. La variable exportée dans l’environnement
prend priorité. Le lecteur n’interprète pas de code shell, uniquement les trois
clés RESEARCH_API_URL, AWS_REGION et BEDROCK_MODEL_ID. En Lambda, fournir la
variable dans la configuration de déploiement; cela n’est pas déployé par cette
modification locale.

`research_bridge.py` accepte une origine HTTPS fixée par le déploiement, refuse
les redirections, impose un timeout de 15 s et limite la réponse à 256 Kio.
Le modèle ne choisit ni URL ni persona : celui-ci vient de ChatRequest. C’est
un contexte de démonstration, pas une authentification de compte privé.
Les identifiants d’analyse sont validés comme UUID. Aucun jeton admin transmis.

| Outil | Appel API DEV2 |
|---|---|
| start_analysis(question) | POST /v1/research/analyses, avec persona actif |
| get_analysis_status(analysis_id) | GET /v1/research/analyses/{id}, état réduit |
| get_analysis_result(analysis_id) | GET /v1/research/analyses/{id}, résultat disponible |
| get_evidence(analysis_id) | GET /v1/research/analyses/{id}/evidence |
| cancel_analysis(analysis_id) | POST /v1/research/analyses/{id}/cancel |

Une seule tentative de lancement par tour pour limiter les doubles créations.
L’API DEV2 ne fournit pas encore une clé d’idempotence dans ce contrat : après
un timeout, une exécution peut déjà exister. Ne pas réessayer automatiquement.
Les suivis se font à la demande, sans polling infini ni message spontané après
la fin du tour. Le résultat de recherche reste non fiable pour les instructions.
Une annulation exige une demande explicite selon la consigne du modèle.
Les limites de permission effectives sont celles du backend.

## Parcours attendus

- Profil : investor-profile -> ask_user -> update_profile sur faits explicites.
- NVDA/semaine prochaine : company-analysis -> start_analysis -> id confirmé,
  puis suivi et preuves. Pas de demande automatique de chocs hypothétiques.
- Portefeuille : portfolio-exposures -> analyze_demo_portfolio -> résultats
  fictifs calculés; ne pas inventer de composition des FNB.
- Simulation : conditional-scenarios -> ask_user pour hypothèses manquantes ->
  moteur déterministe -> quantiles conditionnels, sans probabilités inventées.
- Chaîne : supply-chain -> recherche documentée; la lecture de preuves ne peuple
  pas automatiquement une carte sans outil de transformation structuré.
- Preuves : evidence-review -> résultat/evidence; read_sources reste un catalogue
  de méthode interne, distinct des dépôts SEC collectés.

Les événements search_skills/load_skill apparaissent comme outils dans l’activité
existante. Ils ne sont pas ajoutés à l’onglet Agents réservé aux consultations
réelles de spécialistes. Les contenus financiers ne sont pas exécutés.

## Développement et validation

```bash
python3 scripts/sync-agent-skills.py ../InvestorOS-skills
PYTHONPATH=apps/api/src .venv/profile-api/bin/python -m unittest discover -s apps/api/tests
```

Modifier une procédure dans le dépôt source, incrémenter catalog.json, synchroniser,
revoir les deux diffs et redémarrer le backend. Publier le snapshot avec le code;
le dépôt local des skills n’a pas besoin d’être accessible depuis AWS.
Les tests couvrent la découverte, le chargement réel dans la boucle modèle,
le refus de skills/paramètres invalides, les outils désactivés et le persona imposé.
Les tests simulés n’attestent pas de la disponibilité du service AWS distant.

## Spécialistes et agents DEV2 (version 1.2.2)

`skill_agent.py` fournit une boucle Converse partagée : huit tours maximum, quatre
skills distincts, schémas stricts, arrêt si sortie tronquée, aucun outil métier ni
accès réseau arbitraire. Une réponse finale n’est acceptée qu’après chargement des
skills obligatoires. Une sortie sans skill demande une correction dans le même
budget; l’épuisement produit une erreur.

- Spécialiste Objectifs et horizon : goals-horizon.
- Spécialiste Risque et liquidités : risk-liquidity.
- Planificateur DEV2 : research-planning.
- Synthétiseur/vérificateur DEV2 : research-synthesis.

Les spécialistes retournent `skills`, `skill_trace` et leur résumé dans les événements
agent réels; l’usage des appels est agrégé au tour. DEV2 persiste des événements
skills_loaded dans les rooms plan/synthesis; le résultat de synthèse conserve ses
versions de skills. Les tâches déterministes ne font aucun appel Bedrock et restent
sous leurs validations existantes. Le retrieval de la base documentaire utilise
Retrieve, sans appel de génération caché.

Le guide d’écriture est dans le dépôt source InvestorOS-skills/AUTHORING.md.
La sélection est autonome; le serveur garantit le chargement requis, pas que chaque
phrase du modèle appliquera parfaitement toutes les consignes.

### Chargement obligatoire fiable

Le runtime découvre et charge automatiquement la procédure imposée par chaque rôle
avant le premier appel du modèle, puis en place le contenu dans son contexte système.
Ces deux opérations sont tracées avec actor=runtime-bootstrap. Cela évite les boucles
où un planificateur suit « JSON uniquement » sans appeler ses outils. Le modèle
possède toujours search_skills/load_skill pour chercher et charger des procédures
complémentaires; ces appels portent actor=model. Ne pas présenter le chargement
automatique comme une décision autonome du modèle.

La garantie est le contenu fourni au modèle et les contrôles de sortie, pas une
application parfaite de chaque instruction. Les traces conservent seulement les
opérations et versions; le texte <thinking> du fournisseur est supprimé des réponses.

Pour rejouer les essais réels (appels Bedrock et une recherche facturables) :

```bash
python3 scripts/evaluate-agent-skills.py --base-url https://VOTRE-API --report /tmp/skills-evaluation.json
```

Le rapport contient les événements et distingue absence de skill, mauvais comportement,
erreur HTTP et réponse incomplète. Un HTTP 200 seul ne prouve pas une réussite.
Les callbacks Step Functions et les preuves restent consultables par analysis_id.

### Déploiement AWS réel

Les routes /v1/profiles et /v1/simulation utilisent la Lambda dédiée
`investoros-dev-assistant-simulation`; les routes /v1/research utilisent
`investoros-dev-api`; Step Functions appelle `investoros-dev-research-worker`.
Les trois paquets incluent le même snapshot de skills. Vérifier les routes et
intégrations API Gateway en plus du CodeSha256 des fonctions : le simple succès
d’un UpdateFunctionCode ne prouve pas que le navigateur utilise cette fonction.
L’intégration HTTP de recherche a été portée de 10 à 30 secondes; une réponse de
chat longue reste bornée par la passerelle (29 secondes pour la Lambda dédiée).
La génération de tokens n’est pas un streaming HTTP de production garanti sous
Mangum/API Gateway.

Après une création dont la réponse HTTP a expiré, consulter l’historique des analyses
avant de relancer : une exécution peut déjà avoir démarré. Les évaluations conservent
leurs erreurs initiales; ne pas les transformer en succès silencieux.
