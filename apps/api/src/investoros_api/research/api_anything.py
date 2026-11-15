"""Small REST client for the private API Anything host; no credentials are logged."""

import json
import os
import re
import time
import urllib.error
import urllib.request
from typing import Any

from investoros_api.research.macro import bank_of_canada_snapshot


class ApiAnythingError(RuntimeError):
    def __init__(self, message: str, failure_class: str = "transport", status_code: int | None = None):
        super().__init__(message)
        self.failure_class = failure_class
        self.status_code = status_code


class ApiAnythingClient:
    def __init__(self):
        self.base = os.getenv("API_ANYTHING_URL", "").rstrip("/")
        self.token = os.getenv("API_ANYTHING_TOKEN", "")
        secret_arn = os.getenv("API_ANYTHING_TOKEN_SECRET_ARN", "")
        if not self.token and secret_arn:
            import boto3
            from botocore.exceptions import BotoCoreError, ClientError

            try:
                secret = boto3.client("secretsmanager", region_name=os.getenv("AWS_REGION", "us-east-1")).get_secret_value(
                    SecretId=secret_arn
                )
                self.token = secret.get("SecretString", "")
            except (BotoCoreError, ClientError) as error:
                raise ApiAnythingError("Le jeton API Anything est indisponible.", "secret") from error
        self.timeout = float(os.getenv("API_ANYTHING_TIMEOUT_SECONDS", "60"))

    @property
    def configured(self) -> bool:
        return bool(self.base and self.token)

    def request(self, method: str, path: str, payload: dict | None = None) -> dict[str, Any]:
        if not self.configured:
            raise ApiAnythingError("API Anything n'est pas configuré.", "not_configured")
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            self.base + path,
            data=data,
            method=method,
            headers={"Authorization": f"Bearer {self.token}", "Content-Type": "application/json", "Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                parsed = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            raise ApiAnythingError(f"API Anything a répondu HTTP {error.code}.", "http", error.code) from error
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            raise ApiAnythingError("API Anything est injoignable ou a renvoyé une réponse invalide.", "transport") from error
        if not isinstance(parsed, dict):
            raise ApiAnythingError("Réponse API Anything invalide.", "schema")
        return parsed

    def get_site(self, site: str) -> dict[str, Any]:
        return self.request("GET", f"/v1/sites/{site}")

    def resolve_pending(self, result: dict[str, Any], max_seconds: int = 300) -> dict[str, Any]:
        deadline = time.monotonic() + max_seconds
        while result.get("class") == "pending":
            job = result.get("job")
            if not isinstance(job, str) or not job or "/" in job:
                raise ApiAnythingError("API Anything a renvoyé une tâche différée invalide.", "schema")
            if time.monotonic() >= deadline:
                raise ApiAnythingError("Le navigateur API Anything dépasse le délai de recherche.", "pending")
            time.sleep(1)
            result = self.request("GET", f"/v1/jobs/{job}")
        return result

    def learn(self, source: dict, value: str) -> dict[str, Any]:
        param = source["param"]
        trigger = source["trigger"]
        example_values = source["examples"]
        value = value if value and value not in example_values else example_values[-1]
        result = self.request("POST", "/v1/learn", {
            "site": source["api_site"], "op": source["api_operation"],
            "trigger": trigger, "args": {param: example_values[0]},
            "args2": {param: example_values[1]}, "args3": {param: value},
            "intent": source["description"],
            **({"pick": source["api_pick"]} if source.get("api_pick") else {}),
            **({"extract": source["api_extract"]} if source.get("api_extract") else {}),
        })
        return self.resolve_pending(result)

    def call(self, source: dict, value: str) -> dict[str, Any]:
        param = source["param"]
        result = self.request("POST", f"/v1/call/{source['api_site']}/{source['api_operation']}", {
            "args": {param: value}, "maxTier": 3, "view": {"maxChars": 200000},
        })
        result = self.resolve_pending(result)
        if result.get("ok") is not True:
            failure = result.get("class", "unknown")
            raise ApiAnythingError(str(result.get("reason") or "L'opération API Anything a échoué."), str(failure))
        if result.get("truncated"):
            result_id = result.get("resultId", "")
            if not isinstance(result_id, str) or not re.fullmatch(r"[0-9a-f-]{36}", result_id):
                raise ApiAnythingError("Réponse tronquée sans résultat conservé exploitable.", "schema")
            fragments = []
            offset = 0
            for _ in range(20):
                part = self.request("GET", f"/v1/results/{result_id}?format=json&offset={offset}&maxChars=200000")
                if part.get("encoding") != "json" or not isinstance(part.get("data"), str) or not part["data"]:
                    raise ApiAnythingError("Fragment JSON API Anything invalide.", "schema")
                fragments.append(part["data"])
                offset += len(part["data"].encode("utf-16-le", errors="surrogatepass")) // 2
                if not part.get("more"):
                    try:
                        result["data"] = json.loads("".join(fragments))
                    except ValueError as error:
                        raise ApiAnythingError("Impossible de reconstituer la réponse API.", "schema") from error
                    result.pop("truncated", None)
                    break
            else:
                raise ApiAnythingError("Réponse API au-delà de la limite de lecture.", "schema")
        if source.get("id") == "bank-of-canada":
            try:
                result["data"] = bank_of_canada_snapshot(result.get("data"), value)
            except (TypeError, ValueError) as error:
                raise ApiAnythingError("La série de change renvoyée est invalide; lecture navigateur requise.", "schema") from error
        return result
