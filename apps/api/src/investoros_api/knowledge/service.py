"""AWS Bedrock Knowledge Bases retrieval and S3 document ingestion."""

import hashlib
import hmac
import json
import os
from datetime import date
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException

from investoros_api.demo_contexts import PersonaId, context_for
from investoros_api.knowledge.models import KnowledgeSearchRequest, KnowledgeUploadRequest

_runtime_client = None
_control_client = None
_s3_client = None
_secrets_client = None
_ssm_client = None
_parameter_cache: dict[str, str] = {}


def _client(kind: str):
    global _runtime_client, _control_client, _s3_client, _secrets_client, _ssm_client
    region = os.getenv("AWS_REGION", "us-east-1")
    if kind == "runtime":
        if _runtime_client is None:
            _runtime_client = boto3.client("bedrock-agent-runtime", region_name=region)
        return _runtime_client
    if kind == "control":
        if _control_client is None:
            _control_client = boto3.client("bedrock-agent", region_name=region)
        return _control_client
    if kind == "s3":
        if _s3_client is None:
            _s3_client = boto3.client("s3", region_name=region)
        return _s3_client
    if kind == "ssm":
        if _ssm_client is None:
            _ssm_client = boto3.client("ssm", region_name=region)
        return _ssm_client
    if _secrets_client is None:
        _secrets_client = boto3.client("secretsmanager", region_name=region)
    return _secrets_client


def _parameter_value(name: str, env_name: str) -> str:
    """Resolve live AWS configuration from SSM, with explicit local env overrides."""
    override = os.getenv(env_name, "").strip()
    if override:
        return override
    if name in _parameter_cache:
        return _parameter_cache[name]
    environment = os.getenv("ENVIRONMENT", "dev")
    parameter_name = f"/investoros-{environment}/knowledge/{name}"
    try:
        value = _client("ssm").get_parameter(Name=parameter_name)["Parameter"]["Value"].strip()
    except (BotoCoreError, ClientError) as error:
        raise HTTPException(status_code=503, detail=f"AWS knowledge service is not configured ({name})") from error
    if not value:
        raise HTTPException(status_code=503, detail=f"AWS knowledge service is not configured ({name})")
    _parameter_cache[name] = value
    return value


def _metadata_filter(request: KnowledgeSearchRequest, account_id: str) -> dict[str, Any]:
    clauses: list[dict[str, Any]] = [
        {"equals": {"key": "use_case", "value": request.use_case}},
        {
            "orAll": [
                {"equals": {"key": "account_id", "value": account_id}},
                {"equals": {"key": "account_id", "value": "shared"}},
            ]
        },
    ]
    if request.entity_id:
        clauses.append({"equals": {"key": "entity_id", "value": request.entity_id}})
    if request.document_type:
        clauses.append({"equals": {"key": "document_type", "value": request.document_type}})
    if request.published_after:
        try:
            parsed = date.fromisoformat(request.published_after)
        except ValueError as error:
            raise HTTPException(status_code=422, detail="published_after must use YYYY-MM-DD") from error
        clauses.append(
            {
                "greaterThanOrEquals": {
                    "key": "published_at",
                    "value": f"{parsed.isoformat()}T00:00:00Z",
                }
            }
        )
    return {"andAll": clauses}


def _normalize_result(result: dict[str, Any]) -> dict[str, Any] | None:
    content = result.get("content", {})
    text = content.get("text") if isinstance(content, dict) else None
    if not isinstance(text, str) or not text.strip():
        return None
    location = result.get("location", {})
    s3 = location.get("s3Location", {}) if isinstance(location, dict) else {}
    uri = s3.get("uri") if isinstance(s3, dict) else None
    metadata = result.get("metadata", {})
    if not isinstance(metadata, dict):
        metadata = {}
    citation_id = hashlib.sha256(f"{uri or ''}\0{text}".encode("utf-8")).hexdigest()[:20]
    return {
        "id": citation_id,
        "text": text,
        "score": result.get("score"),
        "source_uri": uri,
        "metadata": metadata,
        "citation": {
            "id": citation_id,
            "title": metadata.get("title") or metadata.get("document_title"),
            "source_id": metadata.get("source_id"),
            "source_trust": metadata.get("source_trust", "unknown"),
            "source_url": metadata.get("source_url") or uri,
            "published_at": metadata.get("published_at"),
            "document_type": metadata.get("document_type"),
            "entity_id": metadata.get("entity_id"),
        },
    }


def retrieve_evidence(request: KnowledgeSearchRequest) -> dict[str, Any]:
    """Retrieve cited passages; this does not generate or invent an answer."""
    kb_id = _parameter_value("knowledge-base-id", "KNOWLEDGE_BASE_ID")
    account_id = context_for(request.persona)["account_id"]
    try:
        response = _client("runtime").retrieve(
            knowledgeBaseId=kb_id,
            retrievalQuery={"text": request.query},
            retrievalConfiguration={
                "managedSearchConfiguration": {
                    "numberOfResults": request.limit,
                    "filter": _metadata_filter(request, account_id),
                }
            },
            userContext={"userId": account_id},
        )
    except (BotoCoreError, ClientError) as error:
        raise HTTPException(status_code=502, detail="Amazon Bedrock document retrieval failed") from error
    items = [
        normalized
        for result in response.get("retrievalResults", [])
        if (normalized := _normalize_result(result)) is not None
    ]
    return {
        "provider": "amazon-bedrock-knowledge-bases",
        "knowledge_base_id": kb_id,
        "account_scope": account_id,
        "use_case": request.use_case,
        "query": request.query,
        "result_count": len(items),
        "evidence": items,
        "status": "retrieved" if items else "no_evidence",
    }


def create_document_upload(request: KnowledgeUploadRequest) -> dict[str, Any]:
    """Create short-lived S3 PUTs for a document and its Bedrock metadata sidecar."""
    if request.license_status != "permitted":
        raise HTTPException(
            status_code=422,
            detail="Only documents marked as permitted can be added to the searchable library",
        )
    bucket = _parameter_value("documents-bucket", "KNOWLEDGE_DOCUMENTS_BUCKET")
    account_id = context_for(request.persona)["account_id"]
    entity = request.entity_id or "unassigned"
    key = f"documents/{account_id}/{request.use_case}/{entity}/{hashlib.sha256(os.urandom(32)).hexdigest()}/{request.filename}"
    metadata_key = f"{key}.metadata.json"
    metadata_attributes: dict[str, Any] = {
        "account_id": account_id,
        "use_case": request.use_case,
        "entity_id": request.entity_id or "unassigned",
        "document_type": request.document_type,
        "title": request.title,
        "source_id": request.source_id,
        "source_trust": request.source_trust,
        "source_url": request.source_url,
        "license_status": request.license_status,
    }
    if request.published_at:
        try:
            parsed = date.fromisoformat(request.published_at)
        except ValueError as error:
            raise HTTPException(status_code=422, detail="published_at must use YYYY-MM-DD") from error
        metadata_attributes["published_at"] = f"{parsed.isoformat()}T00:00:00Z"
    sidecar = {
        "metadataAttributes": {
            name: {"value": {"type": "STRING", "stringValue": value}}
            for name, value in metadata_attributes.items()
        }
    }
    mime = _content_type(request.filename)
    s3 = _client("s3")
    try:
        document_url = s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": bucket, "Key": key, "ContentType": mime},
            ExpiresIn=300,
        )
        sidecar_url = s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": bucket, "Key": metadata_key, "ContentType": "application/json"},
            ExpiresIn=300,
        )
    except (BotoCoreError, ClientError) as error:
        raise HTTPException(status_code=502, detail="Could not prepare the private S3 upload") from error
    return {
        "bucket": bucket,
        "document_key": key,
        "metadata_key": metadata_key,
        "document_upload_url": document_url,
        "metadata_upload_url": sidecar_url,
        "document_content_type": mime,
        "metadata_content_type": "application/json",
        "metadata_sidecar": json.dumps(sidecar, ensure_ascii=False),
        "expires_in_seconds": 300,
        "next_step": "Start a knowledge-base sync after both uploads succeed.",
    }


def start_sync() -> dict[str, Any]:
    kb_id = _parameter_value("knowledge-base-id", "KNOWLEDGE_BASE_ID")
    data_source_id = _parameter_value("data-source-id", "KNOWLEDGE_DATA_SOURCE_ID")
    try:
        return _client("control").start_ingestion_job(
            knowledgeBaseId=kb_id,
            dataSourceId=data_source_id,
            description="InvestorOS document-library refresh",
        )
    except (BotoCoreError, ClientError) as error:
        raise HTTPException(status_code=502, detail="Amazon Bedrock document sync could not start") from error


def get_sync(ingestion_job_id: str) -> dict[str, Any]:
    kb_id = _parameter_value("knowledge-base-id", "KNOWLEDGE_BASE_ID")
    data_source_id = _parameter_value("data-source-id", "KNOWLEDGE_DATA_SOURCE_ID")
    try:
        response = _client("control").get_ingestion_job(
            knowledgeBaseId=kb_id,
            dataSourceId=data_source_id,
            ingestionJobId=ingestion_job_id,
        )
    except (BotoCoreError, ClientError) as error:
        raise HTTPException(status_code=502, detail="Amazon Bedrock document sync status is unavailable") from error
    job = response.get("ingestionJob", {})
    return {
        "knowledge_base_id": kb_id,
        "data_source_id": data_source_id,
        "ingestion_job_id": job.get("ingestionJobId"),
        "status": job.get("status"),
        "started_at": job.get("startedAt"),
        "updated_at": job.get("updatedAt"),
        "statistics": job.get("statistics", {}),
        "failure_reasons": job.get("failureReasons", []),
    }


def require_admin_token(provided: str | None) -> None:
    expected = os.getenv("RESEARCH_ADMIN_TOKEN_SECRET_ARN", "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="Knowledge administrator access is not configured")
    if not provided:
        raise HTTPException(status_code=401, detail="Administrator token required")
    try:
        value = _client("secrets").get_secret_value(SecretId=expected).get("SecretString", "")
    except (BotoCoreError, ClientError) as error:
        raise HTTPException(status_code=503, detail="Knowledge administrator access is unavailable") from error
    if not value or not hmac.compare_digest(value, provided):
        raise HTTPException(status_code=403, detail="Invalid administrator token")


def _content_type(filename: str) -> str:
    extension = filename.rsplit(".", 1)[-1].lower()
    return {
        "pdf": "application/pdf",
        "txt": "text/plain; charset=utf-8",
        "md": "text/markdown; charset=utf-8",
        "html": "text/html; charset=utf-8",
        "htm": "text/html; charset=utf-8",
        "csv": "text/csv; charset=utf-8",
        "doc": "application/msword",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls": "application/vnd.ms-excel",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }[extension]
