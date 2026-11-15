"""HTTP adapter. NDJSON avoids buffering real text/tool/agent events in local development."""
import json
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field
from fastapi.responses import PlainTextResponse, StreamingResponse
from .models import ChatRequest
from .service import configuration, run_chat
from .sources import SOURCES
from .research_bridge import research_history, research_snapshot, forward_research_authorization, _call
from investoros_api.demo_contexts import PersonaId

router = APIRouter(prefix='/v1/profiles', tags=['profiles'])

class MovementInvestigationRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    ticker: str = Field(pattern=r'^[A-Za-z0-9.^=-]{1,16}$')
    accountId: PersonaId = 'mateo'
    previousDate: str = Field(pattern=r'^\d{4}-\d{2}-\d{2}$')
    date: str = Field(pattern=r'^\d{4}-\d{2}-\d{2}$')

@router.post('/research/{analysis_id}/movement-investigation')
def movement_investigation(analysis_id: str, body: MovementInvestigationRequest, http_request: Request):
    from .movement_analysis import investigate_movement
    try:
        with forward_research_authorization(http_request.headers.get('authorization', '')):
            return investigate_movement(analysis_id, body.accountId, body.ticker, body.previousDate, body.date)
    except ValueError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

@router.get('/status')
def status():
    return configuration()

@router.post('/voice/session')
def voice_session():
    """Issue a short-lived Amazon Transcribe WebSocket URL for live dictation."""
    from botocore.auth import SigV4QueryAuth
    from botocore.awsrequest import AWSRequest
    import boto3

    region = configuration()['region']
    credentials = boto3.Session().get_credentials()
    if credentials is None:
        raise HTTPException(503, 'Les identifiants AWS de transcription ne sont pas configurés.')
    host = f'transcribestreaming.{region}.amazonaws.com:8443'
    params = {
        'language-code': 'fr-CA',
        'media-encoding': 'pcm',
        'sample-rate': '16000',
    }
    request = AWSRequest(method='GET', url=f'wss://{host}/stream-transcription-websocket', params=params)
    SigV4QueryAuth(credentials, 'transcribe', region, expires=60).add_auth(request)
    return {'url': request.url, 'language': 'fr-CA', 'sampleRate': 16000, 'expiresIn': 60}

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
        iterator = iter(run_chat(request))
        try:
            while True:
                # StreamingResponse advances this iterator in separate worker contexts.
                # Complete token cleanup before yielding across that boundary.
                with forward_research_authorization(authorization):
                    try:
                        event = next(iterator)
                    except StopIteration:
                        break
                yield json.dumps(event, ensure_ascii=False) + '\n'
        finally:
            iterator.close()
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


@router.get('/research')
def research_library(http_request: Request, accountId: PersonaId = 'mateo'):
    try:
        with forward_research_authorization(http_request.headers.get('authorization', '')):
            return _call('GET', '/analyses', accountId)
    except ValueError as error:
        raise HTTPException(502, str(error)) from error

@router.get('/research-network/{ticker}')
def research_network(ticker: str):
    from .network_evidence import network_for
    return network_for(ticker)


@router.get('/research/{analysis_id}/movements')
def research_movements(analysis_id: str, http_request: Request,
                       ticker: str = Query(pattern=r'^[A-Za-z0-9.^=-]{1,16}$'),
                       accountId: PersonaId = 'mateo',
                       start: str | None = Query(default=None, pattern=r'^\d{4}-\d{2}-\d{2}$'),
                       end: str | None = Query(default=None, pattern=r'^\d{4}-\d{2}-\d{2}$'),
                       thresholdPct: float = Query(default=5, ge=.5, le=30),
                       refresh: bool = False):
    from .market_movement_service import movement_report
    try:
        with forward_research_authorization(http_request.headers.get('authorization', '')):
            return movement_report(analysis_id, accountId, ticker, start, end, thresholdPct, refresh)
    except ValueError as error:
        raise HTTPException(502, str(error)) from error


from .decision import CompareInput, compare_instruments

@router.post('/compare')
def compare_profile_instruments(query: CompareInput):
    try:
        return compare_instruments(query)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
