"""Allowlisted model tools; schemas are sent directly to Bedrock Converse."""
from .models import AskUserInput, PROFILE_FIELDS, WorkspaceTab

def spec(name: str, description: str, properties: dict, required: list[str]) -> dict:
    return {'toolSpec': {'name': name, 'description': description, 'inputSchema': {'json': {
        'type': 'object', 'properties': properties, 'required': required, 'additionalProperties': False,
    }}}}

TOOLS = [
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
TOOLS[1]['toolSpec']['inputSchema']['json']['$defs'] = WorkspaceTab.model_json_schema().get('$defs', {})

ASK_USER_SCHEMA = AskUserInput.model_json_schema()
TOOLS.append(spec('ask_user',
    'Poser une à trois questions interactives adaptées aux informations manquantes. Choisir single_choice pour une réponse exclusive, multiple_choice pour plusieurs besoins/préférences, text pour une explication personnelle. Fournir des choix neutres, sans réponse présélectionnée, et permettre la réponse libre si utile. Cet outil suspend le tour en attendant les réponses réelles de l’utilisateur.',
    ASK_USER_SCHEMA['properties'], ['title', 'questions']))
TOOLS[-1]['toolSpec']['inputSchema']['json']['$defs'] = ASK_USER_SCHEMA.get('$defs', {})
