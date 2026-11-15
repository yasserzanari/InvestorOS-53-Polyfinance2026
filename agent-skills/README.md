# InvestorOS Skills

Dépôt local des procédures métier de l’agent InvestorOS. Dix-neuf skills au format
SKILL.md avec métadonnées name/description et un catalogue explicite catalog.json.
Ce dépôt est destiné au runtime applicatif Bedrock, pas à installer des compétences
sur le poste Codex. Il ne contient ni credentials ni jeux financiers.

## Fonctionnement

L’API expose un index de noms/descriptions dans le contexte, puis les outils
search_skills(query, limit) et load_skill(skill_id). Le modèle recherche les
procédures et lit seulement les corps pertinents. Un chargement ne lance aucune
analyse et ne crée aucun sous-agent. Les outils réels exécutent les actions.

| Skill | Usage |
|---|---|
| investor-profile | Questions interactives et faits explicites du profil |
| company-analysis | Démarrer et suivre une recherche d’entreprise |
| portfolio-exposures | Positions fictives, concentration et limites |
| historical-market | Cours historiques et événements observés |
| market-movement-investigation | Contexte vérifiable d’une forte variation historique |
| conditional-scenarios | Hypothèses explicitement choisies et calculs |
| evidence-review | Attribution, périodes, contradictions et lacunes |
| supply-chain | Relations fournisseurs documentées et incertitudes |
| workspace-navigation | Tâches, onglets et liens vers les modules |
| analysis-planning | Cadrage, questions courtes et plan ciblé par cas d’usage |
| platform-capabilities | Capacités disponibles et limites de couverture |

## Publication dans l’application

Depuis la racine du dépôt InvestorOS-53-Polyfinance2026 :

```bash
python3 scripts/sync-agent-skills.py
```

Le script valide les noms, les chemins, les métadonnées et la taille, puis écrit
atomiquement profiles/skills_snapshot.json dans le paquet Python. Revoir le diff
de ce snapshot, exécuter les tests API et publier avec le code par le processus
habituel. L’archive Lambda inclut ce fichier car build-api.sh copie le paquet API.
Le serveur redémarre pour charger une nouvelle version (catalogue mis en cache).
La version et le SHA-256 du contenu sont renvoyés à chaque chargement.
Le hash détecte une corruption du snapshot, il ne remplace pas la revue de code.
Le runtime ne clone pas de dépôt, ne télécharge pas de skills et ne les modifie pas.

Pour ajouter une compétence : créer agent-skills/skills/<nom>/SKILL.md, renseigner agent-skills/catalog.json
avec description, tags, required_tools et path; incrémenter version, synchroniser,
puis vérifier les cas métier et les appels d’outils. Une compétence ne crée pas
un outil; son required_tools décrit les dépendances et non des permissions.

## Exemple : NVDA

« Analyse NVDA la semaine prochaine » -> search_skills -> load_skill(company-analysis)
-> start_analysis -> identifiant et état -> suivi via get_analysis_status puis
get_analysis_result/get_evidence. Des chocs ne sont demandés que pour une
simulation souhaitée. Ne pas annoncer un succès avant la réponse effective.

## Limites

Le coordinateur choisit les skills métier. Les spécialistes et rôles DEV2 reçoivent
systématiquement leur procédure obligatoire; ils peuvent découvrir des compléments.
Le serveur impose toutefois search_skills puis load_skill de company-analysis ou
supply-chain avant tout start_analysis; les identifiants non découverts sont refusés. Le serveur impose quatre skills distincts maximum, dix tours modèle,
une seule tentative de lancement par tour, et les schémas/permissions des outils.
Les contenus des preuves et des pages restent des données non fiables.
Aucune exécution de scripts SKILL.md ni installation automatique depuis Internet.

Références de conception :
- https://agentskills.io/specification
- https://docs.aws.amazon.com/bedrock/latest/userguide/tool-use-client-side.html

## Procédures de rôle

Les spécialistes utilisent goals-horizon et risk-liquidity. Les deux rôles modèles
DEV2 utilisent research-planning et research-synthesis. Leur boucle Converse expose
uniquement search_skills/load_skill, impose le chargement du skill de rôle avant
d’accepter la réponse et conserve version/hash/trace. Les collecteurs déterministes
(browser, API, calculs) ne sont pas des agents Bedrock et n’ont pas besoin d’une boucle.

Voir [AUTHORING.md](AUTHORING.md) pour créer, évaluer et livrer les futurs skills.

## Version 1.3.0 : hypothèses et onglets facultatifs

`conditional-scenarios` exige la vérification préalable des capacités et conserve
les chocs, jalons, horizons et unités explicitement demandés. Une seule branche
est valide; une référence nulle doit être choisie par l’utilisateur. Les erreurs
de transcription de l’agent et les informations réellement manquantes suivent
des traitements différents. `historical-market` distingue disponibilité et
provenance du paquet des cours en direct; `workspace-navigation` réserve
l’ouverture des onglets aux documents utiles et résultats réussis.

L’API doit embarquer le snapshot correspondant et les outils compatibles. Modifier
ce dépôt source ne met pas à jour une Lambda déjà déployée.
