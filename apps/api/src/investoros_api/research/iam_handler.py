"""Narrow Lambda Invoke entry for trusted IAM callers, separate from HTTP JWT entry."""
import json
import re
from fastapi import FastAPI
from mangum import Mangum
from investoros_api.research.router import router

_app = FastAPI()
_app.include_router(router)
_handler = Mangum(_app)
_UUID = r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'


def handle(event, context):
    request = event.get('request', {})
    method = request.get('requestContext', {}).get('http', {}).get('method')
    path = request.get('rawPath', '')
    read = method == 'GET' and re.fullmatch(r'/v1/research/analyses(?:/'+_UUID+r'(?:/events|/evidence)?)?', path)
    write = method == 'POST' and (path == '/v1/research/analyses' or re.fullmatch(r'/v1/research/analyses/'+_UUID+r'/cancel', path))
    if event.get('source') != 'investoros.research-iam' or 'requestContext' in event or not (read or write):
        return {'statusCode':403,'body':json.dumps({'detail':'Operation not allowed on the IAM research entry'})}
    return _handler(request, context)
