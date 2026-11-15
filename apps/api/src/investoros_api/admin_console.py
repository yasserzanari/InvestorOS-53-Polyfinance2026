"""Read-only, admin-token protected platform telemetry and architecture inventory."""

from __future__ import annotations

import hmac
import json
import os
import re
import time
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Header, HTTPException

from investoros_api.admin_terraform import terraform_architecture

router = APIRouter(prefix="/v1/admin", tags=["admin"])
_token_cache: tuple[str, float] | None = None


def _region() -> str:
    return os.getenv("AWS_REGION", "us-east-1")


@lru_cache(maxsize=12)
def _client(service: str, region: str | None = None):
    return boto3.client(service, region_name=region or _region())


def _read_at() -> str:
    return datetime.now(timezone.utc).isoformat()


def _secret_token() -> str | None:
    global _token_cache
    direct = os.getenv("INVESTOROS_ADMIN_TOKEN", "").strip()
    if direct:
        return direct
    if _token_cache and _token_cache[1] > time.monotonic():
        return _token_cache[0]
    secret_arn = (
        os.getenv("ADMIN_CONSOLE_TOKEN_SECRET_ARN", "").strip()
        or os.getenv("RESEARCH_ADMIN_TOKEN_SECRET_ARN", "").strip()
    )
    if not secret_arn:
        return None
    try:
        value = _client("secretsmanager").get_secret_value(SecretId=secret_arn).get("SecretString", "")
    except (BotoCoreError, ClientError):
        return None
    if not value:
        return None
    try:
        parsed = json.loads(value)
        if isinstance(parsed, dict):
            value = next(
                (parsed[key] for key in ("admin_token", "token", "secret") if isinstance(parsed.get(key), str)),
                value,
            )
    except json.JSONDecodeError:
        pass
    token = value.strip() if isinstance(value, str) else ""
    if token:
        _token_cache = (token, time.monotonic() + 60)
        return token
    return None


def require_admin(x_admin_token: str | None = Header(default=None, alias="x-admin-token")) -> None:
    expected = _secret_token()
    if expected is None:
        raise HTTPException(status_code=503, detail="La console Admin n’est pas configurée sur ce serveur.")
    if not x_admin_token or not hmac.compare_digest(expected, x_admin_token.strip()):
        raise HTTPException(status_code=401, detail="Jeton Admin invalide ou manquant.")


def _paginate(client: Any, operation: str, result_key: str, **params: Any) -> list[dict[str, Any]]:
    paginator = client.get_paginator(operation)
    values: list[dict[str, Any]] = []
    for page in paginator.paginate(**params):
        values.extend(page.get(result_key, []) or [])
    return values


def _safe_error(service: str, error: Exception) -> dict[str, str]:
    code = "indisponible"
    if isinstance(error, ClientError):
        code = str(error.response.get("Error", {}).get("Code", "indisponible"))
    elif isinstance(error, BotoCoreError):
        code = "connexion_aws"
    return {"service": service, "code": code, "message": "Les métriques de ce service ne sont pas accessibles."}


def _collect_resources() -> tuple[dict[str, Any], list[dict[str, str]]]:
    resources: dict[str, Any] = {"apis": [], "functions": [], "stateMachines": [], "tables": [], "buckets": [], "distributions": []}
    errors: list[dict[str, str]] = []
    collectors = [
        ("apis", "API Gateway", lambda: [api for api in _paginate(_client("apigatewayv2"), "get_apis", "Items") if "investoros" in api.get("Name", "").lower()]),
        ("functions", "Lambda", lambda: [fn for fn in _paginate(_client("lambda"), "list_functions", "Functions") if fn.get("FunctionName", "").startswith("investoros-")]),
        ("stateMachines", "Step Functions", lambda: [sm for sm in _paginate(_client("stepfunctions"), "list_state_machines", "stateMachines") if sm.get("name", "").startswith("investoros-")]),
        ("tables", "DynamoDB", lambda: _paginate(_client("dynamodb"), "list_tables", "TableNames")),
        ("buckets", "Amazon S3", lambda: _client("s3").list_buckets().get("Buckets", [])),
        ("distributions", "CloudFront", lambda: _cloudfront_distributions()),
    ]
    for key, service, collect in collectors:
        try:
            values = collect()
            if key == "tables":
                values = [name for name in values if name.startswith("investoros-")]
            elif key == "buckets":
                values = [bucket for bucket in values if bucket.get("Name", "").startswith("investoros-")]
            elif key == "distributions":
                values = [item for item in values if "investoros" in item.get("Comment", "").lower() or any("investoros" in origin.get("DomainName", "").lower() for origin in item.get("Origins", {}).get("Items", []))]
            resources[key] = values
        except (BotoCoreError, ClientError, KeyError) as error:
            errors.append(_safe_error(service, error))
    return resources, errors


def _cloudfront_distributions() -> list[dict[str, Any]]:
    client = _client("cloudfront", "us-east-1")
    result: list[dict[str, Any]] = []
    marker = None
    while True:
        response = client.list_distributions(**({"Marker": marker} if marker else {}))
        distribution_list = response.get("DistributionList", {})
        result.extend(distribution_list.get("Items", []) or [])
        if not distribution_list.get("IsTruncated"):
            return result
        marker = distribution_list.get("NextMarker")
        if not marker:
            return result


def _make_metric_query(key: str, namespace: str, name: str, dimensions: list[dict[str, str]], stat: str) -> dict[str, Any]:
    query_id = re.sub(r"[^a-zA-Z0-9_]", "_", key).lower()[:250]
    if not query_id or not query_id[0].isalpha():
        query_id = f"m_{query_id}"
    return {
        "Id": query_id,
        "Label": key,
        "MetricStat": {
            "Metric": {"Namespace": namespace, "MetricName": name, "Dimensions": dimensions},
            "Period": 60,
            "Stat": stat,
        },
        "ReturnData": True,
    }


def _metric_data(specs: list[dict[str, Any]], hours: int = 1) -> tuple[dict[str, dict[str, Any]], list[dict[str, str]]]:
    if not specs:
        return {}, []
    end = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    start = end - timedelta(hours=hours)
    requests = [
        _make_metric_query(item["key"], item["namespace"], item["name"], item["dimensions"], item["stat"])
        for item in specs
    ]
    key_by_id = {query["Id"]: query["Label"] for query in requests}
    data: dict[str, dict[str, Any]] = {}
    errors: list[dict[str, str]] = []
    try:
        response = _client("cloudwatch").get_metric_data(
            MetricDataQueries=requests,
            StartTime=start,
            EndTime=end,
            ScanBy="TimestampAscending",
        )
        for item in response.get("MetricDataResults", []):
            key = key_by_id.get(item.get("Id", ""), item.get("Label", ""))
            points = sorted(
                [
                    {"at": stamp.isoformat(), "value": float(value)}
                    for stamp, value in zip(item.get("Timestamps", []), item.get("Values", []))
                ],
                key=lambda point: point["at"],
            )
            values = [point["value"] for point in points]
            data[key] = {
                "points": points,
                "total": sum(values) if values else None,
                "latest": values[-1] if values else None,
                "peak": max(values) if values else None,
                "available": bool(points),
            }
        next_token = response.get("NextToken")
        pages = 0
        while next_token and pages < 4:
            response = _client("cloudwatch").get_metric_data(
                MetricDataQueries=requests,
                StartTime=start,
                EndTime=end,
                ScanBy="TimestampAscending",
                NextToken=next_token,
            )
            for item in response.get("MetricDataResults", []):
                key = key_by_id.get(item.get("Id", ""), item.get("Label", ""))
                points = data.setdefault(key, {"points": [], "total": None, "latest": None, "peak": None, "available": False})["points"]
                points.extend({"at": stamp.isoformat(), "value": float(value)} for stamp, value in zip(item.get("Timestamps", []), item.get("Values", [])))
            next_token = response.get("NextToken")
            pages += 1
        for item in data.values():
            item["points"].sort(key=lambda point: point["at"])
            values = [point["value"] for point in item["points"]]
            item.update({"total": sum(values) if values else None, "latest": values[-1] if values else None, "peak": max(values) if values else None, "available": bool(values)})
    except (BotoCoreError, ClientError) as error:
        errors.append(_safe_error("CloudWatch", error))
    for request in requests:
        data.setdefault(request["Label"], {"points": [], "total": None, "latest": None, "peak": None, "available": False})
    return data, errors


def _metric_specs(resources: dict[str, Any]) -> list[dict[str, Any]]:
    specs: list[dict[str, Any]] = []
    for api in resources["apis"]:
        dimensions = [{"Name": "ApiId", "Value": api["ApiId"]}, {"Name": "Stage", "Value": "$default"}]
        for name, stat in [("Count", "Sum"), ("4XXError", "Sum"), ("5XXError", "Sum"), ("Latency", "p95"), ("IntegrationLatency", "p95")]:
            specs.append({"key": f"api.{api['ApiId']}.{name}", "namespace": "AWS/ApiGateway", "name": name, "dimensions": dimensions, "stat": stat})
    for function in resources["functions"]:
        dimensions = [{"Name": "FunctionName", "Value": function["FunctionName"]}]
        for name, stat in [("Invocations", "Sum"), ("Errors", "Sum"), ("Throttles", "Sum"), ("Duration", "Average")]:
            specs.append({"key": f"lambda.{function['FunctionName']}.{name}", "namespace": "AWS/Lambda", "name": name, "dimensions": dimensions, "stat": stat})
    for machine in resources["stateMachines"]:
        dimensions = [{"Name": "StateMachineArn", "Value": machine["stateMachineArn"]}]
        for name in ("ExecutionsStarted", "ExecutionsSucceeded", "ExecutionsFailed", "ExecutionsTimedOut"):
            specs.append({"key": f"states.{machine['name']}.{name}", "namespace": "AWS/States", "name": name, "dimensions": dimensions, "stat": "Sum"})
    for table in resources["tables"]:
        dimensions = [{"Name": "TableName", "Value": table}]
        for name in ("ReadThrottleEvents", "WriteThrottleEvents"):
            specs.append({"key": f"dynamodb.{table}.{name}", "namespace": "AWS/DynamoDB", "name": name, "dimensions": dimensions, "stat": "Sum"})
    model_id = os.getenv("BEDROCK_MODEL_ID", "")
    if model_id:
        dimensions = [{"Name": "ModelId", "Value": model_id}]
        for name in ("InputTokenCount", "OutputTokenCount", "Invocations"):
            specs.append({"key": f"bedrock.{name}", "namespace": "AWS/Bedrock", "name": name, "dimensions": dimensions, "stat": "Sum"})
    return specs


def _api_routes(api: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    client = _client("apigatewayv2")
    routes = _paginate(client, "get_routes", "Items", ApiId=api["ApiId"])
    integrations = _paginate(client, "get_integrations", "Items", ApiId=api["ApiId"])
    return routes, integrations


def _live_architecture(resources: dict[str, Any], errors: list[dict[str, str]]) -> dict[str, Any]:
    nodes: dict[str, dict[str, Any]] = {}
    edges: dict[str, dict[str, str]] = {}

    def add_node(node_id: str, label: str, service: str, icon: str, layer: str, detail: str, **extra: Any) -> str:
        nodes[node_id] = {
            "id": node_id, "label": label, "service": service, "icon": icon,
            "layer": layer, "kind": "resource", "status": "En ligne",
            "source": "aws", "detail": detail, **extra,
        }
        return node_id

    def add_edge(source: str, target: str, label: str) -> None:
        if source == target or source not in nodes or target not in nodes:
            return
        edge_id = f"{source}->{target}:{label}"
        edges[edge_id] = {"id": edge_id, "source": source, "target": target, "label": label}

    browser = add_node("client:browser", "Navigateur", "Interface InvestorOS", "browser", "entry", "Client web du site InvestorOS")
    lambda_by_arn: dict[str, str] = {}
    lambda_by_name: dict[str, str] = {}
    table_ids = {table: add_node(f"dynamodb:{table}", table.removeprefix("investoros-dev-"), "Amazon DynamoDB", "dynamodb", "data", f"Table {table}", resourceName=table) for table in resources["tables"]}
    bucket_by_domain: dict[str, str] = {}
    for bucket in resources["buckets"]:
        name = bucket.get("Name", "")
        bucket_by_domain[name] = add_node(f"s3:{name}", name.removeprefix("investoros-dev-"), "Amazon S3", "s3", "data", "Bucket de la plateforme", resourceName=name, updatedAt=bucket.get("CreationDate").isoformat() if bucket.get("CreationDate") else None)

    for distribution in resources["distributions"]:
        distribution_id = distribution.get("Id", "distribution")
        node_id = add_node(f"cloudfront:{distribution_id}", "Site InvestorOS", "Amazon CloudFront", "cloudfront", "entry", f"Distribution {distribution_id} · {distribution.get('DomainName', '')}", resourceName=distribution_id, status="En ligne" if distribution.get("Status") == "Deployed" else distribution.get("Status", "Déployée"))
        add_edge(browser, node_id, "HTTPS")
        for origin in distribution.get("Origins", {}).get("Items", []):
            domain = origin.get("DomainName", "")
            for bucket_name, bucket_id in bucket_by_domain.items():
                if domain.startswith(bucket_name + "."):
                    add_edge(node_id, bucket_id, "origine privée S3")

    for api in resources["apis"]:
        api_id = api["ApiId"]
        api_node = add_node(f"api:{api_id}", api.get("Name", "API InvestorOS"), "Amazon API Gateway", "api-gateway", "entry", api.get("ApiEndpoint", api_id), resourceName=api_id, endpoint=api.get("ApiEndpoint"))
        add_edge(browser, api_node, "API HTTPS")
        try:
            _, integrations = _api_routes(api)
            for integration in integrations:
                target_arn = integration.get("IntegrationUri", "")
                match = re.search(r":function:([^:/]+)(?::|/|$)", target_arn)
                target_name = match.group(1) if match else None
                if target_name and target_name in lambda_by_name:
                    add_edge(api_node, lambda_by_name[target_name], "intégration Lambda")
                elif target_arn:
                    api.setdefault("integrationTargets", []).append(target_arn)
        except (BotoCoreError, ClientError) as error:
            errors.append(_safe_error("API Gateway", error))

    for function in resources["functions"]:
        name = function["FunctionName"]
        node_id = add_node(f"lambda:{name}", name.removeprefix("investoros-dev-"), "AWS Lambda", "lambda", "compute", function.get("Description") or f"{function.get('Runtime')} · {function.get('Timeout')} s", resourceName=name, runtime=function.get("Runtime"), timeout=function.get("Timeout"), memory=function.get("MemorySize"), role=function.get("Role"))
        lambda_by_arn[function["FunctionArn"]] = node_id
        lambda_by_name[name] = node_id
        logs = function.get("LoggingConfig", {}).get("LogGroup") or f"/aws/lambda/{name}"
        log_id = add_node(f"logs:{logs}", logs.split("/")[-1], "Amazon CloudWatch", "cloudwatch", "operations", f"Groupe de journaux {logs}", resourceName=logs)
        add_edge(node_id, log_id, "journaux")

    for api in resources["apis"]:
        api_node = f"api:{api['ApiId']}"
        for target_arn in api.get("integrationTargets", []):
            target_name = re.search(r":function:([^:/]+)(?::|/|$)", target_arn)
            if target_name and target_name.group(1) in lambda_by_name:
                add_edge(api_node, lambda_by_name[target_name.group(1)], "intégration Lambda")

    for function in resources["functions"]:
        name = function["FunctionName"]
        node_id = lambda_by_name[name]
        env = function.get("Environment", {}).get("Variables", {})
        for key, table in env.items():
            if key.endswith("_TABLE_NAME") and table in table_ids:
                add_edge(node_id, table_ids[table], "lecture / écriture selon le rôle")
        state_arn = env.get("RESEARCH_STATE_MACHINE_ARN", "")
        if state_arn:
            machine_name = state_arn.rsplit(":", 1)[-1]
            add_node(f"states:{machine_name}", machine_name.removeprefix("investoros-dev-"), "AWS Step Functions", "step-functions", "orchestration", f"State machine {machine_name}", resourceName=machine_name)
            add_edge(node_id, f"states:{machine_name}", "démarre une recherche")
        model_id = env.get("BEDROCK_MODEL_ID")
        if model_id:
            model_node = add_node(f"bedrock:{model_id}", model_id, "Amazon Bedrock", "bedrock", "ai", f"Modèle configuré · région {_region()}", resourceName=model_id)
            add_edge(node_id, model_node, "inférence")
        for key, arn in env.items():
            if key.endswith("SECRET_ARN") and arn:
                secret_name = arn.split(":secret:", 1)[-1]
                secret_node = add_node(f"secret:{secret_name}", secret_name.split("-")[0], "AWS Secrets Manager", "secrets-manager", "security", "Référence de secret · valeur masquée", resourceName=secret_name.split("-")[0])
                add_edge(node_id, secret_node, "lecture serveur")
        dataset_bucket = env.get("STARTER_DATASET_BUCKET")
        if dataset_bucket:
            if dataset_bucket not in bucket_by_domain:
                bucket_by_domain[dataset_bucket] = add_node(f"s3:{dataset_bucket}", dataset_bucket.removeprefix("investoros-dev-"), "Amazon S3", "s3", "data", "Jeu de données de recherche", resourceName=dataset_bucket)
            add_edge(node_id, bucket_by_domain[dataset_bucket], "jeu de données")
        api_anything = env.get("API_ANYTHING_URL")
        if api_anything:
            host = re.sub(r"^https?://", "", api_anything).split("/", 1)[0].split(":", 1)[0]
            service_id = "external:api-anything"
            add_node(service_id, "API Anything", "Application Load Balancer privé", "elb", "network", f"Point de terminaison privé · {host}", resourceName="API Anything")
            add_edge(node_id, service_id, "collecte de sources")

    for machine in resources["stateMachines"]:
        machine_name = machine["name"]
        machine_id = f"states:{machine_name}"
        add_node(machine_id, machine_name.removeprefix("investoros-dev-"), "AWS Step Functions", "step-functions", "orchestration", "Workflow d’analyse durable", resourceName=machine_name)
        try:
            definition = _client("stepfunctions").describe_state_machine(stateMachineArn=machine["stateMachineArn"]).get("definition", "{}")
            workflow = json.loads(definition) if isinstance(definition, str) else definition
            function_arns = set(re.findall(r":function:([^:/]+)(?::|/|$)", json.dumps(workflow)))
            for function_name in function_arns:
                if function_name in lambda_by_name:
                    add_edge(machine_id, lambda_by_name[function_name], "invoque le worker")
        except (BotoCoreError, ClientError, json.JSONDecodeError) as error:
            errors.append(_safe_error("Step Functions", error))
    return {
        "source": "aws-live",
        "available": any(resources[key] for key in ("apis", "functions", "stateMachines", "tables", "buckets", "distributions")),
        "readAt": _read_at(),
        "region": _region(),
        "nodes": list(nodes.values()),
        "edges": list(edges.values()),
        "errors": errors,
        "counts": {"resources": len(nodes), "connections": len(edges)},
    }


@router.get("/summary")
def admin_summary(_: None = __import__("fastapi").Depends(require_admin)) -> dict[str, Any]:
    resources, errors = _collect_resources()
    specs = _metric_specs(resources)
    metrics, metric_errors = _metric_data(specs)
    errors.extend(metric_errors)
    api_id = resources["apis"][0]["ApiId"] if resources["apis"] else None
    api_prefix = f"api.{api_id}." if api_id else ""
    api_requests = metrics.get(f"{api_prefix}Count", {}).get("total") if api_id else None
    api_4xx = metrics.get(f"{api_prefix}4XXError", {}).get("total") if api_id else None
    api_5xx = metrics.get(f"{api_prefix}5XXError", {}).get("total") if api_id else None
    api_errors = (api_4xx or 0) + (api_5xx or 0) if api_4xx is not None or api_5xx is not None else None
    lambda_invocation_metrics = [metrics.get(f"lambda.{fn['FunctionName']}.Invocations", {}) for fn in resources["functions"]]
    lambda_error_metrics = [metrics.get(f"lambda.{fn['FunctionName']}.Errors", {}) for fn in resources["functions"]]
    failed_run_metrics = [metrics.get(f"states.{sm['name']}.ExecutionsFailed", {}) for sm in resources["stateMachines"]]
    lambda_invocations = sum(item.get("total") or 0 for item in lambda_invocation_metrics) if any(item.get("available") for item in lambda_invocation_metrics) else None
    lambda_errors = sum(item.get("total") or 0 for item in lambda_error_metrics) if any(item.get("available") for item in lambda_error_metrics) else None
    failed_runs = sum(item.get("total") or 0 for item in failed_run_metrics) if any(item.get("available") for item in failed_run_metrics) else None
    tokens_in = metrics.get("bedrock.InputTokenCount", {}).get("total")
    tokens_out = metrics.get("bedrock.OutputTokenCount", {}).get("total")
    services: list[dict[str, Any]] = []
    for api in resources["apis"]:
        aid = api["ApiId"]
        services.append({"id": aid, "name": api.get("Name", "API Gateway"), "type": "API Gateway", "icon": "api-gateway", "state": "Disponible", "endpoint": api.get("ApiEndpoint"), "metrics": {name: metrics.get(f"api.{aid}.{name}") for name in ("Count", "4XXError", "5XXError", "Latency", "IntegrationLatency")}})
    for function in resources["functions"]:
        name = function["FunctionName"]
        env = function.get("Environment", {}).get("Variables", {})
        services.append({"id": name, "name": name, "type": "Lambda", "icon": "lambda", "state": function.get("State", "Active"), "updatedAt": function.get("LastModified"), "metrics": {metric: metrics.get(f"lambda.{name}.{metric}") for metric in ("Invocations", "Errors", "Throttles", "Duration")}, "model": env.get("BEDROCK_MODEL_ID")})
    for table in resources["tables"]:
        try:
            description = _client("dynamodb").describe_table(TableName=table).get("Table", {})
            state = description.get("TableStatus", "Unknown")
            size = description.get("TableSizeBytes")
            items = description.get("ItemCount")
        except (BotoCoreError, ClientError) as error:
            state, size, items = "Indisponible", None, None
            errors.append(_safe_error("DynamoDB", error))
        services.append({"id": table, "name": table, "type": "DynamoDB", "icon": "dynamodb", "state": state, "items": items, "sizeBytes": size, "metrics": {metric: metrics.get(f"dynamodb.{table}.{metric}") for metric in ("ReadThrottleEvents", "WriteThrottleEvents")}})
    for machine in resources["stateMachines"]:
        name = machine["name"]
        services.append({"id": name, "name": name, "type": "Step Functions", "icon": "step-functions", "state": "Actif", "metrics": {metric: metrics.get(f"states.{name}.{metric}") for metric in ("ExecutionsStarted", "ExecutionsSucceeded", "ExecutionsFailed", "ExecutionsTimedOut")}})
    services.append({"id": "bedrock", "name": os.getenv("BEDROCK_MODEL_ID", "Amazon Bedrock"), "type": "Bedrock", "icon": "bedrock", "state": "Configuré" if os.getenv("BEDROCK_MODEL_ID") else "Non configuré", "metrics": {name: metrics.get(f"bedrock.{name}") for name in ("Invocations", "InputTokenCount", "OutputTokenCount")}})
    return {
        "readAt": _read_at(),
        "region": _region(),
        "window": "Dernière heure · métriques CloudWatch par minute",
        "source": "AWS API + CloudWatch",
        "summary": {
            "apiRequests": api_requests,
            "apiErrors": api_errors,
            "apiErrorRate": (api_errors / api_requests * 100) if api_errors is not None and api_requests else (0.0 if api_errors == 0 else None),
            "apiP95LatencyMs": metrics.get(f"{api_prefix}Latency", {}).get("peak") if api_id else None,
            "lambdaInvocations": lambda_invocations,
            "lambdaErrors": lambda_errors,
            "failedAnalyses": failed_runs,
            "bedrockTokens": (tokens_in or 0) + (tokens_out or 0) if tokens_in is not None or tokens_out is not None else None,
            "bedrockInputTokens": tokens_in,
            "bedrockOutputTokens": tokens_out,
            "resourceCount": sum(len(resources[key]) for key in ("apis", "functions", "stateMachines", "tables", "buckets", "distributions")),
        },
        "services": services,
        "metrics": metrics,
        "errors": errors,
        "resourceCounts": {key: len(resources[key]) for key in ("apis", "functions", "stateMachines", "tables", "buckets", "distributions")},
    }


@router.get("/architecture")
def admin_architecture(mode: str = "live", _: None = __import__("fastapi").Depends(require_admin)) -> dict[str, Any]:
    if mode == "terraform":
        return terraform_architecture()
    if mode != "live":
        raise HTTPException(status_code=422, detail="Vue d’architecture inconnue.")
    resources, errors = _collect_resources()
    graph = _live_architecture(resources, errors)
    graph["errors"] = errors
    return graph


@router.get("/activity")
def admin_activity(_: None = __import__("fastapi").Depends(require_admin)) -> dict[str, Any]:
    runs: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    try:
        machines = [sm for sm in _paginate(_client("stepfunctions"), "list_state_machines", "stateMachines") if sm.get("name", "").startswith("investoros-")]
        for machine in machines:
            executions = _paginate(_client("stepfunctions"), "list_executions", "executions", stateMachineArn=machine["stateMachineArn"], maxResults=100)
            for execution in executions:
                start = execution.get("startDate")
                stop = execution.get("stopDate")
                runs.append({
                    "id": execution.get("executionArn", "").rsplit(":", 1)[-1],
                    "name": execution.get("name", "Analyse"),
                    "workflow": machine["name"],
                    "status": execution.get("status", "UNKNOWN"),
                    "startedAt": start.isoformat() if start else None,
                    "endedAt": stop.isoformat() if stop else None,
                    "durationSeconds": max(0, int((stop or datetime.now(timezone.utc)).timestamp() - start.timestamp())) if start else None,
                })
        runs.sort(key=lambda run: run["startedAt"] or "", reverse=True)
    except (BotoCoreError, ClientError) as error:
        errors.append(_safe_error("Step Functions", error))
    return {"readAt": _read_at(), "source": "AWS Step Functions", "runs": runs[:100], "errors": errors}


@router.get("/costs")
def admin_costs(_: None = __import__("fastapi").Depends(require_admin)) -> dict[str, Any]:
    now = datetime.now(timezone.utc).date()
    start = now.replace(day=1)
    end = now
    if end <= start:
        start = end - timedelta(days=1)
    try:
        response = _client("ce", "us-east-1").get_cost_and_usage(
            TimePeriod={"Start": start.isoformat(), "End": end.isoformat()},
            Granularity="DAILY",
            Metrics=["UnblendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
        )
        totals: dict[str, float] = {}
        daily: list[dict[str, Any]] = []
        for period in response.get("ResultsByTime", []):
            by_service = []
            for group in period.get("Groups", []):
                service = group.get("Keys", ["AWS"])[0]
                amount = float(group.get("Metrics", {}).get("UnblendedCost", {}).get("Amount", 0))
                unit = group.get("Metrics", {}).get("UnblendedCost", {}).get("Unit", "USD")
                totals[service] = totals.get(service, 0.0) + amount
                if amount:
                    by_service.append({"name": service, "amount": amount, "unit": unit})
            daily.append({"start": period.get("TimePeriod", {}).get("Start"), "end": period.get("TimePeriod", {}).get("End"), "amount": sum(item["amount"] for item in by_service), "services": by_service})
        currency = next((group.get("Metrics", {}).get("UnblendedCost", {}).get("Unit") for period in response.get("ResultsByTime", []) for group in period.get("Groups", []) if group.get("Metrics")), "USD")
        service_totals = sorted([{"name": name, "amount": amount, "unit": currency} for name, amount in totals.items()], key=lambda item: item["amount"], reverse=True)
        return {"available": True, "readAt": _read_at(), "period": {"start": start.isoformat(), "endExclusive": end.isoformat()}, "granularity": "daily", "currency": currency, "attribution": "Compte AWS · groupé par service, attribution InvestorOS non garantie", "total": sum(totals.values()), "services": service_totals, "daily": daily}
    except (BotoCoreError, ClientError) as error:
        return {"available": False, "readAt": _read_at(), "period": {"start": start.isoformat(), "endExclusive": end.isoformat()}, "message": "Cost Explorer n’est pas accessible ou n’a pas encore publié les coûts de cette période.", "error": _safe_error("Cost Explorer", error)}


@router.get("/quotas")
def admin_quotas(_: None = __import__("fastapi").Depends(require_admin)) -> dict[str, Any]:
    quotas: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    try:
        values = _paginate(_client("service-quotas"), "list_service_quotas", "Quotas", ServiceCode="bedrock")
        for item in values:
            name = item.get("QuotaName", "")
            if not any(term in name.lower() for term in ("token", "request", "concurrent", "invocation")):
                continue
            quotas.append({"name": name, "value": item.get("Value"), "unit": item.get("Unit"), "adjustable": item.get("Adjustable", False), "global": item.get("GlobalQuota", False), "period": item.get("QuotaPeriod")})
    except (BotoCoreError, ClientError) as error:
        errors.append(_safe_error("Service Quotas", error))
    return {"available": not errors, "readAt": _read_at(), "region": _region(), "service": "Amazon Bedrock", "quotas": quotas, "errors": errors}


@router.get("/security")
def admin_security(_: None = __import__("fastapi").Depends(require_admin)) -> dict[str, Any]:
    apis = []
    errors: list[dict[str, str]] = []
    try:
        for api in [item for item in _paginate(_client("apigatewayv2"), "get_apis", "Items") if "investoros" in item.get("Name", "").lower()]:
            routes = _paginate(_client("apigatewayv2"), "get_routes", "Items", ApiId=api["ApiId"])
            apis.append({"name": api.get("Name"), "endpoint": api.get("ApiEndpoint"), "gatewayAuthentication": {"protected": all(route.get("AuthorizationType") not in (None, "NONE") for route in routes), "unprotectedRoutes": sum(route.get("AuthorizationType") in (None, "NONE") for route in routes), "totalRoutes": len(routes)}, "corsOrigins": api.get("CorsConfiguration", {}).get("AllowOrigins", [])})
    except (BotoCoreError, ClientError) as error:
        errors.append(_safe_error("API Gateway", error))
    token_configured = bool(os.getenv("INVESTOROS_ADMIN_TOKEN") or os.getenv("ADMIN_CONSOLE_TOKEN_SECRET_ARN") or os.getenv("RESEARCH_ADMIN_TOKEN_SECRET_ARN"))
    return {
        "readAt": _read_at(),
        "adminConsole": {"tokenConfigured": token_configured, "tokenValuesExposed": False, "browserStorage": "mémoire de la page seulement", "apiGate": "Jeton vérifié côté serveur avec comparaison constante"},
        "apis": apis,
        "notes": [
            "Le jeton Admin n’est jamais retourné par l’API ni conservé dans le stockage du navigateur.",
            "Les routes de démonstration existantes peuvent rester publiques; les routes /v1/admin exigent le jeton côté serveur.",
            "Les identifiants AWS restent dans le rôle du backend et ne sont pas transmis au navigateur.",
        ],
        "errors": errors,
    }

