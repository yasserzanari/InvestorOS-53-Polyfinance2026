"""Print safe Terraform error headers without state values, URLs, ARNs, or IDs."""

from __future__ import annotations

import re
import sys
from pathlib import Path


def summarize(log: str) -> list[str]:
    headers = re.findall(r"(?m)^Error: ([^\r\n]+)", log)
    safe_headers = []
    for header in headers:
        cleaned = re.sub(r"https?://\S+", "<url>", header)
        cleaned = re.sub(r"arn:[^\s,]+", "<arn>", cleaned)
        cleaned = re.sub(r"\b\d{12}\b", "<account>", cleaned)
        cleaned = re.sub(r"\b[0-9a-fA-F]{24,}\b", "<id>", cleaned)
        cleaned = re.sub(r"RequestID:\s*[^,\s]+", "RequestID: <id>", cleaned)
        safe_headers.append(cleaned[:240])

    denied = sorted(set(re.findall(r"not authorized to perform:\s*([A-Za-z0-9:]+)", log)))
    if denied:
        safe_headers.append("Actions IAM refusées : " + ", ".join(denied))

    if not safe_headers:
        safe_headers.append("Aucun en-tête Terraform reconnu; détails du provider masqués.")
    return safe_headers


if __name__ == "__main__":
    for message in summarize(Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")):
        print(message)
