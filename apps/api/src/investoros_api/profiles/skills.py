"""Read-only, bounded discovery of reviewed procedures; never execute skill code."""
import hashlib
import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path


def _terms(value: str) -> set[str]:
    normalized = unicodedata.normalize('NFKD', value.casefold())
    return set(re.findall(r'[a-z0-9]+', ''.join(c for c in normalized if not unicodedata.combining(c))))


@lru_cache(maxsize=1)
def _catalog() -> dict:
    snapshot = json.loads(Path(__file__).with_name('skills_snapshot.json').read_text())
    for item in snapshot['skills']:
        if hashlib.sha256(item['content'].encode()).hexdigest() != item['sha256']:
            raise ValueError('Skill snapshot integrity failure')
    return snapshot


def search_skills(query: str, limit: int = 4) -> dict:
    if not isinstance(query, str) or not 1 <= len(query.strip()) <= 300:
        raise ValueError('Recherche de skills : 1 à 300 caractères.')
    if type(limit) is not int or not 1 <= limit <= 8:
        raise ValueError('Maximum de 1 à 8 résultats.')
    words = _terms(query)
    ranked = []
    for item in _catalog()['skills']:
        score = len(words & _terms(' '.join([item['id'], item['description'], *item['tags']])))
        if score:
            ranked.append((score, item))
    ranked.sort(key=lambda pair: (-pair[0], pair[1]['id']))
    return {'version': _catalog()['version'], 'skills': [
        {key: item[key] for key in ('id', 'description', 'required_tools', 'sha256')}
        for _, item in ranked[:limit]], 'instructions': 'Charger le contenu pertinent avec load_skill avant de suivre sa procédure.'}


def load_skill(skill_id: str) -> dict:
    item = next((entry for entry in _catalog()['skills'] if entry['id'] == skill_id), None)
    if item is None:
        raise ValueError('Skill inconnu dans le catalogue approuvé.')
    return {key: item[key] for key in ('id', 'description', 'required_tools', 'content', 'sha256')} | {'version': _catalog()['version']}


def catalog_summary() -> list[dict]:
    return [{'id': item['id'], 'description': item['description']} for item in _catalog()['skills']]


def catalog_version() -> str:
    return _catalog()['version']
