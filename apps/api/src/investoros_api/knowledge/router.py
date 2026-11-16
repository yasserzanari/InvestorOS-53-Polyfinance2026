import os

from fastapi import APIRouter, Depends, Header, HTTPException

from investoros_api.knowledge.models import KnowledgeSearchRequest, KnowledgeUploadRequest
from investoros_api.knowledge.service import (
    create_document_upload,
    get_sync,
    require_admin_token,
    retrieve_evidence,
    start_sync,
)

router = APIRouter(prefix="/v1/knowledge", tags=["knowledge"])


def require_knowledge_admin(
    x_knowledge_admin_token: str | None = Header(default=None),
    x_investoros_admin_authorized: str | None = Header(default=None, alias="x-investoros-admin-authorized"),
) -> None:
    if os.getenv("REQUIRE_ADMIN_AUTH", "false").lower() == "true":
        if x_investoros_admin_authorized == "true":
            return
        raise HTTPException(status_code=403, detail="Administrator access required")
    require_admin_token(x_knowledge_admin_token)


@router.post("/retrieve")
def retrieve(request: KnowledgeSearchRequest):
    return retrieve_evidence(request)


@router.post("/documents/upload-url")
def upload_url(request: KnowledgeUploadRequest, _: None = Depends(require_knowledge_admin)):
    return create_document_upload(request)


@router.post("/sync")
def sync(_: None = Depends(require_knowledge_admin)):
    response = start_sync()
    job = response.get("ingestionJob", {})
    return {
        "knowledge_base_id": job.get("knowledgeBaseId"),
        "data_source_id": job.get("dataSourceId"),
        "ingestion_job_id": job.get("ingestionJobId"),
        "status": job.get("status"),
    }


@router.get("/sync/{ingestion_job_id}")
def sync_status(ingestion_job_id: str, _: None = Depends(require_knowledge_admin)):
    return get_sync(ingestion_job_id)
