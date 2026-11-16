"""Runtime lookup for the optional, version-pinned Bedrock Guardrail."""

import json
import os

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError


def _client(service: str):
    return boto3.client(
        service,
        region_name=os.getenv("AWS_REGION", "us-east-1"),
        config=Config(connect_timeout=3, read_timeout=5, retries={"max_attempts": 2, "mode": "standard"}),
    )


def active_guardrail() -> dict[str, str] | None:
    """Read the admin-selected binding; an absent parameter means disabled.

    AWS read failures are raised so the chat does not silently bypass an
    explicitly enabled guardrail. The setting contains identifiers only, never
    user prompts or model output.
    """
    parameter_name = os.getenv("BEDROCK_GUARDRAIL_CONFIG_PARAMETER", "").strip()
    if not parameter_name:
        return None
    try:
        value = _client("ssm").get_parameter(Name=parameter_name).get("Parameter", {}).get("Value", "")
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") == "ParameterNotFound":
            raise RuntimeError("La configuration Bedrock Guardrails est absente du Parameter Store.") from error
        raise
    except BotoCoreError:
        raise
    if not value:
        return None
    try:
        config = json.loads(value)
    except (TypeError, json.JSONDecodeError) as error:
        raise RuntimeError("La configuration du garde-fou Bedrock est invalide.") from error
    if not isinstance(config, dict) or not isinstance(config.get("enabled"), bool):
        raise RuntimeError("La configuration du garde-fou Bedrock est invalide.")
    if config["enabled"] is False:
        return None
    identifier, version = config.get("guardrailId"), config.get("guardrailVersion")
    if not isinstance(identifier, str) or not identifier or not isinstance(version, str) or not version.isdigit():
        raise RuntimeError("La configuration du garde-fou doit utiliser une version publiée.")
    return {"guardrailIdentifier": identifier, "guardrailVersion": version}
