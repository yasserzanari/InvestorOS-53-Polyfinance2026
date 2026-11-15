"""HTTP endpoints for durable research runs and an authenticated source-policy registry."""

import hashlib
import hmac
import json
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Header, HTTPException, Query, Request

from investoros_api.demo_contexts import PersonaId, context_for
from investoros_api.research.models import ResearchRequest, SourcePolicyUpdate
from investoros_api.research.runtime import emit
from investoros_api.research.social import canonical_post_url
from investoros_api.research.sources import DEFAULT_SOURCES, public_source
from investoros_api.research.validation import validate_disclosure_dates

router = APIRouter(prefix="/v1/research", tags=["research"])
_ddb = None
_sfn = None


def _resource():
    global _ddb
    if _ddb is None:
        _ddb = boto3.resource("dynamodb", region_name=os.getenv("AWS_REGION", "us-east-1"))
    return _ddb


def _step_functions():
    global _sfn
    if _sfn is None:
        _sfn = boto3.client("stepfunctions", region_name=os.getenv("AWS_REGION", "us-east-1"))
    return _sfn


def _research_admin_token() -> str:
    direct = os.getenv("RESEARCH_ADMIN_TOKEN", "")
    if direct:
        return direct
    secret_arn = os.getenv("RESEARCH_ADMIN_TOKEN_SECRET_ARN", "")
    if not secret_arn:
        return ""
    secret = boto3.client("secretsmanager", region_name=os.getenv("AWS_REGION", "us-east-1")).get_secret_value(
        SecretId=secret_arn
    )
    return secret.get("SecretString", "")


def _table(variable: str):
    name = os.getenv(variable, "")
    if not name:
        raise HTTPException(503, f"Configuration manquante: {variable}")
    return _resource().Table(name)


def _decode_item(item: dict[str, Any] | None):
    if not item:
        return None
    payload = item.get("payload")
    if isinstance(payload, str):
        try:
            return json.loads(payload)
        except json.JSONDecodeError as error:
            raise HTTPException(502, "Contexte démo invalide") from error
    return None


def _load_persona(persona: PersonaId):
    context = context_for(persona)
    client = boto3.client("dynamodb", region_name=os.getenv("AWS_REGION", "us-east-1"))
    names = {
        "ACCOUNTS_TABLE_NAME": ("account_id", context["account_id"], None, None),
        "PROFILES_TABLE_NAME": ("account_id", context["account_id"], "profile_id", context["profile_id"]),
        "PORTFOLIOS_TABLE_NAME": ("account_id", context["account_id"], "portfolio_id", context["portfolio_id"]),
    }
    result = {}
    for env_key, (hash_key, hash_value, range_key, range_value) in names.items():
        table_name = os.getenv(env_key, "")
        if not table_name:
            raise HTTPException(503, "Le contexte de démonstration AWS n'est pas configuré")
        key = {hash_key: {"S": hash_value}}
        if range_key:
            key[range_key] = {"S": range_value}
        item = client.get_item(TableName=table_name, Key=key, ConsistentRead=True).get("Item")
        payload = _decode_item({name: next(iter(value.values())) for name, value in item.items()} if item else None)
        if payload is None:
            raise HTTPException(404, "Le contexte de ce persona est introuvable")
        result[env_key] = payload
    return context, result["PROFILES_TABLE_NAME"], result["PORTFOLIOS_TABLE_NAME"]


def _run_for_persona(analysis_id: str, persona: PersonaId):
    context = context_for(persona)
    item = _table("RESEARCH_RUNS_TABLE_NAME").get_item(
        Key={"account_id": context["account_id"], "analysis_id": analysis_id}, ConsistentRead=True
    ).get("Item")
    if not item:
        raise HTTPException(404, "Analyse introuvable")
    return context, item


@router.get("/analyses")
def list_analyses(persona: PersonaId = Query(default="mateo"), limit: int = Query(default=30, ge=1, le=60)):
    """List only the configured fictional account's research runs."""
    context = context_for(persona)
    response = _table("RESEARCH_RUNS_TABLE_NAME").query(
        KeyConditionExpression=Key("account_id").eq(context["account_id"]),
        IndexName="created_at-index",
        ScanIndexForward=False,
        Limit=limit,
    )
    return {"analyses": [{key: item.get(key) for key in (
        "analysis_id", "persona", "question", "status", "created_at", "started_at", "completed_at", "error"
    )} for item in response.get("Items", [])]}


def _source_policies():
    table_name = os.getenv("RESEARCH_SOURCES_TABLE_NAME", "")
    persisted = {}
    if table_name:
        for item in _resource().Table(table_name).scan(ProjectionExpression="source_id, policy, first_browser_completed").get("Items", []):
            source_id = item.get("source_id")
            if source_id:
                persisted[source_id] = item
    sources = []
    for source_id, definition in DEFAULT_SOURCES.items():
        source = dict(definition)
        item = persisted.get(source_id, {})
        if item.get("policy"):
            try:
                policy = json.loads(item["policy"])
                source.update({key: policy[key] for key in ("enabled", "trust_level", "rationale") if key in policy})
            except (json.JSONDecodeError, TypeError):
                pass
        source["first_browser_completed"] = bool(item.get("first_browser_completed", False))
        sources.append(public_source(source))
    return sources


@router.get("/sources")
def list_sources():
    return {"sources": _source_policies(), "editable": bool(
        os.getenv("RESEARCH_ADMIN_TOKEN") or os.getenv("RESEARCH_ADMIN_TOKEN_SECRET_ARN")
    )}


@router.patch("/sources/{source_id}")
def update_source_policy(source_id: str, request: SourcePolicyUpdate, x_admin_token: str | None = Header(default=None)):
    try:
        expected = _research_admin_token()
    except (BotoCoreError, ClientError) as error:
        raise HTTPException(503, "Le secret administrateur des sources est indisponible") from error
    if not expected:
        raise HTTPException(503, "L'édition des politiques sources est désactivée tant que l'authentification admin n'est pas configurée")
    if not x_admin_token or not hmac.compare_digest(expected, x_admin_token):
        raise HTTPException(403, "Autorisation requise")
    if source_id not in DEFAULT_SOURCES:
        raise HTTPException(404, "Source inconnue; ajoutez d'abord son contrat dans le registre autorisé")
    if source_id == "x-post" and request.enabled:
        raise HTTPException(422, "Les liens X restent des propos attribués; la collecte automatisée est interdite")
    if request.enabled and not DEFAULT_SOURCES[source_id].get("automation_allowed", True):
        raise HTTPException(422, "La collecte automatique de cette source n'est pas autorisée par son contrat")
    if request.trust_level == "blocked" and request.enabled:
        raise HTTPException(422, "Une source bloquée doit rester désactivée")
    policy = request.model_dump()
    policy["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        _table("RESEARCH_SOURCES_TABLE_NAME").update_item(
            Key={"source_id": source_id},
            UpdateExpression="SET policy = :policy, first_browser_completed = if_not_exists(first_browser_completed, :false)",
            ExpressionAttributeValues={":policy": json.dumps(policy, ensure_ascii=False), ":false": False})
    except (BotoCoreError, ClientError) as error:
        raise HTTPException(503, "Impossible d'enregistrer la politique de source") from error
    return {"source": next(source for source in _source_policies() if source["id"] == source_id)}


def _consume_daily_quota(request: Request, persona: PersonaId):
    event = request.scope.get("aws.event", {})
    request_context = event.get("requestContext", {}) if isinstance(event, dict) else {}
    claims = request_context.get("authorizer", {}).get("jwt", {}).get("claims", {}) if isinstance(request_context, dict) else {}
    subject = claims.get("sub") if isinstance(claims, dict) else None
    trusted_hash = request_context.get("trustedPrincipalHash") if isinstance(request_context, dict) else None
    if isinstance(subject, str) and subject.strip():
        principal = f"user:{hashlib.sha256(subject.encode('utf-8')).hexdigest()}"
        principal_label = "compte"
    elif isinstance(trusted_hash, str) and re.fullmatch(r"[0-9a-f]{64}", trusted_hash):
        principal = f"user:{trusted_hash}"
        principal_label = "compte"
    else:
        client_host = request.client.host if request.client else "unknown"
        host_hash = hashlib.sha256(client_host.encode("utf-8")).hexdigest()
        principal = f"ip:{host_hash}"
        principal_label = "adresse réseau"
    now = datetime.now(timezone.utc)
    principal_hash = hashlib.sha256(f"{principal}:{persona}".encode("utf-8")).hexdigest()
    quota_key = f"{now.date().isoformat()}:{principal_hash}"
    limit = int(os.getenv("RESEARCH_DAILY_IP_LIMIT", "12"))
    expires_at = int((now + timedelta(days=2)).timestamp())
    try:
        _table("RESEARCH_QUOTAS_TABLE_NAME").update_item(
            Key={"quota_key": quota_key},
            UpdateExpression="SET expires_at = if_not_exists(expires_at, :expires) ADD request_count :one",
            ConditionExpression="attribute_not_exists(request_count) OR request_count < :limit",
            ExpressionAttributeValues={":expires": expires_at, ":one": 1, ":limit": limit},
        )
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            detail = f"Limite quotidienne de recherches atteinte pour ce {principal_label} démo."
            raise HTTPException(429, detail) from error
        raise HTTPException(503, "Impossible de vérifier la limite quotidienne de recherches.") from error
    except BotoCoreError as error:
        raise HTTPException(503, "Impossible de vérifier la limite quotidienne de recherches.") from error


@router.post("/analyses", status_code=202)
def create_analysis(request_data: ResearchRequest, request: Request):
    state_machine_arn = os.getenv("RESEARCH_STATE_MACHINE_ARN", "")
    if not state_machine_arn:
        raise HTTPException(503, "L'orchestration Step Functions n'est pas déployée")
    context, profile, portfolio = _load_persona(request_data.persona)
    if request_data.source_ids is not None:
        if any(source_id not in DEFAULT_SOURCES or source_id == 'x-post' for source_id in request_data.source_ids):
            raise HTTPException(422, 'Le périmètre contient une source inconnue ou non collectable.')
        request_data.source_ids = list(dict.fromkeys(request_data.source_ids))
    if request_data.x_url:
        try:
            request_data.x_url = canonical_post_url(request_data.x_url)
        except ValueError as error:
            raise HTTPException(422, "Ajoutez un lien HTTPS vers un post public X précis avec son compte et son identifiant") from error
    _consume_daily_quota(request, request_data.persona)
    analysis_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    run = {"account_id": context["account_id"], "analysis_id": analysis_id, "persona": request_data.persona,
           "question": request_data.question, "status": "queued", "created_at": now, "execution_arn": "",
           "x_url": request_data.x_url or "", "x_text": request_data.x_text or "",
           "source_ids": request_data.source_ids}
    _table("RESEARCH_RUNS_TABLE_NAME").put_item(Item=run, ConditionExpression="attribute_not_exists(analysis_id)")
    x_evidence_id = None
    if request_data.x_url or request_data.x_text:
        x_evidence_id = str(uuid.uuid4())
        x_source = DEFAULT_SOURCES["x-post"]
        _table("RESEARCH_EVIDENCE_TABLE_NAME").put_item(Item={
            "analysis_id": analysis_id,
            "evidence_id": x_evidence_id,
            "source_id": "x-post",
            "source_name": x_source["name"],
            "trust_level": "discovery",
            "independence_group": "user_supplied_statement",
            "url": request_data.x_url or x_source["url"],
            "collected_at": now,
            "method": "user_supplied_attribution",
            "claim_scope": ["attributed_statement"],
            "question": request_data.question,
            "content": json.dumps({"statement": request_data.x_text or "", "retrieved": False}, ensure_ascii=False),
            "limits": x_source["notes"],
        })
    emit(analysis_id, "analysis_created", "Nouvelle analyse", "La recherche est dans la file Step Functions.", status="queued",
         data={"x_url": request_data.x_url, "x_treatment": "attributed_only" if request_data.x_url or request_data.x_text else None})
    if request_data.x_url or request_data.x_text:
        emit(analysis_id, "user_reference_added", "Référence X ajoutée", "Le post public sera consulté via l'interface officielle oEmbed si la source est autorisée. Le texte fourni reste distinct du contenu récupéré.", source_id="x-post", status="info", data={"url": request_data.x_url, "text_supplied": bool(request_data.x_text)})
    execution_input = {"analysis_id": analysis_id, "account_id": context["account_id"], "persona": request_data.persona,
                       "question": request_data.question, "profile": profile, "portfolio": portfolio,
                       "source_ids": request_data.source_ids,
                       "x_url": request_data.x_url, "x_text": request_data.x_text, "x_evidence_id": x_evidence_id}
    try:
        started = _step_functions().start_execution(name=analysis_id.replace("-", ""),
                                                    stateMachineArn=state_machine_arn,
                                                    input=json.dumps(execution_input, ensure_ascii=False))
    except (BotoCoreError, ClientError) as error:
        _table("RESEARCH_RUNS_TABLE_NAME").update_item(
            Key={"account_id": context["account_id"], "analysis_id": analysis_id},
            UpdateExpression="SET #status = :status, error = :error",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={":status": "failed", ":error": "Step Functions n'a pas pu démarrer l'exécution."})
        raise HTTPException(503, "Step Functions n'a pas pu démarrer l'analyse") from error
    _table("RESEARCH_RUNS_TABLE_NAME").update_item(
        Key={"account_id": context["account_id"], "analysis_id": analysis_id},
        UpdateExpression="SET execution_arn = :arn", ExpressionAttributeValues={":arn": started["executionArn"]})
    return {"analysis_id": analysis_id, "status": "queued", "persona": request_data.persona,
            "created_at": now, "events_url": f"/v1/research/analyses/{analysis_id}/events"}


@router.get("/analyses/{analysis_id}")
def get_analysis(analysis_id: str, persona: PersonaId = Query(default="mateo")):
    _, item = _run_for_persona(analysis_id, persona)
    result = item.get("result")
    parsed = json.loads(result) if isinstance(result, str) else None
    if parsed:
        proofs = _table('RESEARCH_EVIDENCE_TABLE_NAME').query(KeyConditionExpression=Key('analysis_id').eq(analysis_id), Limit=80).get('Items', [])
        parsed = validate_disclosure_dates(parsed, proofs)
    return {"analysis_id": analysis_id, "persona": item.get("persona"), "question": item.get("question"),
            "status": item.get("status"), "created_at": item.get("created_at"), "completed_at": item.get("completed_at"),
            "x_url": item.get("x_url") or None, "x_text": item.get("x_text") or None,
            "result": parsed, "error": item.get("error")}


@router.get("/analyses/{analysis_id}/events")
def get_analysis_events(analysis_id: str, persona: PersonaId = Query(default="mateo"), after: str = Query(default="", max_length=80), limit: int = Query(default=80, ge=1, le=150)):
    _run_for_persona(analysis_id, persona)
    key_condition = Key("analysis_id").eq(analysis_id)
    if after:
        key_condition = key_condition & Key("event_id").gt(after)
    response = _table("RESEARCH_EVENTS_TABLE_NAME").query(
        KeyConditionExpression=key_condition, ScanIndexForward=True, Limit=limit)
    return {"events": [{key: item.get(key) for key in ("analysis_id", "event_id", "type", "at", "room_id", "agent_id", "source_id", "title", "detail", "status", "data")} for item in response.get("Items", [])],
            "next_after": response.get("LastEvaluatedKey", {}).get("event_id")}


@router.get("/analyses/{analysis_id}/evidence")
def get_analysis_evidence(analysis_id: str, persona: PersonaId = Query(default="mateo")):
    _run_for_persona(analysis_id, persona)
    response = _table("RESEARCH_EVIDENCE_TABLE_NAME").query(
        KeyConditionExpression=Key("analysis_id").eq(analysis_id), ScanIndexForward=True, Limit=80)
    return {"evidence": response.get("Items", [])}


@router.post("/analyses/{analysis_id}/cancel", status_code=202)
def cancel_analysis(analysis_id: str, persona: PersonaId = Query(default="mateo")):
    context, item = _run_for_persona(analysis_id, persona)
    if item.get("status") in {"complete", "partial", "failed", "cancelled"}:
        return {"analysis_id": analysis_id, "status": item.get("status")}
    execution_arn = item.get("execution_arn")
    if not execution_arn:
        raise HTTPException(409, "Exécution Step Functions non disponible")
    try:
        _step_functions().stop_execution(executionArn=execution_arn, error="UserCancelled", cause="Cancelled from InvestorOS")
    except (BotoCoreError, ClientError) as error:
        raise HTTPException(503, "Impossible d'annuler l'exécution") from error
    _table("RESEARCH_RUNS_TABLE_NAME").update_item(
        Key={"account_id": context["account_id"], "analysis_id": analysis_id},
        UpdateExpression="SET #status = :status, completed_at = :now",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={":status": "cancelled", ":now": datetime.now(timezone.utc).isoformat()})
    emit(analysis_id, "analysis_cancelled", "Analyse annulée", "Arrêt demandé par l'utilisateur.", status="cancelled")
    return {"analysis_id": analysis_id, "status": "cancelled"}
