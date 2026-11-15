"""HTTP adapter. NDJSON avoids buffering real text/tool/agent events in local development."""
import json
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse, StreamingResponse
from .models import ChatRequest
from .service import configuration, run_chat
from .sources import SOURCES
from .research_bridge import research_history, research_snapshot, forward_research_authorization
from investoros_api.demo_contexts import PersonaId

router = APIRouter(prefix='/v1/profiles', tags=['profiles'])

@router.get('/status')
def status():
    return configuration()

@router.get('/sources/{source_id}', response_class=PlainTextResponse)
def source(source_id: str):
    item = SOURCES.get(source_id)
    if not item:
        raise HTTPException(404, 'Source inconnue')
    return f"{item['title']}\n\n{item['text']}\n\nSource : notes de méthode du produit InvestorOS."

@router.post('/chat')
def chat(request: ChatRequest, http_request: Request):
    authorization = http_request.headers.get('authorization', '')
    def events():
        with forward_research_authorization(authorization):
            for event in run_chat(request):
                yield json.dumps(event, ensure_ascii=False) + '\n'
    return StreamingResponse(events(), media_type='application/x-ndjson',
                             headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})

@router.get('/research/analyses')
def research_analyses(http_request: Request, accountId: PersonaId = 'mateo', limit: int = Query(default=30, ge=1, le=60)):
    try:
        with forward_research_authorization(http_request.headers.get('authorization', '')):
            return research_history(accountId, limit)
    except ValueError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

@router.get('/research/{analysis_id}')
def research_progress(analysis_id: str, http_request: Request, accountId: PersonaId = 'mateo'):
    try:
        with forward_research_authorization(http_request.headers.get('authorization', '')):
            return research_snapshot(analysis_id, accountId)
    except ValueError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
