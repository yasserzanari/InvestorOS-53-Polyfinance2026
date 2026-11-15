#!/usr/bin/env python3
"""Reject destructive infrastructure changes; allow rotation of the Lambda ZIP only."""
import json
import re
import sys


def artifact_rotation(item):
    change = item.get('change', {})
    before, after = change.get('before') or {}, change.get('after') or {}
    paths = change.get('replace_paths', [])
    pattern = r'assistant-simulation/api-[a-f0-9]{64}\.zip'
    return (item.get('address') == 'aws_s3_object.api_package'
            and change.get('actions') in (['delete', 'create'], ['create', 'delete'])
            and paths == [['key']]
            and isinstance(before.get('bucket'), str) and before['bucket'] == after.get('bucket')
            and all(isinstance(obj.get('key'), str) and re.fullmatch(pattern, obj['key']) for obj in (before, after)))


def configured_addresses(module):
    addresses = {resource.get('address') for resource in module.get('resources', [])}
    for child in module.get('module_calls', {}).values():
        addresses.update(configured_addresses(child.get('module', {})))
    return addresses


def validate(plan):
    configured = configured_addresses(plan.get('configuration', {}).get('root_module', {}))
    blocked = [item for item in plan.get('resource_changes', [])
               if 'delete' in item.get('change', {}).get('actions', []) and not artifact_rotation(item)]
    if blocked:
        descriptions = []
        for item in blocked:
            change = item.get('change', {})
            paths = change.get('replace_paths', [])
            detail = ', '.join('.'.join(str(part) for part in path) for path in paths) or 'suppression'
            declaration = 'présente dans la configuration' if item['address'] in configured else 'absente de la configuration'
            before = change.get('before') or {}
            after = change.get('after') or {}
            changed_fields = sorted(key for key in set(before) | set(after) if before.get(key) != after.get(key))
            fields = ', '.join(changed_fields) or 'indisponibles'
            descriptions.append(f"{item['address']} ({change.get('actions', [])}; {declaration}; champs déclencheurs: {detail}; champs modifiés: {fields})")
        raise ValueError('Suppression ou remplacement de ressource interdit : ' + '; '.join(descriptions))
    return [(item['address'], item['change']['actions']) for item in plan.get('resource_changes', [])
            if item.get('change', {}).get('actions') != ['no-op']]


if __name__ == '__main__':
    try:
        changes = validate(json.load(sys.stdin))
        print('Plan validé : seule la rotation du ZIP Lambda versionné est admise parmi les remplacements.')
        for address, actions in changes:
            print(f'- {address}: {actions}')
    except ValueError as error:
        print(error, file=sys.stderr)
        sys.exit(1)
