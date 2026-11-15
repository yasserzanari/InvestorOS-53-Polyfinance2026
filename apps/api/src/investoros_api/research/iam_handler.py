"""Narrow Lambda Invoke entry for trusted IAM callers, separate from HTTP JWT entry."""
import json
import re
from copy import deepcopy

from fastapi import FastAPI
from mangum import Mangum

from investoros_api.research.router import router

_app = FastAPI()
_app.include_router(router)
_handler = Mangum(_app)
_UUID = r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'


def handle(event, context):
    denied = {'statusCode':403,'body':json.dumps({'detail':'Operation not allowed on the IAM research entry'})}
    if not isinstance(event, dict) or event.get('source') != 'investoros.research-iam' or 'requestContext' in event:
        return denied
    request = event.get('request')
    if not isinstance(request, dict) or request.get('version') != '2.0':
        return denied
    request_context = request.get('requestContext')
    http = request_context.get('http') if isinstance(request_context, dict) else None
    if not isinstance(http, dict):
        return denied
    method = http.get('method')
    path = request.get('rawPath')
    # Mangum routes HTTP v2 requests by http.path, not by rawPath.
    if not isinstance(path, str) or http.get('path') != path:
        return denied
    read = method == 'GET' and (path == '/v1/research/sources' or re.fullmatch(r'/v1/research/analyses(?:/'+_UUID+r'(?:/events|/evidence)?)?', path))
    write = method == 'POST' and (path == '/v1/research/analyses' or re.fullmatch(r'/v1/research/analyses/'+_UUID+r'/cancel', path))
    if not (read or write):
        return denied
    forwarded = deepcopy(request)
    # IAM invocation does not establish a Cognito/Gateway JWT identity.
    forwarded['requestContext'].pop('authorizer', None)
    forwarded['requestContext'].pop('apiId', None)
    principal_hash = forwarded['requestContext'].get('trustedPrincipalHash')
    invalid_hash = principal_hash is not None and (
        not isinstance(principal_hash, str) or not re.fullmatch(r'[0-9a-f]{64}', principal_hash)
    )
    if invalid_hash:
        return denied
    return _handler(forwarded, context)
