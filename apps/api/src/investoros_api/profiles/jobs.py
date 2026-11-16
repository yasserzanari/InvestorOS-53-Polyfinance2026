"""Bounded, short-lived chat jobs for API Gateway's buffered Lambda integration."""
from contextlib import contextmanager
from functools import lru_cache
import hashlib
import json
import os
import re
import time
from uuid import UUID, uuid4

import boto3
from boto3.dynamodb.conditions import Attr
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, HTTPException, Query, Request

from investoros_api.demo_contexts import PersonaId
from .models import ChatRequest
from .research_bridge import forward_research_authorization
from .service import run_chat

router = APIRouter(prefix='/v1/profiles/chat/jobs', tags=['profiles'])
MAX_REQUEST_BYTES = 200_000
MAX_EVENT_BYTES = 378_000
JOB_TTL_SECONDS = 3600
JOB_DEADLINE_SECONDS = 900
WORKER_LEASE_SECONDS = 330
WORKER_SOURCE = 'investoros.profile-chat-job'
_UNAVAILABLE = 'Le suivi de la réponse est temporairement indisponible. Réessayez.'
_FAILED = 'La réponse n’a pas pu être terminée. Les résultats déjà reçus restent disponibles.'
_EXPIRED = 'Le délai de cette réponse est dépassé. Les résultats déjà reçus restent disponibles.'


def _json(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False)


def _settings(require_queue=False):
    table = os.getenv('PROFILE_CHAT_JOBS_TABLE', '')
    queue_url = os.getenv('PROFILE_CHAT_QUEUE_URL', '') or os.getenv('PROFILE_CHAT_WORKER_FUNCTION', '')
    if not table or (require_queue and not queue_url):
        raise HTTPException(503, 'Les réponses asynchrones ne sont pas configurées sur ce serveur.')
    return table, queue_url


@lru_cache(maxsize=4)
def _table(name, region):
    return boto3.Session().resource('dynamodb', region_name=region, config=Config(
        connect_timeout=5, read_timeout=10,
        retries={'total_max_attempts': 2, 'mode': 'standard'},
    )).Table(name)


@lru_cache(maxsize=4)
def _sqs(region):
    return boto3.Session().client('sqs', region_name=region, config=Config(
        connect_timeout=5, read_timeout=10,
        retries={'total_max_attempts': 2, 'mode': 'standard'},
    ))


@lru_cache(maxsize=4)
def _lambda(region):
    """Real legacy dispatch while the explicit SQS infrastructure migration is pending."""
    return boto3.Session().client('lambda',region_name=region,config=Config(
        connect_timeout=5,read_timeout=10,retries={'total_max_attempts':2,'mode':'standard'}))


def _storage(require_queue=False):
    name, queue_url = _settings(require_queue)
    region = os.getenv('AWS_REGION', 'us-east-1')
    return _table(name, region), queue_url, region


def _error(code, message):
    return {'type': 'error', 'code': code, 'message': message}


def _write_events(table, job_id, token, events, status):
    encoded = _json(events)
    # Leave room for a terminal error if the next event is too large.
    if len(encoded.encode('utf-8')) > MAX_EVENT_BYTES - (1000 if status != 'failed' else 0):
        raise ValueError('result_too_large')
    table.update_item(
        Key={'job_id': job_id},
        UpdateExpression='SET eventsJson = :events, #status = :status, updatedAt = :now, eventCount = :count',
        ConditionExpression=Attr('status').eq('running') & Attr('workerToken').eq(token),
        ExpressionAttributeNames={'#status': 'status'},
        ExpressionAttributeValues={':events': encoded, ':status': status, ':now': int(time.time()), ':count': len(events)},
    )


@router.post('', status_code=202)
def start_job(request: ChatRequest, http_request: Request):
    """The caller is authenticated by the existing API Gateway/Lambda wrapper."""
    payload = _json(request.model_dump(mode='json'))
    if len(payload.encode('utf-8')) > MAX_REQUEST_BYTES:
        raise HTTPException(413, 'Le contexte est trop volumineux. Fermez certains documents avant de réessayer.')
    table, queue_url, region = _storage(require_queue=True)
    gateway_event = http_request.scope.get('aws.event', {})
    claims = gateway_event.get('requestContext', {}).get('authorizer', {}).get('jwt', {}).get('claims', {})
    subject = claims.get('sub') if isinstance(claims, dict) else None
    principal_hash = hashlib.sha256(subject.encode('utf-8')).hexdigest() if isinstance(subject, str) and subject.strip() else ''
    job_id, now = str(uuid4()), int(time.time())
    item = {'job_id': job_id, 'accountId': request.accountId, 'status': 'queued',
            'eventsJson': '[]', 'eventCount': 0, 'createdAt': now, 'updatedAt': now,
            'deadlineAt': now + JOB_DEADLINE_SECONDS, 'expiresAt': now + JOB_TTL_SECONDS}
    try:
        table.put_item(Item=item, ConditionExpression=Attr('job_id').not_exists())
        try:
            event={'source':WORKER_SOURCE,'jobId':job_id,'request':json.loads(payload),'principalHash':principal_hash}
            if os.getenv('PROFILE_CHAT_QUEUE_URL',''):
                response=_sqs(region).send_message(QueueUrl=queue_url,MessageBody=_json(event))
                if not response.get('MessageId'):raise RuntimeError('Queue did not acknowledge the job')
            else:
                # No synthetic success: the already-deployed Lambda must acknowledge the event.
                response=_lambda(region).invoke(FunctionName=queue_url,InvocationType='Event',Payload=_json(event).encode('utf-8'))
                if response.get('StatusCode')!=202:raise RuntimeError('Worker did not acknowledge the job')
        except (BotoCoreError, ClientError, RuntimeError):
            table.update_item(
                Key={'job_id': job_id},
                UpdateExpression='SET #status = :failed, eventsJson = :events, updatedAt = :now, eventCount = :count',
                ConditionExpression=Attr('status').eq('queued'),
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={':failed': 'failed', ':events': _json([_error('worker_unavailable', _FAILED)]), ':now': now, ':count': 1},
            )
            raise HTTPException(503, _UNAVAILABLE) from None
    except (BotoCoreError, ClientError):
        raise HTTPException(503, _UNAVAILABLE) from None
    return {'jobId': job_id, 'pollAfterMs': 700}


@router.get('/{job_id}')
def read_job(job_id: UUID, accountId: PersonaId = 'mateo', after: int = Query(default=0, ge=0)):
    table, _, _ = _storage()
    try:
        item = table.get_item(Key={'job_id': str(job_id)}, ConsistentRead=True).get('Item')
        now = int(time.time())
        if not item or item['accountId'] != accountId or int(item['expiresAt']) <= now:
            raise HTTPException(404, 'Réponse inconnue ou expirée.')
        if item['status'] in {'queued', 'running'} and int(item['deadlineAt']) <= now:
            events = json.loads(item['eventsJson'])
            terminal = _error('job_timeout', _EXPIRED)
            # Reserve room for a terminal error even if the worker filled its budget.
            if len(_json([*events, terminal]).encode('utf-8')) > MAX_EVENT_BYTES + 1000:
                terminal = _error('job_timeout', 'Délai dépassé. Réessayez.')
            try:
                table.update_item(
                    Key={'job_id': str(job_id)},
                    UpdateExpression='SET #status = :failed, eventsJson = :events, updatedAt = :now, eventCount = :count',
                    ConditionExpression=Attr('status').is_in(['queued', 'running']) & Attr('eventCount').eq(item['eventCount']),
                    ExpressionAttributeNames={'#status': 'status'},
                    ExpressionAttributeValues={':failed': 'failed', ':events': _json([*events, terminal]), ':now': now, ':count': len(events) + 1},
                )
                item = {**item, 'status': 'failed', 'eventsJson': _json([*events, terminal])}
            except table.meta.client.exceptions.ConditionalCheckFailedException:
                item = table.get_item(Key={'job_id': str(job_id)}, ConsistentRead=True).get('Item')
                if not item:
                    raise HTTPException(404, 'Réponse inconnue ou expirée.')
        events = json.loads(item['eventsJson'])
    except (BotoCoreError, ClientError):
        raise HTTPException(503, _UNAVAILABLE) from None
    error = next((event for event in reversed(events) if event.get('type') == 'error'), None)
    return {'jobId': str(job_id), 'accountId': accountId, 'status': item['status'],
            'events': events[after:], 'nextCursor': len(events), 'error': error}


@router.post('/{job_id}/cancel')
def cancel_job(job_id: UUID, accountId: PersonaId = 'mateo'):
    """Stop subsequent operations; an already running AWS call may still finish."""
    table, _, _ = _storage()
    try:
        for _ in range(3):
            item = table.get_item(Key={'job_id': str(job_id)}, ConsistentRead=True).get('Item')
            now = int(time.time())
            if not item or item['accountId'] != accountId or int(item['expiresAt']) <= now:
                raise HTTPException(404, 'Réponse inconnue ou expirée.')
            if item['status'] not in {'queued', 'running'}:
                return {'jobId': str(job_id), 'status': item['status']}
            events = json.loads(item['eventsJson'])
            events.append(_error('cancelled', 'La réponse est arrêtée. Les résultats déjà reçus restent disponibles.'))
            try:
                table.update_item(
                    Key={'job_id': str(job_id)},
                    UpdateExpression='SET #status = :cancelled, eventsJson = :events, updatedAt = :now, eventCount = :count',
                    ConditionExpression=Attr('status').is_in(['queued', 'running']) & Attr('eventCount').eq(item['eventCount']),
                    ExpressionAttributeNames={'#status': 'status'},
                    ExpressionAttributeValues={':cancelled': 'cancelled', ':events': _json(events), ':now': now, ':count': len(events)},
                )
                return {'jobId': str(job_id), 'status': 'cancelled'}
            except table.meta.client.exceptions.ConditionalCheckFailedException:
                continue
    except (BotoCoreError, ClientError):
        raise HTTPException(503, _UNAVAILABLE) from None
    raise HTTPException(409, 'La réponse évolue encore. Réessayez l’arrêt.')


@contextmanager
def _event_stream(request, principal_hash=''):
    iterator = iter(run_chat(request))
    try:
        with forward_research_authorization('', principal_hash):
            yield iterator
    finally:
        close = getattr(iterator, 'close', None)
        if close:
            close()


def execute_job(event):
    """Called only by the dedicated SQS-backed worker, never a browser route.

    The conditional claim prevents duplicate SQS deliveries from replaying a
    conversation. No JWT, password, or request body is persisted in DynamoDB.
    """
    if event.get('source') != WORKER_SOURCE:
        raise ValueError('Unknown worker event')
    job_id = str(UUID(event['jobId']))
    table, _, _ = _storage()
    item = table.get_item(Key={'job_id': job_id}, ConsistentRead=True).get('Item')
    if not item or int(item['expiresAt']) <= int(time.time()) or item['status'] != 'queued':
        return {'jobId': job_id, 'status': 'ignored'}
    token, now = str(uuid4()), int(time.time())
    try:
        table.update_item(
            Key={'job_id': job_id},
            UpdateExpression='SET #status = :running, workerToken = :token, workerLeaseUntil = :lease, updatedAt = :now',
            ConditionExpression=Attr('status').eq('queued'),
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={':running': 'running', ':token': token,
                                       ':lease': now + WORKER_LEASE_SECONDS, ':now': now},
        )
    except table.meta.client.exceptions.ConditionalCheckFailedException:
        return {'jobId': job_id, 'status': 'ignored'}
    published, pending = [], []
    last_flush = time.monotonic()
    last_check, previous_type = 0, ''
    try:
        request = ChatRequest.model_validate(event['request'])
        principal_hash = event.get('principalHash', '')
        if principal_hash and (not isinstance(principal_hash, str) or not re.fullmatch(r'[0-9a-f]{64}', principal_hash)):
            raise ValueError('invalid_principal')
        if request.accountId != item['accountId']:
            raise ValueError('account_mismatch')
        if int(item['deadlineAt']) <= now:
            raise TimeoutError('job_timeout')
        with _event_stream(request, principal_hash) as iterator:
            while True:
                if previous_type != 'text' or time.monotonic() - last_check >= .5:
                    current = table.get_item(Key={'job_id': job_id}, ConsistentRead=True).get('Item')
                    if not current or current['status'] != 'running' or current.get('workerToken') != token:
                        return {'jobId': job_id, 'status': 'superseded'}
                    last_check = time.monotonic()
                try:
                    entry = next(iterator)
                except StopIteration:
                    break
                previous_type = entry.get('type')
                if entry.get('type') == 'text' and pending and pending[-1].get('type') == 'text':
                    pending[-1] = {**pending[-1], 'delta': pending[-1].get('delta', '') + entry.get('delta', '')}
                else:
                    pending.append(entry)
                terminal = entry.get('type') in {'done', 'error'}
                if terminal or entry.get('type') != 'text' or time.monotonic() - last_flush >= 1:
                    status = ('failed' if entry['type'] == 'error' else 'done') if terminal else 'running'
                    _write_events(table, job_id, token, [*published, *pending], status)
                    published.extend(pending)
                    pending = []
                    last_flush = time.monotonic()
                    if terminal:
                        return {'jobId': job_id, 'status': status}
        raise RuntimeError('incomplete_response')
    except table.meta.client.exceptions.ConditionalCheckFailedException:
        # A polling request already marked the timed-out job failed.
        return {'jobId': job_id, 'status': 'superseded'}
    except (BotoCoreError, ClientError):
        # Propagate storage failure to Lambda; polling exposes the deadline rather
        # than claiming a completed response when persistence failed.
        raise
    except Exception as failure:
        code = 'result_too_large' if isinstance(failure, ValueError) and str(failure) == 'result_too_large' else 'job_failed'
        message = 'La réponse dépasse la capacité de ce dossier. Fermez certains documents et réessayez.' if code == 'result_too_large' else _FAILED
        terminal = _error(code, message)
        try:
            _write_events(table, job_id, token, [*published, terminal], 'failed')
        except table.meta.client.exceptions.ConditionalCheckFailedException:
            return {'jobId': job_id, 'status': 'superseded'}
        return {'jobId': job_id, 'status': 'failed'}


def _retry_stalled_delivery(job_id):
    """Keep an expired worker message unacknowledged so SQS can redrive it."""
    table, _, _ = _storage()
    now = int(time.time())
    item = table.get_item(Key={'job_id': job_id}, ConsistentRead=True).get('Item')
    if not item:
        return True
    if item.get('status') == 'failed':
        events = json.loads(item.get('eventsJson', '[]'))
        error = next((entry for entry in reversed(events) if entry.get('type') == 'error'), {})
        return error.get('code') in {'job_timeout', 'worker_interrupted'}
    if item.get('status') not in {'queued', 'running'}:
        return False

    lease_expired = item.get('status') == 'running' and int(item.get('workerLeaseUntil', 0)) <= now
    deadline_expired = int(item.get('deadlineAt', 0)) <= now
    if not (lease_expired or deadline_expired):
        return True

    events = json.loads(item.get('eventsJson', '[]'))
    code = 'worker_interrupted' if lease_expired else 'job_timeout'
    message = 'Le traitement a été interrompu. Les éléments déjà reçus sont conservés.' if lease_expired else _EXPIRED
    events.append(_error(code, message))
    try:
        table.update_item(
            Key={'job_id': job_id},
            UpdateExpression='SET #status = :failed, eventsJson = :events, updatedAt = :now, eventCount = :count',
            ConditionExpression=Attr('status').is_in(['queued', 'running']) & Attr('eventCount').eq(item['eventCount']),
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={':failed': 'failed', ':events': _json(events), ':now': now,
                                       ':count': len(events)},
        )
    except table.meta.client.exceptions.ConditionalCheckFailedException:
        return True
    return True


def handle_sqs_event(event):
    """Run SQS records and return partial failures for retry/DLQ redrive."""
    failures = []
    for record in event.get('Records', []):
        message_id = record.get('messageId')
        try:
            if record.get('eventSource') != 'aws:sqs' or not message_id:
                raise ValueError('Invalid SQS record')
            payload = json.loads(record.get('body', ''))
            if not isinstance(payload, dict) or payload.get('source') != WORKER_SOURCE:
                raise ValueError('Unknown SQS message')
            result = execute_job(payload)
            if result.get('status') == 'ignored' and _retry_stalled_delivery(str(UUID(payload['jobId']))):
                failures.append({'itemIdentifier': message_id})
        except Exception:
            # The message remains in SQS and is retried. After maxReceiveCount,
            # SQS moves it to the configured dead-letter queue.
            if message_id:
                failures.append({'itemIdentifier': message_id})
    return {'batchItemFailures': failures}
