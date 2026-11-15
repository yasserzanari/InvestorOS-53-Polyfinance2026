#!/usr/bin/env python3
"""Validate a reviewed skills repository and embed a reproducible runtime snapshot."""
import argparse
import hashlib
import json
from pathlib import Path


def build_snapshot(source: Path) -> dict:
    source = source.resolve()
    catalog = json.loads((source / 'catalog.json').read_text())
    entries = []
    seen = set()
    for item in catalog['skills']:
        identifier = item['id']
        if identifier in seen or not identifier or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in identifier):
            raise ValueError('Invalid or duplicate skill identifier')
        seen.add(identifier)
        path = (source / item['path']).resolve()
        if not path.is_relative_to(source) or path.name != 'SKILL.md':
            raise ValueError('Skill path must remain inside the source repository')
        content = path.read_text()
        if len(content) > 12000 or not content.startswith(f'---\nname: {identifier}\n') or '\ndescription: ' not in content:
            raise ValueError(f'Invalid skill metadata: {identifier}')
        entries.append({**item, 'content': content, 'sha256': hashlib.sha256(content.encode()).hexdigest()})
    if not 1 <= len(entries) <= 50:
        raise ValueError('Catalog must contain 1 to 50 skills')
    return {'version': catalog['version'], 'skills': entries}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    args = parser.parse_args()
    target = Path(__file__).resolve().parents[1] / 'apps/api/src/investoros_api/profiles/skills_snapshot.json'
    snapshot = build_snapshot(args.source)
    tmp = target.with_suffix('.tmp')
    tmp.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
    tmp.replace(target)
    print(f"Embedded {len(snapshot['skills'])} skills, version {snapshot['version']}")
