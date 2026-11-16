"""Admin-only inspection and control for Amazon Bedrock Guardrails."""

from __future__ import annotations

import json
import os
from typing import Any, Literal

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from .admin_console import _client, _paginate, _read_at, require_admin

router = APIRouter(prefix="/v1/admin/guardrails", tags=["admin", "guardrails"])


class GuardrailBinding(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool
    guardrailId: str | None = Field(default=None, min_length=1, max_length=128)
    guardrailVersion: str | None = Field(default=None, min_length=1, max_length=10)


class GuardrailTest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    guardrailId: str = Field(min_length=1, max_length=128)
    guardrailVersion: str = Field(min_length=1, max_length=10)
    source: Literal["INPUT", "OUTPUT"]
    text: str = Field(min_length=1, max_length=6000)


class GuardrailVersionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    description: str = Field(default="Version testée depuis Admin InvestorOS", max_length=200)


def _parameter_name() -> str:
    name = os.getenv("BEDROCK_GUARDRAIL_CONFIG_PARAMETER", "").strip()
    if not name:
        raise HTTPException(503, "La configuration SSM des garde-fous n’est pas définie dans cet environnement.")
    return name


def _guardrail_client():
    return _client("bedrock")


def _runtime_client():
    return _client("bedrock-runtime")


def _managed_guardrail_id() -> str:
    return os.getenv("BEDROCK_GUARDRAIL_ID", "").strip()


def _require_managed(guardrail_id: str) -> None:
    if not _managed_guardrail_id():
        raise HTTPException(503, "Le garde-fou géré par InvestorOS n’est pas déployé dans cet environnement.")
    if guardrail_id != _managed_guardrail_id():
        raise HTTPException(403, "Seul le garde-fou géré par InvestorOS peut être modifié ou testé ici.")


def _active_config() -> dict[str, Any]:
    parameter_name = os.getenv("BEDROCK_GUARDRAIL_CONFIG_PARAMETER", "").strip()
    if not parameter_name:
        return {"enabled": False, "guardrailId": None, "guardrailVersion": None}
    try:
        value = _client("ssm").get_parameter(Name=parameter_name).get("Parameter", {}).get("Value", "")
        config = json.loads(value) if value else {"enabled": False}
        if not isinstance(config, dict) or not isinstance(config.get("enabled"), bool):
            raise ValueError("invalid configuration")
        return {
            "enabled": config["enabled"],
            "guardrailId": config.get("guardrailId"),
            "guardrailVersion": config.get("guardrailVersion"),
        }
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") == "ParameterNotFound":
            raise HTTPException(503, "Le paramètre de configuration des garde-fous est absent.") from None
        raise HTTPException(503, "La configuration des garde-fous est inaccessible dans AWS.") from None
    except (BotoCoreError, json.JSONDecodeError, ValueError):
        raise HTTPException(503, "La configuration des garde-fous est invalide ou inaccessible.") from None


@router.get("")
def list_guardrails(_: None = Depends(require_admin)) -> dict[str, Any]:
    try:
        items = _paginate(_guardrail_client(), "list_guardrails", "guardrails")
        guardrails = [
            {
                "guardrailId": item.get("id"),
                "name": item.get("name"),
                "description": item.get("description", ""),
                "version": item.get("version", "DRAFT"),
                "status": item.get("status", "UNKNOWN"),
                "managed": item.get("id") == _managed_guardrail_id() and bool(_managed_guardrail_id()),
                "updatedAt": item.get("updatedAt").isoformat() if item.get("updatedAt") else None,
            }
            for item in items
        ]
        return {"readAt": _read_at(), "region": os.getenv("AWS_REGION", "us-east-1"),
                "guardrails": guardrails, "active": _active_config(), "available": True,
                "configurable": bool(os.getenv("BEDROCK_GUARDRAIL_CONFIG_PARAMETER", "").strip()
                                      and _managed_guardrail_id())}
    except (BotoCoreError, ClientError):
        raise HTTPException(503, "La liste des garde-fous Bedrock est inaccessible.") from None


@router.get("/{guardrail_id}")
def get_guardrail(guardrail_id: str, _: None = Depends(require_admin)) -> dict[str, Any]:
    _require_managed(guardrail_id)
    try:
        client = _guardrail_client()
        response = client.get_guardrail(guardrailIdentifier=guardrail_id)
        versions = _paginate(client, "list_guardrail_versions", "guardrailSummaries", guardrailIdentifier=guardrail_id)
        policies = {
            key: response.get(key)
            for key in ("contentPolicy", "topicPolicy", "wordPolicy", "sensitiveInformationPolicy", "contextualGroundingPolicy", "automatedReasoningPolicy")
            if response.get(key)
        }
        return {
            "guardrailId": response.get("guardrailId"),
            "name": response.get("name"),
            "description": response.get("description", ""),
            "status": response.get("status", "UNKNOWN"),
            "version": response.get("version", "DRAFT"),
            "versions": [
                {"version": item.get("version"), "status": item.get("status"),
                 "description": item.get("description", "")}
                for item in versions
            ],
            "policies": policies,
            "blockedInputMessaging": response.get("blockedInputMessaging", ""),
            "blockedOutputsMessaging": response.get("blockedOutputsMessaging", ""),
        }
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code", "")
        if code in {"ResourceNotFoundException", "ValidationException"}:
            raise HTTPException(404, "Garde-fou Bedrock introuvable.") from None
        raise HTTPException(503, "Le détail du garde-fou est inaccessible.") from None
    except BotoCoreError:
        raise HTTPException(503, "Le détail du garde-fou est inaccessible.") from None


@router.put("/config")
def set_guardrail_binding(body: GuardrailBinding, _: None = Depends(require_admin)) -> dict[str, Any]:
    config: dict[str, Any] = {"enabled": False}
    if body.enabled:
        if not body.guardrailId or not body.guardrailVersion or not body.guardrailVersion.isdigit():
            raise HTTPException(422, "Choisissez un garde-fou READY et une version publiée (pas DRAFT).")
        _require_managed(body.guardrailId)
        try:
            guardrail = _guardrail_client().get_guardrail(
                guardrailIdentifier=body.guardrailId,
                guardrailVersion=body.guardrailVersion,
            )
        except ClientError as error:
            code = error.response.get("Error", {}).get("Code", "")
            if code in {"ResourceNotFoundException", "ValidationException"}:
                raise HTTPException(422, "Cette version du garde-fou n’existe pas ou n’est pas prête.") from None
            raise HTTPException(503, "Bedrock n’a pas pu valider ce garde-fou.") from None
        except BotoCoreError:
            raise HTTPException(503, "Bedrock n’a pas pu valider ce garde-fou.") from None
        if guardrail.get("status") != "READY":
            raise HTTPException(422, "Le garde-fou doit être READY avant son activation.")
        config = {"enabled": True, "guardrailId": body.guardrailId,
                  "guardrailVersion": body.guardrailVersion}
    try:
        _client("ssm").put_parameter(
            Name=_parameter_name(), Type="String", Value=json.dumps(config, separators=(",", ":")),
            Overwrite=True, Description="Version Bedrock Guardrail sélectionnée dans la console Admin InvestorOS",
        )
    except (BotoCoreError, ClientError):
        raise HTTPException(503, "Impossible d’enregistrer la configuration des garde-fous.") from None
    return {**config, "updatedAt": _read_at()}


@router.post("/{guardrail_id}/versions")
def publish_guardrail_version(guardrail_id: str, body: GuardrailVersionRequest,
                              _: None = Depends(require_admin)) -> dict[str, Any]:
    _require_managed(guardrail_id)
    try:
        response = _guardrail_client().create_guardrail_version(
            guardrailIdentifier=guardrail_id, description=body.description,
        )
        return {"guardrailId": response.get("guardrailId", guardrail_id),
                "version": response.get("version"), "status": "CREATING"}
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code", "")
        if code in {"ResourceNotFoundException", "ValidationException"}:
            raise HTTPException(422, "Le brouillon du garde-fou n’est pas prêt à être publié.") from None
        raise HTTPException(503, "Bedrock n’a pas pu publier cette version.") from None
    except BotoCoreError:
        raise HTTPException(503, "Bedrock n’a pas pu publier cette version.") from None


@router.post("/test")
def test_guardrail(body: GuardrailTest, _: None = Depends(require_admin)) -> dict[str, Any]:
    _require_managed(body.guardrailId)
    if not body.guardrailVersion.isdigit() and body.guardrailVersion != "DRAFT":
        raise HTTPException(422, "La version doit être publiée ou correspondre au brouillon DRAFT pour un test.")
    try:
        response = _runtime_client().apply_guardrail(
            guardrailIdentifier=body.guardrailId,
            guardrailVersion=body.guardrailVersion,
            source=body.source,
            content=[{"text": {"text": body.text}}],
        )
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code", "")
        if code in {"ResourceNotFoundException", "ValidationException"}:
            raise HTTPException(422, "Le garde-fou ou sa version n’existe pas ou ne peut pas être testé.") from None
        raise HTTPException(503, "Le test Bedrock Guardrails a échoué.") from None
    except BotoCoreError:
        raise HTTPException(503, "Le test Bedrock Guardrails a échoué.") from None
    output = "".join(item.get("text", "") for item in response.get("outputs", []) if isinstance(item, dict))
    assessments = response.get("assessments", [])
    filters = sorted({
        key for assessment in assessments for key in (
            "contentPolicy", "topicPolicy", "wordPolicy", "sensitiveInformationPolicy",
            "contextualGroundingPolicy", "automatedReasoningPolicy",
        ) if assessment.get(key)
    })
    return {"action": response.get("action", "NONE"), "output": output,
            "blocked": response.get("action") == "GUARDRAIL_INTERVENED",
            "filtersTriggered": filters, "source": body.source}
