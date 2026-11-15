"""Allowlisted model tools; schemas are sent directly to Bedrock Converse."""
from ..simulation import ScenarioProjectionRequest
from .models import AskUserInput, PROFILE_FIELDS, ScenarioAnalysisInput, SimulationHistoryInput, WorkspaceTab

def spec(name: str, description: str, properties: dict, required: list[str]) -> dict:
    return {'toolSpec': {'name': name, 'description': description, 'inputSchema': {'json': {
        'type': 'object', 'properties': properties, 'required': required, 'additionalProperties': False,
    }}}}

TOOLS = [
    spec('inspect_simulation_history', 'Lire les prix ajustés et événements d’entreprise réellement présents dans Simulation pour un ticker configuré. Appeler pour toute question sur l’historique ou les rendements observés après événement. La coïncidence temporelle ne prouve pas une causalité; les données sont historiques, pas en temps réel.',
         SimulationHistoryInput.model_json_schema()['properties'], ['ticker']),
    spec('project_market_scenarios', 'Calculer des trajectoires Simulation sur un ticker configuré. Appeler uniquement lorsque la personne a explicitement fourni chaque choc en pourcentage et son jalon; sinon utiliser ask_user. Les quantiles historiques sont marginaux, sans probabilité ni valeur prédictive.',
         ScenarioProjectionRequest.model_json_schema()['properties'], ['ticker', 'horizonObservations', 'branches']),
    spec('analyze_demo_portfolio', 'Lire le portefeuille fictif fixe de ce déploiement et calculer ses pondérations et sa concentration. Pour toute question sur les positions ou la répartition, appeler cet outil avant de répondre. Les rendements et risques historiques sont indisponibles sans série de prix.', {}, []),
    spec('analyze_demo_scenario', 'Calculer un scénario conditionnel sur les positions du persona actif. N’appeler cet outil que si l’utilisateur a fourni les variations en pourcentage ou les a choisies explicitement après ask_user; ne jamais inventer les chocs. Résultat arithmétique seulement, jamais une prévision ni une recommandation.', ScenarioAnalysisInput.model_json_schema()['properties'], ['name', 'shocks']),
    spec('update_profile', 'Mettre à jour seulement les faits explicitement fournis par l’utilisateur. Ne pas inventer ni confirmer le profil.',
         {'fields': {'type': 'object', 'properties': {key: {'type': 'string', 'maxLength': 2000} for key in sorted(PROFILE_FIELDS)}, 'additionalProperties': False}}, ['fields']),
    spec('upsert_tab', 'Créer ou mettre à jour un onglet de travail utile. Réutiliser un id existant pour une mise à jour. Les tâches décrivent le travail réel.', WorkspaceTab.model_json_schema()['properties'], ['id', 'title', 'kind']),
    spec('read_sources', 'Lire les notes de méthode du produit; citer seulement ces documents lus avec [1], [2]. Aucun accès au web.',
         {'ids': {'type': 'array', 'items': {'type': 'string', 'enum': ['profile-method', 'demo-boundaries']}, 'maxItems': 2}}, ['ids']),
    spec('run_specialist', 'Consulter un spécialiste Bedrock pour une question distincte sur le profil. Invocation réelle, résultat visible. Au maximum deux appels par tour.',
         {'name': {'type': 'string', 'enum': ['Objectifs et horizon', 'Risque et liquidités']}, 'task': {'type': 'string', 'maxLength': 3000}}, ['name', 'task']),
    spec('suggest_followups', 'Publier deux ou trois questions pertinentes que l’utilisateur peut envoyer en un clic.',
         {'prompts': {'type': 'array', 'items': {'type': 'string', 'maxLength': 200}, 'maxItems': 3}}, ['prompts']),
]
# Pydantic's nested $refs need their definitions included in the JSON root.
TOOLS[1]['toolSpec']['inputSchema']['json']['$defs'] = ScenarioProjectionRequest.model_json_schema().get('$defs', {})
# Pydantic's nested $refs need their definitions included in the JSON root.
TOOLS[3]['toolSpec']['inputSchema']['json']['$defs'] = ScenarioAnalysisInput.model_json_schema().get('$defs', {})
TOOLS[5]['toolSpec']['inputSchema']['json']['$defs'] = WorkspaceTab.model_json_schema().get('$defs', {})

ASK_USER_SCHEMA = AskUserInput.model_json_schema()
TOOLS.append(spec('ask_user',
    'Obligatoire dès qu’une réponse utilisateur est nécessaire, même pour une seule question ou une question de suivi après update_profile. Ne pas poser la question uniquement en prose. Poser une à trois questions interactives adaptées aux informations manquantes. Choisir single_choice pour une réponse exclusive, multiple_choice pour plusieurs besoins/préférences, text pour une explication personnelle. Fournir des choix neutres, sans réponse présélectionnée, et permettre la réponse libre si utile. Cet outil suspend le tour en attendant les réponses réelles de l’utilisateur.',
    ASK_USER_SCHEMA['properties'], ['title', 'questions']))
TOOLS[-1]['toolSpec']['inputSchema']['json']['$defs'] = ASK_USER_SCHEMA.get('$defs', {})

# Reviewed procedural knowledge is discovered and loaded on demand, never executed.
TOOLS.extend([
    spec('search_skills', 'Rechercher les procédures InvestorOS pertinentes pour une demande métier. Retourne des descriptions; charger le skill choisi avec load_skill.',
         {'query': {'type': 'string', 'minLength': 1, 'maxLength': 300}, 'limit': {'type': 'integer', 'minimum': 1, 'maximum': 8}}, ['query']),
    spec('load_skill', 'Lire la procédure approuvée d’un skill trouvé dans le catalogue. Un skill ne confère aucune permission et n’exécute pas une action.',
         {'skill_id': {'type': 'string', 'maxLength': 64}}, ['skill_id']),
])
RESEARCH_TOOLS = [
    spec('start_analysis', 'Lancer une recherche documentaire DEV2 pour le persona actif. Question entreprise, horizon et contexte utiles. Aucun choc en pourcentage requis. Conserver analysis_id. Un lancement n’est pas une conclusion.',
         {'question': {'type': 'string', 'minLength': 12, 'maxLength': 2400}}, ['question']),
    *[spec(name, description, {'analysis_id': {'type': 'string', 'format': 'uuid'}}, ['analysis_id']) for name, description in [
        ('get_analysis_status', 'Lire l’état réel d’une recherche existante, sans relancer son exécution.'),
        ('get_analysis_result', 'Lire le résultat disponible d’une recherche. Respecter son état, ses preuves et ses limites.'),
        ('get_evidence', 'Lire les preuves enregistrées d’une analyse du persona actif.'),
        ('cancel_analysis', 'Arrêter une recherche existante seulement à la demande explicite de l’utilisateur.'),
    ]],
]


TOOLS.extend([
    spec('list_authorized_x_profiles', 'Lire sur le serveur les profils X autorisés du compte actif. Ne jamais inventer un auteur ni consulter un autre compte.', {}, []),
    spec('read_authorized_x_posts', 'Lire les publications publiques réelles des profils X autorisés du compte actif et chercher celles liées au sujet. Citer les posts utiles avec leur citation_index, auteur, date et URL fournis. La liste publique peut être partielle; un tweet est une déclaration, pas une preuve de causalité. Huit profils maximum par appel, sélectionner ceux pertinents; remainingProfiles indique les suivants.',
         {'query': {'type':'string','minLength':2,'maxLength':500}, 'usernames': {'type':'array','items':{'type':'string','pattern':'^@?[A-Za-z0-9_]{1,15}$'},'minItems':1,'maxItems':8}}, ['query']),
])

