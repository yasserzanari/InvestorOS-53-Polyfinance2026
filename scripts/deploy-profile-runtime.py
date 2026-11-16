"""Publish only existing profile API/worker code; preserve config and support rollback.

For the GitHub OIDC deployment role. Uses the same content-addressed private artifact
bucket as Terraform. A later successful Terraform apply reconciles its code hashes.
"""

import base64
import hashlib
import json
import os
from pathlib import Path
import tempfile
import urllib.request
import boto3

region = os.environ.get("AWS_REGION", "us-east-1")
expected = os.environ["EXPECTED_AWS_ACCOUNT_ID"]
session = boto3.Session(region_name=region)
if session.client("sts").get_caller_identity()["Account"] != expected:
    raise SystemExit("Deployment account does not match the expected environment.")
lambda_client = session.client("lambda")
s3 = session.client("s3")
functions = [
    "investoros-dev-assistant-simulation",
    "investoros-dev-profile-chat-worker",
]
bucket = f"investoros-dev-{expected}-lambda-artifacts-{region}"
package = Path("apps/api/build/investoros-api.zip")
code = package.read_bytes()
digest = hashlib.sha256(code).digest()
key = f"assistant-simulation/api-{digest.hex()}.zip"
expected_hash = base64.b64encode(digest).decode()
changed = []
backups = {}
with tempfile.TemporaryDirectory(prefix="profile-runtime-") as directory:
    # Capture both baselines before writing anything; do not print signed URLs or environments.
    for index, function in enumerate(functions):
        previous = lambda_client.get_function(FunctionName=function)
        backup = Path(directory) / f"{index}.zip"
        with urllib.request.urlopen(
            previous["Code"]["Location"], timeout=90
        ) as response:
            backup.write_bytes(response.read())
        previous_digest = hashlib.sha256(backup.read_bytes()).digest()
        if (
            base64.b64encode(previous_digest).decode()
            != previous["Configuration"]["CodeSha256"]
        ):
            raise RuntimeError("Baseline package hash mismatch.")
        backups[function] = (backup, previous_digest)
    s3.upload_file(
        str(package), bucket, key, ExtraArgs={"ServerSideEncryption": "AES256"}
    )
    try:
        for function in functions:
            lambda_client.update_function_code(
                FunctionName=function, S3Bucket=bucket, S3Key=key
            )
            changed.append(function)
            lambda_client.get_waiter("function_updated_v2").wait(FunctionName=function)
            current = lambda_client.get_function(FunctionName=function)["Configuration"]
            if (
                current["CodeSha256"] != expected_hash
                or current.get("LastUpdateStatus") != "Successful"
            ):
                raise RuntimeError(
                    "Function update did not match the reviewed artifact."
                )
            print(
                json.dumps(
                    {
                        "function": function,
                        "codeSha256": expected_hash,
                        "status": "verified",
                    }
                )
            )
    except Exception:
        for function in reversed(changed):
            backup, previous_digest = backups[function]
            previous_key = f"assistant-simulation/api-{previous_digest.hex()}.zip"
            s3.upload_file(
                str(backup),
                bucket,
                previous_key,
                ExtraArgs={"ServerSideEncryption": "AES256"},
            )
            lambda_client.update_function_code(
                FunctionName=function, S3Bucket=bucket, S3Key=previous_key
            )
            lambda_client.get_waiter("function_updated_v2").wait(FunctionName=function)
            print(
                json.dumps({"function": function, "status": "restored_previous_code"})
            )
        raise
