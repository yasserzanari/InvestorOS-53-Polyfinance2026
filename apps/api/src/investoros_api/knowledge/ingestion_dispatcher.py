"""Dispatch S3 document uploads to a durable Bedrock ingestion workflow."""

import hashlib
import json
import os
from urllib.parse import unquote_plus

import boto3
from botocore.exceptions import ClientError


def _clients():
    region = os.getenv("AWS_REGION", "us-east-1")
    return boto3.client("s3", region_name=region), boto3.client("stepfunctions", region_name=region)


def _decode_record(record: dict) -> tuple[str, str, str]:
    bucket = record["s3"]["bucket"]["name"]
    obj = record["s3"]["object"]
    key = unquote_plus(obj["key"])
    # S3's sequencer is a hex string whose length can vary. Hashing the exact
    # event identity gives Step Functions a legal, deterministic execution name.
    event_id = f"{bucket}\0{key}\0{obj.get('versionId', '')}\0{obj.get('sequencer', '')}"
    return bucket, key, hashlib.sha256(event_id.encode("utf-8")).hexdigest()


def _dispatch(record: dict, s3, stepfunctions) -> str:
    bucket, key, event_id = _decode_record(record)
    if not key.startswith("documents/"):
        raise ValueError("S3 event is outside the configured Knowledge Base prefix")
    # Bedrock consumes the metadata sidecar along with the source object. Its
    # own PUT event is intentionally acknowledged without starting another sync.
    if key.endswith(".metadata.json"):
        return "metadata_sidecar_ignored"

    sidecar_key = f"{key}.metadata.json"
    try:
        s3.head_object(Bucket=bucket, Key=sidecar_key)
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
            # Keep the document event in SQS until its metadata PUT completes;
            # after the configured receive limit SQS moves it to the DLQ.
            raise RuntimeError("Document metadata sidecar has not arrived yet") from error
        raise

    state_machine_arn = os.environ["KNOWLEDGE_INGESTION_STATE_MACHINE_ARN"]
    execution_name = f"upload-{event_id}"
    payload = json.dumps({
        "knowledgeBaseId": os.environ["KNOWLEDGE_BASE_ID"],
        "dataSourceId": os.environ["KNOWLEDGE_DATA_SOURCE_ID"],
        "clientToken": event_id[:64],
        "bucket": bucket,
        "key": key,
        "eventId": event_id,
    }, separators=(",", ":"))
    try:
        stepfunctions.start_execution(
            stateMachineArn=state_machine_arn,
            name=execution_name,
            input=payload,
        )
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") == "ExecutionAlreadyExists":
            return "already_dispatched"
        raise
    return "dispatched"


def handler(event: dict, _context) -> dict:
    """SQS Lambda handler with per-message failure reporting and idempotent dispatch."""
    s3, stepfunctions = _clients()
    failures = []
    for record in event.get("Records", []):
        message_id = record.get("messageId")
        try:
            body = json.loads(record.get("body", "{}"))
            for s3_record in body.get("Records", []):
                # Ignore S3 test events and non-create notifications.
                if s3_record.get("eventSource") != "aws:s3" or not s3_record.get("eventName", "").startswith("ObjectCreated:"):
                    continue
                _dispatch(s3_record, s3, stepfunctions)
        except Exception:
            if message_id:
                failures.append({"itemIdentifier": message_id})
    return {"batchItemFailures": failures}
