"""Local browser learning jobs with persisted progress and validated screenshots."""
import ipaddress
import json
import os
import socket
import subprocess
import sys
from pathlib import Path
from threading import Lock, Thread
from urllib.parse import urlsplit
from uuid import uuid4, UUID
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from investoros_api.source_store import Account

router = APIRouter(prefix='/v1/simulation/source-learning', tags=['sources'])
_lock = Lock()
ROOT = Path(__file__).resolve().parents[4]
JOBS = Path.home() / '.local/share/investoros/source-learning'

class LearnRequest(BaseModel):
    url: str


def _folder(account, job):
    try:
        UUID(job)
    except ValueError:
        raise HTTPException(422, 'Identifiant invalide.')
    folder = JOBS / account / job
    if not folder.exists():
        raise HTTPException(404, 'Apprentissage introuvable.')
    return folder


def _run(url, folder):
    try:
        with _lock:
            with (folder / 'worker.log').open('w') as log:
                subprocess.run(['node', str(ROOT / 'scripts/learn-source.mjs'), url, str(folder)], cwd=ROOT,
                               stdout=log, stderr=log, timeout=240,
                               env={**os.environ, 'API_ANYTHING_LOCAL_ONLY': '1', 'SOURCE_PYTHON': sys.executable})
            state = json.loads((folder/'state.json').read_text())
            if state['status'] == 'running':
                raise RuntimeError('Le processus d’apprentissage s’est interrompu.')
    except Exception:
        path = folder/'state.json'
        state = json.loads(path.read_text()) if path.exists() else {'events': []}
        state.update(status='error')
        state['events'].append({'message':'L’apprentissage a été interrompu ou a dépassé son délai.'})
        path.write_text(json.dumps(state))


@router.post('/{account}')
def start_learning(account: Account, request: LearnRequest):
    parts = urlsplit(request.url)
    if parts.scheme != 'https' or not parts.hostname or parts.username or parts.password or parts.port not in (None,443):
        raise HTTPException(422, 'Utilisez le lien HTTPS d’une page publique.')
    try:
        addresses = socket.getaddrinfo(parts.hostname,443)
        if not addresses or any(not ipaddress.ip_address(row[4][0]).is_global for row in addresses):
            raise ValueError()
    except (OSError, ValueError):
        raise HTTPException(422, 'Ce domaine public ne peut pas être contacté.')
    job = str(uuid4())
    folder = JOBS/account/job
    folder.mkdir(parents=True)
    (folder/'state.json').write_text(json.dumps({'status':'running','events':[{'message':'Apprentissage en attente du navigateur.'}],'frame':0,'url':request.url}))
    Thread(target=_run,args=(request.url,folder),daemon=True).start()
    return {'id':job}


@router.get('/{account}/{job}')
def learning_status(account: Account, job: str):
    return json.loads((_folder(account,job)/'state.json').read_text())


@router.get('/{account}/{job}/frame/{frame}')
def learning_frame(account: Account, job: str, frame: int):
    path = _folder(account,job)/f'frame-{frame}.png'
    if not path.exists():
        raise HTTPException(404,'Capture indisponible.')
    return FileResponse(path,media_type='image/png')
