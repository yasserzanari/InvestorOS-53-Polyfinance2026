"""Allowlisted model tools; schemas are sent directly to Bedrock Converse."""
from ..simulation import ScenarioProjectionRequest
from .models import AssistantPlanInput, AskUserInput, PROFILE_FIELDS, ScenarioAnalysisInput, SimulationHistoryInput, WorkspaceTab

def spec(name: str, description: str, properties: dict, required: list[str]) -> dict:
    return {'toolSpec': {'name': name, 'description': description, 'inputSchema': {'json': {
        'type': 'object', 'properties': properties, 'required': required, 'additionalProperties': False,
    }}}}

TOOLS = [
    spec('inspect_simulation_history', 'Lire les prix ajustés et événements d’entreprise réellement présents dans Simulation pour un ticker configuré. Appeler pour toute question sur l’historique ou les rendements observés après événement. La coïncidence temporelle ne prouve pas une causalité; les données sont historiques, pas en temps réel.',
         SimulationHistoryInput.model_json_schema()['properties'], ['ticker']),
    spec('project_market_scenarios', 'Calculer des trajectoires Simulation sur un ticker configuré. Appeler uniquement lorsque la personne a explicitement fourni chaque choc en pourcentage et son jalon; sinon utiliser ask_user. Chaque branche exige id, title, shockPct et exactement un jalon. event est un libellé français facultatif; s’il manque, le serveur reprend title en le qualifiant d’hypothèse. Fournir exactement un horizon : horizonObservations pour des séances ou horizonDays pour des jours calendaires. Les quantiles historiques sont marginaux, sans probabilité ni valeur prédictive.',
         ScenarioProjectionRequest.model_json_schema()['properties'], ['ticker', 'branches']),
    spec('analyze_demo_portfolio', 'Lire le portefeuille fictif fixe de ce déploiement et calculer ses pondérations et sa concentration. Obligatoire avant de répondre à une question sur l’adéquation d’un actif, une préférence, une diversification, les positions ou la répartition du persona. Les rendements et risques historiques sont indisponibles sans série de prix; ne pas déduire les titres sous-jacents des catégories.', {}, []),
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
upsert_schema = next(tool['toolSpec']['inputSchema']['json'] for tool in TOOLS if tool['toolSpec']['name'] == 'upsert_tab')
upsert_schema['properties']['kind']['enum'].remove('network')
# Display metadata is derived by the tool adapter; financial inputs remain required.
branch_schema=TOOLS[1]['toolSpec']['inputSchema']['json']['$defs']['ScenarioBranch']
branch_schema['required']=[field for field in branch_schema['required'] if field!='event']
# Pydantic's nested $refs need their definitions included in the JSON root.
TOOLS[3]['toolSpec']['inputSchema']['json']['$defs'] = ScenarioAnalysisInput.model_json_schema().get('$defs', {})
TOOLS[5]['toolSpec']['inputSchema']['json']['$defs'] = WorkspaceTab.model_json_schema().get('$defs', {})

TOOLS.append(spec('publish_plan',
    'Afficher un plan structuré dans la conversation. Utiliser quand la personne demande un plan ou avant de faire approuver une recherche importante. Le plan doit être concret, adapté aux données réellement disponibles et comporter trois à six étapes; chaque étape a un identifiant unique et un titre clair, avec un détail facultatif. Cet outil affiche le plan; il n’exécute aucune étape et ne remplace pas upsert_tab pour une liste de tâches persistante.',
    AssistantPlanInput.model_json_schema()['properties'], ['title', 'steps']))
TOOLS[-1]['toolSpec']['inputSchema']['json']['$defs'] = AssistantPlanInput.model_json_schema().get('$defs', {})

ASK_USER_SCHEMA = AskUserInput.model_json_schema()
TOOLS.append(spec('ask_user',
    'Obligatoire dès qu’une réponse utilisateur est nécessaire, même pour une seule question ou une question de suivi après update_profile. Ne pas poser la question uniquement en prose. Poser une à trois questions interactives adaptées aux informations manquantes. Choisir single_choice pour une réponse exclusive, multiple_choice pour plusieurs besoins/préférences, text pour une explication personnelle. Fournir des choix neutres, sans réponse présélectionnée, et permettre la réponse libre si utile. Pour confirmer une recherche importante, seulement après avoir montré le plan visible en trois à six étapes, utiliser purpose="plan_approval" avec une unique question single_choice et les options exactes « Oui, lancer ce plan » et « Modifier le plan ». Cet outil suspend le tour en attendant les réponses réelles de l’utilisateur.',
    ASK_USER_SCHEMA['properties'], ['questions']))
TOOLS[-1]['toolSpec']['inputSchema']['json']['$defs'] = ASK_USER_SCHEMA.get('$defs', {})

# Reviewed procedural knowledge is discovered and loaded on demand, never executed.
TOOLS.extend([
    spec('search_skills', 'Rechercher les procédures InvestorOS pertinentes pour une demande métier. Retourne des descriptions; charger le skill choisi avec load_skill.',
         {'query': {'type': 'string', 'minLength': 1, 'maxLength': 300}, 'limit': {'type': 'integer', 'minimum': 1, 'maximum': 8}}, ['query']),
    spec('load_skill', 'Lire la procédure approuvée d’un skill trouvé dans le catalogue. Un skill ne confère aucune permission et n’exécute pas une action.',
         {'skill_id': {'type': 'string', 'maxLength': 64}}, ['skill_id']),
])
RESEARCH_TOOLS = [
    spec('list_research_analyses', 'Retrouver les dossiers de recherche existants du compte actif, avec identifiant, question, état et dates. Utiliser avant inspect_market_movements quand l’identifiant de l’analyse n’est plus dans le contexte; ne pas demander à la personne de copier un UUID ni relancer un dossier existant.', {}, []),
    spec('inspect_market_movements', 'Rapprocher les fortes variations historiques d’un titre des documents effectivement lus dans une analyse existante du compte actif. Lecture complémentaire bornée du flux officiel seulement si sa politique l’autorise. Conserve les dates/heures, liens et extraits. Un contexte proche d’une hausse ou d’une baisse ne prouve pas sa cause; ne jamais inventer un scandale ou déduire une raison d’un titre. Cet outil ne lance pas une nouvelle analyse.',
         {'analysis_id': {'type': 'string', 'format': 'uuid'},
          'ticker': {'type': 'string', 'pattern': '^[A-Za-z0-9.^=-]{1,16}$'},
          'startDate': {'type': 'string', 'format': 'date'},
          'endDate': {'type': 'string', 'format': 'date'},
          'thresholdPct': {'type': 'number', 'minimum': .5, 'maximum': 30}}, ['analysis_id', 'ticker']),
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

TOOLS.extend([
 spec('estimate_market_trajectories', 'Estimer une référence quantitative par bootstrap historique, sans demander de choc. Utiliser pour une demande de trajectoires estimées; indiquer date de départ, horizon en séances, diagnostic de validation et limites. Ne prédit pas l’effet d’un événement.', {'ticker':{'type':'string','pattern':'^[A-Za-z0-9.^=-]{1,16}$'},'horizonObservations':{'type':'integer','minimum':1,'maximum':120}}, ['ticker','horizonObservations']),
 spec('inspect_supply_chain', 'Rechercher les fournisseurs documentés, revenus trimestriels SEC et événements sourcés pour une entreprise; ouvre le tab dédié Graphe/Liste/Pressions/Événements. Couverture incomplète explicite. Réutiliser analysis_id pour les documents déjà collectés.', {'ticker':{'type':'string','minLength':1,'maxLength':120}, 'analysis_id':{'type':'string','format':'uuid'}}, ['ticker']),
])


from .decision import CompareInput, InsightInput
TOOLS.extend([
    spec('compare_profile_instruments', 'À utiliser uniquement si la personne demande explicitement une comparaison historique de cours ou de rendements. Interdit pour évaluer l’adéquation au profil, un objectif, une tolérance au risque ou la diversification : charger portfolio-exposures et appeler analyze_demo_portfolio à la place. Comparer deux ou trois actifs sur mêmes dates/devise; historique descriptif seulement, sans verdict de convenance ni recommandation. Un titre absent de l’univers reste non couvert; ne pas improviser de réponse de substitution.', CompareInput.model_json_schema()['properties'], ['tickers']),
    spec('publish_profile_insight', 'Publier dans Alignement un constat concret : faits du profil, chiffres ou faits réellement reçus et tension conditionnelle ou inconnue utile. summary : deux phrases ciblées, idéalement 250 à 450 caractères, maximum 800; aucune annonce « Voici les constats… ». Après analyze_demo_portfolio, les poids sont joints par le serveur à la carte : expliquer la conséquence utile sans recopier toute la liste. Ne pas qualifier la concentration faible/modérée/élevée sans seuil fourni. clarification exige une nextQuestion ciblée terminée par ?; tension/partial exige une alternative ciblée ou une question. Les pistes respectent les contraintes déclarées, sans achat/vente/réallocation. Relier uniquement les preuves reçues; sans preuve marché, limiter le constat au profil et aux inconnues. Ne pas inventer mesure, classement de risque ou convenance.', InsightInput.model_json_schema()['properties'], ['title','question','status','summary','fields']),
    spec('open_profile_view', 'Ouvrir une section du profil à droite : aperçu, objectifs, situation facultative, risque, préférences ou mémoire. Les anciennes vues restent acceptées pour compatibilité. Les vues restent accessibles à la personne; cet outil ne fabrique aucun résultat.', {'view':{'type':'string','enum':['overview','objectives','situation','risk','preferences','memory','profile','alignment','comparison','scenarios','evidence','documents']},'documentId':{'type':'string','minLength':1,'maxLength':80,'description':'Identifiant du document existant à sélectionner dans Documents ou Scénarios.'}}, ['view']),
])

TOOLS.append(spec('close_profile_document', 'Fermer un document de travail seulement si la personne le demande explicitement. Le profil personnel reste intact. Ne pas fermer automatiquement un document pour libérer une place.', {'id':{'type':'string','minLength':1,'maxLength':80,'pattern':'^[a-zA-Z0-9_-]+$'}}, ['id']))

TOOLS.append(spec('get_simulation_capabilities', 'Vérifier la disponibilité réelle des historiques et les limites des horizons, unités et titres avant une simulation. Ne calcule aucun scénario.', {}, []))

TOOLS.append(spec('render_portfolio_widget',
    'Afficher une carte interactive dans le chat pour le portefeuille fictif du compte actif. '
    'Charger portfolio-visual-widgets. Choisir portfolio pour valeur et évolution, heatmap pour '
    'la carte des positions, allocation pour la répartition, contributions pour les gains et pertes, '
    'sectors pour les expositions et variations sectorielles. Les données et limites viennent du serveur; '
    'ne jamais inventer des titres, des rendements ou une composition de fonds. Ne crée pas un onglet.',
    {'view': {'type': 'string', 'enum': ['portfolio', 'heatmap', 'allocation', 'contributions', 'sectors']},
     'period': {'type': 'string', 'enum': ['1D', '1W', '1M', '1Y']}}, ['view']))

# Typed section contracts. Never ask the model to invent a JSON document schema.
from .profile_sections import SituationPatch, ControlsToolPatch, GoalsUpdate
TOOLS.append(spec('get_profile_details', 'Lire les valeurs actuelles du profil, des projets, de la situation facultative et des préférences avant une correction. Les inconnues restent inconnues.', {}, []))
for name,model,description in [
 ('update_profile_situation',SituationPatch,'Enregistrer uniquement les informations facultatives explicitement fournies : revenu et stabilité, liquidités, actifs, dettes, contexte personnel. Ne jamais les exiger pour accéder à la démonstration.'),
 ('update_profile_controls',ControlsToolPatch,'Modifier seulement les contrôles explicitement déclarés : expérience par produit, ancienneté, ESG, secteurs séparés par |, complexité, apprentissage, liquidité minimale. Fusion partielle : préserver les autres valeurs et les précisions ESG. Fonds (OPC) utilise experience-fonds-opc et years-fonds-opc; ETF utilise experience-etf et years-etf. horizon et withdrawals sont des alias des champs généraux; income et debt de la situation.'),
 ('update_profile_goals',GoalsUpdate,'Enregistrer les projets structurés dans la carte Objectifs. Lire get_profile_details avant modification; goals fusionne les projets par id stable et conserve les autres. deleteIds supprime uniquement les identifiants explicitement demandés par la personne. Un seul Principal, horizons de 1 à 50 ans ou horizonYears null avec horizonLabel qualitatif, montants facultatifs. Ne rien inventer; le projet principal synchronise objectif et horizon généraux. targetDate est facultative et ne doit pas être inventée.'),
]:
 schema=model.model_json_schema()
 tool=spec(name,description,schema['properties'],schema.get('required',[]))
 if '$defs' in schema:tool['toolSpec']['inputSchema']['json']['$defs']=schema['$defs']
 TOOLS.append(tool)
