"""NDJSON fixture through the real tool handlers; model transport is simulated."""

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/api/src"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/api/tests"))
from test_profile_service import RuntimeStub, stream_tool
from investoros_api.profiles.models import ChatRequest
from investoros_api.profiles.service import run_chat

os.environ["BEDROCK_MODEL_ID"] = "test-model"
request = ChatRequest.model_validate(json.load(sys.stdin))
if "situation" in request.message:
    name = "update_profile_situation"
    args = {
        "incomeRange": "Stable, revenus fictifs",
        "liquidities": "6 mois de dépenses fictives",
        "financialAssets": "Fourchette fictive",
        "obligations": "Modérées",
        "personalContext": "Aucun renseignement personnel réel",
    }
elif "préférences" in request.message:
    name = "update_profile_controls"
    args = {
        "esg": "Exclusions",
        "favoured": "Technologie|Santé",
        "excluded": "Tabac",
        "complexity": "Moyenne",
        "learning": "Régulier",
        "available": "Modérée",
        "minimum": "Sous 30 jours",
        "experience-Actions": "Régulière",
        "years-Actions": "5–10 ans",
    }
else:
    current = json.loads(
        next(
            (tab.content for tab in request.tabs if tab.id == "profile-objectives"),
            "{}",
        )
    ).get("goals", [])
    identifier = next(
        (g["id"] for g in current if g.get("role") == "Principal"), "principal-test"
    )
    name = "update_profile_goals"
    args = {
        "goals": [
            {
                "id": identifier,
                "title": "Projet déclaré au chat",
                "description": "Croissance diversifiée fictive",
                "horizonYears": 12,
                "targetAmount": "50 000 $ fictifs",
                "role": "Principal",
            }
        ]
    }
for event in run_chat(request, RuntimeStub(stream_tool(name, args))):
    print(json.dumps(event, ensure_ascii=False))
