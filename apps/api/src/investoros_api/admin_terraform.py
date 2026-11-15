"""Read-only Terraform source inventory used by the Admin architecture canvas."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

_BLOCK = re.compile(
    r'(?m)^(resource|module|data|output|variable)\s+"([^"]+)"'
    r'(?:\s+"([^"]+)")?\s*\{'
)
_RESOURCE_REF = re.compile(r"\b(aws_[a-z0-9_]+)\.([a-zA-Z0-9_-]+)\b")
_MODULE_REF = re.compile(r"\bmodule\.([a-zA-Z0-9_-]+)\b")
_DATA_REF = re.compile(r"\bdata\.(aws_[a-z0-9_]+)\.([a-zA-Z0-9_-]+)\b")


def _terraform_root() -> Path | None:
    candidates = [
        Path(__file__).resolve().parents[4] / "infrastructure" / "terraform",
        Path(__file__).resolve().parents[1] / "infrastructure" / "terraform",
    ]
    return next((path for path in candidates if path.is_dir()), None)


def _block_end(source: str, brace: int) -> int:
    depth = 0
    quoted = False
    escaped = False
    line_comment = False
    block_comment = False
    index = brace
    while index < len(source):
        char = source[index]
        following = source[index + 1] if index + 1 < len(source) else ""
        if line_comment:
            if char == "\n":
                line_comment = False
        elif block_comment:
            if char == "*" and following == "/":
                block_comment = False
                index += 1
        elif quoted:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                quoted = False
        elif char == '"':
            quoted = True
        elif char == "#" or (char == "/" and following == "/"):
            line_comment = True
            if char == "/":
                index += 1
        elif char == "/" and following == "*":
            block_comment = True
            index += 1
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return index + 1
        index += 1
    return len(source)


def _blocks(source: str, relative_path: str) -> list[dict[str, Any]]:
    parsed: list[dict[str, Any]] = []
    for match in _BLOCK.finditer(source):
        start = match.end() - 1
        end = _block_end(source, start)
        kind, first, second = match.groups()
        name = second or first
        parsed.append(
            {
                "kind": kind,
                "type": first if kind in {"resource", "data"} else None,
                "name": name,
                "body": source[start + 1 : end - 1],
                "path": relative_path,
            }
        )
    return parsed


def _service(resource_type: str | None, file_path: str) -> tuple[str, str, str]:
    value = resource_type or "terraform-module"
    lookup = {
        "apigatewayv2": ("API Gateway", "api-gateway", "entry"),
        "cloudfront": ("CloudFront", "cloudfront", "entry"),
        "s3": ("Amazon S3", "s3", "data"),
        "lambda": ("AWS Lambda", "lambda", "compute"),
        "states": ("Step Functions", "step-functions", "orchestration"),
        "dynamodb": ("DynamoDB", "dynamodb", "data"),
        "bedrock": ("Amazon Bedrock", "bedrock", "ai"),
        "cloudwatch": ("CloudWatch", "cloudwatch", "operations"),
        "secretsmanager": ("Secrets Manager", "secrets-manager", "security"),
        "iam": ("AWS IAM", "iam", "security"),
        "ecs": ("Amazon ECS", "ecs", "compute"),
        "elbv2": ("Elastic Load Balancing", "load-balancing", "network"),
        "vpc": ("Amazon VPC", "vpc", "network"),
    }
    for prefix, service in lookup.items():
        if prefix in value:
            return service
    if "/modules/" in file_path:
        module = file_path.split("/modules/", 1)[1].split("/", 1)[0]
        title = module.replace("-", " ").title()
        return title, "terraform", "compute"
    return "Terraform", "terraform", "compute"


def terraform_architecture() -> dict[str, Any]:
    """Parse project Terraform declarations and references without running Terraform."""
    root = _terraform_root()
    if root is None:
        return {
            "source": "terraform-source",
            "available": False,
            "message": "Les fichiers Terraform ne sont pas inclus dans ce paquet.",
            "readAt": None,
            "nodes": [],
            "edges": [],
        }

    blocks: list[dict[str, Any]] = []
    for path in sorted(root.rglob("*.tf")):
        if ".terraform" in path.parts:
            continue
        relative = path.relative_to(root).as_posix()
        try:
            blocks.extend(_blocks(path.read_text(encoding="utf-8"), relative))
        except OSError:
            continue

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, str]] = []
    block_ids: dict[tuple[str, str, str | None], str] = {}
    module_children: dict[str, list[str]] = {}

    for block in blocks:
        kind, block_type, name, path = (
            block["kind"],
            block["type"],
            block["name"],
            block["path"],
        )
        if kind in {"output", "variable"}:
            continue
        if kind == "resource":
            node_id = f"terraform:resource:{block_type}.{name}"
            service, icon, layer = _service(block_type, path)
            label = f"{block_type}.{name}"
        elif kind == "data":
            node_id = f"terraform:data:{block_type}.{name}"
            service, icon, layer = _service(block_type, path)
            label = f"data.{block_type}.{name}"
        else:
            node_id = f"terraform:module:{name}"
            source_match = re.search(r'(?m)^\s*source\s*=\s*"([^"]+)"', block["body"])
            module_source = source_match.group(1) if source_match else ""
            service, icon, layer = _service(None, module_source)
            label = name.replace("-", " ").title()
            block["source"] = module_source

        path_parts = path.split("/")
        parent_module = path_parts[path_parts.index("modules") + 1] if "modules" in path_parts and path_parts.index("modules") + 1 < len(path_parts) else None
        node = {
            "id": node_id,
            "label": label,
            "service": service,
            "icon": icon,
            "layer": layer,
            "kind": kind,
            "status": "Déclaré",
            "source": "terraform",
            "file": path,
            "resourceType": block_type or "module",
            "module": parent_module,
            "detail": block.get("source", path),
        }
        nodes.append(node)
        block_ids[(kind, name, block_type)] = node_id
        if parent_module:
            module_children.setdefault(parent_module, []).append(node_id)

    node_id_set = {node["id"] for node in nodes}
    ref_lookup = {(node["resourceType"], node["label"].split(".", 1)[-1]): node["id"] for node in nodes if node["kind"] == "resource"}
    data_lookup = {(node["resourceType"], node["label"].split(".", 1)[-1]): node["id"] for node in nodes if node["kind"] == "data"}
    module_lookup = {node["label"].lower().replace(" ", "-"): node["id"] for node in nodes if node["kind"] == "module"}

    for block in blocks:
        kind, block_type, name = block["kind"], block["type"], block["name"]
        if kind not in {"resource", "data", "module"}:
            continue
        target_id = block_ids.get((kind, name, block_type))
        if not target_id:
            continue
        body = block["body"]
        references: list[tuple[str, str]] = []
        for ref_type, ref_name in _RESOURCE_REF.findall(body):
            source_id = ref_lookup.get((ref_type, ref_name))
            if source_id:
                references.append((source_id, "référence Terraform"))
        for ref_type, ref_name in _DATA_REF.findall(body):
            source_id = data_lookup.get((ref_type, ref_name))
            if source_id:
                references.append((source_id, "donnée Terraform"))
        for ref_name in _MODULE_REF.findall(body):
            source_id = module_lookup.get(ref_name)
            if source_id and source_id != target_id:
                references.append((source_id, "sortie de module"))
        for source_id, label in references:
            if source_id in node_id_set and source_id != target_id:
                edges.append({"id": f"{source_id}->{target_id}", "source": source_id, "target": target_id, "label": label})

    # A module's source directory owns its internal resources; keep that relationship visible.
    for module_name, children in module_children.items():
        parent_id = module_lookup.get(module_name)
        if not parent_id:
            continue
        for child_id in children:
            edges.append({"id": f"{parent_id}->{child_id}", "source": parent_id, "target": child_id, "label": "contient"})

    # The root environment is a useful anchor for module-level declarations.
    environment_node = {
        "id": "terraform:environment:dev",
        "label": "Environnement Terraform",
        "service": "us-east-1 · dev",
        "icon": "terraform",
        "layer": "entry",
        "kind": "environment",
        "status": "Déclaré",
        "source": "terraform",
        "file": "environments/dev/main.tf",
        "resourceType": "root module",
        "module": None,
        "detail": "Root module environments/dev",
    }
    nodes.insert(0, environment_node)
    for block in blocks:
        if block["kind"] != "module" or not block["path"].startswith("environments/dev/"):
            continue
        module_id = block_ids.get(("module", block["name"], None))
        if module_id:
            edges.append({"id": f"terraform:environment:dev->{module_id}", "source": "terraform:environment:dev", "target": module_id, "label": "compose"})

    # Remove duplicate references discovered through both explicit and inferred paths.
    unique_edges = {edge["id"]: edge for edge in edges}
    return {
        "source": "terraform-source",
        "available": bool(nodes),
        "readAt": _read_time(),
        "nodes": nodes,
        "edges": list(unique_edges.values()),
        "fileCount": len({block["path"] for block in blocks}),
    }


def _read_time() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()
