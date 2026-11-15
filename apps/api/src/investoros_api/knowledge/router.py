from fastapi import APIRouter, Header

from investoros_api.knowledge.models import KnowledgeSearchRequest, KnowledgeUploadRequest
from investoros_api.knowledge.service import (
    create_document_upload,
    get_sync,
    require_admin_token,
    retrieve_evidence,
    start_sync,
)

router = APIRouter(prefix="/v1/knowledge", tags=["knowledge"])


@router.post("/retrieve")
def retrieve(request: KnowledgeSearchRequest):
    return retrieve_evidence(request)


@router.post("/documents/upload-url")
def upload_url(request: KnowledgeUploadRequest, x_knowledge_admin_token: str | None = Header(default=None)):
    require_admin_token(x_knowledge_admin_token)
    return create_document_upload(request)


@router.post("/sync")
def sync(x_knowledge_admin_token: str | None = Header(default=None)):
    require_admin_token(x_knowledge_admin_token)
    response = start_sync()
    job = response.get("ingestionJob", {})
    return {
        "knowledge_base_id": job.get("knowledgeBaseId"),
        "data_source_id": job.get("dataSourceId"),
        "ingestion_job_id": job.get("ingestionJobId"),
        "status": job.get("status"),
    }


@router.get("/sync/{ingestion_job_id}")
def sync_status(ingestion_job_id: str, x_knowledge_admin_token: str | None = Header(default=None)):
    require_admin_token(x_knowledge_admin_token)
    return get_sync(ingestion_job_id)
