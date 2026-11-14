"""HTTP adapter. NDJSON avoids buffering real text/tool/agent events in local development."""
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse, StreamingResponse
from .models import ChatRequest
from .service import configuration, run_chat
from .sources import SOURCES

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
def chat(request: ChatRequest):
    def events():
        for event in run_chat(request):
            yield json.dumps(event, ensure_ascii=False) + '\n'
    return StreamingResponse(events(), media_type='application/x-ndjson',
                             headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})
