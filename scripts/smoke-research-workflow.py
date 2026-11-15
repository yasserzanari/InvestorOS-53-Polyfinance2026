#!/usr/bin/env python3
"""Start one real bounded research run and verify its persisted result."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urljoin
from urllib.request import Request, urlopen


def request_json(base_url: str, token: str, path: str, *, method: str = "GET", body: dict | None = None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = Request(
        urljoin(base_url.rstrip("/") + "/", path.lstrip("/")),
        data=data,
        method=method,
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
            **({"Content-Type": "application/json"} if data is not None else {}),
        },
    )
    try:
        with urlopen(request, timeout=35) as response:
            return json.loads(response.read())
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:600]
        raise RuntimeError(f"API HTTP {error.code}: {detail}") from error
    except URLError as error:
        raise RuntimeError(f"API inaccessible: {error.reason}") from error


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", default=os.getenv("RESEARCH_SMOKE_API_URL"))
    parser.add_argument("--persona", default=os.getenv("RESEARCH_SMOKE_PERSONA", "mateo"), choices=("amira", "mateo", "robert"))
    parser.add_argument("--timeout-seconds", type=int, default=900)
    parser.add_argument("--poll-seconds", type=float, default=5)
    args = parser.parse_args()

    token = os.getenv("RESEARCH_SMOKE_BEARER_TOKEN", "")
    if not args.api_url or not token:
        print("Définissez RESEARCH_SMOKE_API_URL et RESEARCH_SMOKE_BEARER_TOKEN.", file=sys.stderr)
        return 2

    print("Une nouvelle recherche réelle sera lancée; elle consomme le quota quotidien et peut entraîner des frais Bedrock.")
    try:
        started = request_json(
            args.api_url,
            token,
            "/v1/research/analyses",
            method="POST",
            body={
                "persona": args.persona,
                "question": "Quels mouvements historiques de NVDA sont visibles dans le jeu du datathon?",
                "source_ids": ["alphaforge-starter"],
            },
        )
        analysis_id = started["analysis_id"]
        encoded_id = quote(analysis_id, safe="")
        query = urlencode({"persona": args.persona})
        deadline = time.monotonic() + args.timeout_seconds
        while True:
            analysis = request_json(args.api_url, token, f"/v1/research/analyses/{encoded_id}?{query}")
            events = request_json(args.api_url, token, f"/v1/research/analyses/{encoded_id}/events?{query}").get("events", [])
            evidence = request_json(args.api_url, token, f"/v1/research/analyses/{encoded_id}/evidence?{query}").get("evidence", [])
            status = analysis.get("status")
            if status in {"complete", "partial", "failed", "cancelled"}:
                break
            if time.monotonic() >= deadline:
                raise RuntimeError(f"Délai dépassé; analyse {analysis_id} encore au statut {status!r}.")
            time.sleep(max(args.poll_seconds, 0.5))

        completed_event = any(event.get("type") == "analysis_completed" for event in events)
        result_present = isinstance(analysis.get("result"), dict)
        if status not in {"complete", "partial"} or not completed_event or not result_present or not evidence:
            print(
                json.dumps({
                    "analysis_id": analysis_id,
                    "status": status,
                    "completed_event": completed_event,
                    "result_present": result_present,
                    "evidence_count": len(evidence),
                }, ensure_ascii=False),
                file=sys.stderr,
            )
            return 1

        print(json.dumps({
            "analysis_id": analysis_id,
            "status": status,
            "completed_event": completed_event,
            "result_present": result_present,
            "evidence_count": len(evidence),
            "event_count": len(events),
        }, ensure_ascii=False))
        return 0
    except (KeyError, RuntimeError, ValueError, json.JSONDecodeError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
