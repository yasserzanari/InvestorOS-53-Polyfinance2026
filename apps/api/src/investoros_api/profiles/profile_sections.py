"""Validated profile section tools shared by chat and durable memory."""

import json
import re
from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, create_model


class SituationPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    incomeRange: str = Field(default="", max_length=500)
    liquidities: str = Field(default="", max_length=500)
    financialAssets: str = Field(default="", max_length=500)
    obligations: str = Field(default="", max_length=500)
    personalContext: str = Field(default="", max_length=500)


class ProfileGoal(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=80, pattern=r"^[a-zA-Z0-9_-]+$")
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(max_length=1000)
    horizonYears: int | None = Field(default=None, ge=1, le=50, strict=True)
    horizonLabel: str = Field(default="", max_length=300)
    targetAmount: str = Field(default="", max_length=80)
    anchorYear: int = Field(
        default_factory=lambda: date.today().year, ge=2000, le=2200, strict=True
    )
    targetDate: date | None = None
    role: Literal["Principal", "Secondaire"]


class GoalsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    goals: list[ProfileGoal] = Field(default_factory=list, max_length=8)
    deleteIds: list[str] = Field(default_factory=list, max_length=8)


# Flat aliases match the controls already persisted by the frontend.
CONTROL_OPTIONS = {
    "horizon": None,
    "withdrawals": None,
    "income": None,
    "debt": None,
    "available": ("", "Faible", "Modérée", "Élevée", "À préciser"),
    "complexity": ("", "Faible", "Moyenne", "Élevée", "À préciser"),
    "learning": ("", "Aucun", "Ponctuel", "Régulier", "À préciser"),
    "minimum": ("", "Immédiate", "Sous 30 jours", "Sous 90 jours", "Sans contrainte", "À préciser"),
    "esg": ("", "Sans préférence", "Exclusions", "Best-in-class", "Impact", "À préciser"),
    "favoured": None,
    "excluded": None,
}
for product in [
    "Actions",
    "Obligations",
    "Fonds (OPC)",
    "ETF (trackers)",
    "Crypto-actifs",
    "Options",
]:
    CONTROL_OPTIONS[f"experience-{product}"] = ("", "Aucune", "Limitée", "Régulière", "À préciser")
    CONTROL_OPTIONS[f"years-{product}"] = (
        "",
        "Moins d’un an",
        "1–3 ans",
        "3–5 ans",
        "5–10 ans",
        "10 ans et plus",
        "À préciser",
    )
ControlsPatch = create_model(
    "ControlsPatch",
    __config__=ConfigDict(extra="forbid"),
    **{
        name: (
            Literal[options] if options else str,
            Field(default=None, max_length=1000) if not options else Field(default=None),
        )
        for name, options in CONTROL_OPTIONS.items()
    },
)


def document(tabs, identifier, default):
    tab = next((t for t in tabs if t["id"] == identifier), None)
    if not tab:
        return default
    try:
        value = json.loads(tab.get("content", ""))
        if not isinstance(value, dict):
            raise ValueError("Objet JSON attendu.")
        return value
    except (ValueError, TypeError):
        raise ValueError("Document de profil invalide : corrigez-le avant modification.")


def write_document(tabs, identifier, title, value):
    tab = {
        "id": identifier,
        "title": title,
        "kind": "profile",
        "content": json.dumps(value, ensure_ascii=False),
    }
    index = next((i for i, t in enumerate(tabs) if t["id"] == identifier), None)
    if index is None:
        if len(tabs) >= 12:
            raise ValueError(
                "Maximum de 12 onglets atteint; aucun document ne sera supprimé automatiquement."
            )
        tabs.append(tab)
    else:
        tabs[index] = tab


def validate_goals(goals):
    parsed = GoalsUpdate.model_validate({"goals": goals}).model_dump(mode="json")["goals"]
    if len({g["id"] for g in parsed}) != len(parsed):
        raise ValueError("Chaque objectif exige un identifiant unique.")
    if sum(g["role"] == "Principal" for g in parsed) > 1:
        raise ValueError("Un seul projet principal est autorisé.")
    return parsed


def apply_goals(profile, tabs, goals, account, delete_ids=()):
    incoming = validate_goals(goals)
    previous = document(tabs, "profile-objectives", {}).get("goals", [])
    if set(delete_ids) - {g["id"] for g in previous}:
        raise ValueError("Objectif à supprimer inconnu.")
    if set(delete_ids) & {g["id"] for g in incoming}:
        raise ValueError("Un objectif ne peut pas être modifié et supprimé ensemble.")
    merged = {g["id"]: g for g in previous if g["id"] not in delete_ids}
    merged.update({g["id"]: g for g in incoming})
    goals = validate_goals(list(merged.values()))
    write_document(
        tabs,
        "profile-objectives",
        "Objectifs du profil",
        {"schema": 1, "persona": account, "goals": goals},
    )
    primary = next((g for g in goals if g["role"] == "Principal"), None)
    if primary:
        profile.update(
            objective=primary["description"] or primary["title"],
            horizon=primary.get("horizonLabel")
            or (f"{primary['horizonYears']} ans" if primary.get("horizonYears") else "À préciser"),
        )
    else:
        profile.update(objective="", horizon="")


def sync_general(profile, tabs, fields):
    """Keep the declared primary goal consistent; never infer a numeric horizon from a range."""
    doc = document(tabs, "profile-objectives", None)
    if not doc:
        return
    primary = next((g for g in doc.get("goals", []) if g.get("role") == "Principal"), None)
    if not primary:
        return
    if "horizon" in fields:
        match = re.fullmatch(r"\s*(\d{1,2})\s*(?:ans?|années?)\s*", fields["horizon"], re.I)
        primary["horizonLabel"] = fields["horizon"]
        primary["horizonYears"] = int(match[1]) if match and 1 <= int(match[1]) <= 50 else None
        primary["targetDate"] = None
        primary["anchorYear"] = date.today().year
    if "objective" in fields:
        primary["description"] = fields["objective"]
    write_document(tabs, "profile-objectives", "Objectifs du profil", doc)


def apply_controls(profile, tabs, situation, changes):
    changes = ControlsPatch.model_validate(changes).model_dump(exclude_unset=True)
    controls = document(tabs, "profile-controls", {})
    next_controls = {**controls, **changes}
    # General fields and situation own these values; the aliases are compatibility inputs only.
    fields = {}
    for alias, field in [("horizon", "horizon"), ("withdrawals", "liquidity")]:
        if alias in changes:
            fields[field] = changes[alias]
        next_controls.pop(alias, None)
    sync_general(profile, tabs, fields)
    for alias, field in [("income", "incomeRange"), ("debt", "obligations")]:
        if alias in changes:
            situation[field] = changes[alias]
        next_controls.pop(alias, None)
    write_document(tabs, "profile-controls", "Détails du profil", next_controls)
    profile.update(fields)
    return changes


def snapshot(profile, tabs, situation):
    controls = document(tabs, "profile-controls", {})
    controls = {
        k: v for k, v in controls.items() if k not in {"horizon", "withdrawals", "income", "debt"}
    }
    goals = document(tabs, "profile-objectives", {}).get("goals", [])
    primary = next((g for g in goals if g.get("role") == "Principal"), None)
    conflicts = []
    if primary:
        if profile.get("objective") and profile["objective"] != (
            primary.get("description") or primary.get("title")
        ):
            conflicts.append(
                "L’objectif général et le projet principal diffèrent; demander quelle déclaration conserver."
            )
        expected = primary.get("horizonLabel") or (
            f"{primary['horizonYears']} ans" if primary.get("horizonYears") else "À préciser"
        )
        if profile.get("horizon") and profile["horizon"] != expected:
            conflicts.append(
                "L’horizon général et celui du principal diffèrent; clarifier sans inventer une date."
            )
    return {
        "profile": profile,
        "situation": situation,
        "goals": goals,
        "conflicts": conflicts,
        "controls": controls,
        "limitations": [
            "Déclarations de démonstration; aucune certification réglementaire ni recommandation."
        ],
    }
