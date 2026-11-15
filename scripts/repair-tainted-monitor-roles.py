"""Safely clear stale Terraform taint only for monitor roles that still exist."""

from __future__ import annotations

import json
import subprocess
import sys


TARGETS = {
    "aws_iam_role.portfolio_monitor": "investoros-dev-portfolio-monitor-execution",
    "aws_iam_role.portfolio_monitor_scheduler": "investoros-dev-portfolio-monitor-scheduler",
}


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=False, capture_output=True, text=True)


def tainted_targets(state: dict) -> set[str]:
    found = set()
    for resource in state.get("resources", []):
        address = f"{resource.get('type')}.{resource.get('name')}"
        if address not in TARGETS:
            continue
        if any(instance.get("status") == "tainted" for instance in resource.get("instances", [])):
            found.add(address)
    return found


def main() -> int:
    pulled = run(["terraform", "state", "pull"])
    if pulled.returncode:
        print("Impossible de lire l’état Terraform; aucune réparation effectuée.", file=sys.stderr)
        return pulled.returncode

    try:
        tainted = tainted_targets(json.loads(pulled.stdout))
    except (json.JSONDecodeError, TypeError):
        print("État Terraform illisible; aucune réparation effectuée.", file=sys.stderr)
        return 1

    repaired = []
    for address, role_name in TARGETS.items():
        if address not in tainted:
            continue
        exists = run(["aws", "iam", "get-role", "--role-name", role_name, "--output", "json"])
        if exists.returncode:
            print(f"{address} reste marqué tainted : le rôle AWS n’a pas pu être confirmé.")
            continue
        result = run(["terraform", "untaint", address])
        if result.returncode:
            print(f"Impossible de corriger l’état pour {address}; arrêt avant le plan Terraform.", file=sys.stderr)
            return result.returncode
        repaired.append(address)

    if repaired:
        print("État réparé pour les rôles existants : " + ", ".join(repaired))
    else:
        print("Aucun rôle de veille existant n’avait besoin d’une réparation d’état.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
