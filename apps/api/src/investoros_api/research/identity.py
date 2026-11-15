"""Record explicit authority-to-account links separately from factual truth."""

import json
import re
from datetime import datetime
from urllib.parse import urlsplit


_HANDLE = re.compile(r"[a-zA-Z0-9_]{1,15}")
_X_HOSTS = {"x.com", "www.x.com", "twitter.com", "www.twitter.com"}
_LIMITATIONS = [
    "Un lien publié par l'autorité établit une association de compte, pas la véracité des publications.",
    "La vérification ne s'étend ni aux comptes personnels des membres ni aux autres comptes de l'institution.",
    "Un nom affiché, une mention, un badge ou des abonnés ne constituent pas une preuve d'identité.",
]


def _public_url(value: str):
    if not isinstance(value, str) or not value or len(value) > 2000 or any(char.isspace() or ord(char) < 32 or ord(char) == 127 for char in value):
        raise ValueError("URL d'identité invalide.")
    try:
        parsed = urlsplit(value)
        valid = parsed.scheme == "https" and parsed.hostname and parsed.username is None and parsed.password is None and parsed.port is None
    except ValueError as error:
        raise ValueError("URL d'identité invalide.") from error
    if not valid:
        raise ValueError("L'identité nécessite une URL HTTPS sans identifiants ni port.")
    return parsed


def _canonical_handle(value: str) -> str:
    if not isinstance(value, str):
        raise ValueError("Handle X invalide.")
    handle = value.removeprefix("@").casefold()
    if not _HANDLE.fullmatch(handle):
        raise ValueError("Handle X invalide.")
    return handle


def _profile_url(value: str) -> str:
    parsed = _public_url(value)
    path = parsed.path.removesuffix("/")
    if parsed.hostname not in _X_HOSTS or not path.startswith("/") or not _HANDLE.fullmatch(path[1:]):
        raise ValueError("Le lien doit cibler un profil X précis.")
    return f"https://x.com/{path[1:].casefold()}"


def _captured_at(value: str) -> str:
    if not isinstance(value, str):
        raise ValueError("Horodatage de capture absent.")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("Horodatage de capture invalide.") from error
    if parsed.tzinfo is None:
        raise ValueError("L'horodatage de capture doit indiquer son fuseau.")
    return value


def identity_snapshot(source: dict, handle: str, browser_result: dict) -> dict:
    if not isinstance(source, dict) or not isinstance(browser_result, dict):
        raise ValueError("Source ou capture d'identité invalide.")
    requested = _canonical_handle(handle)
    profiles = source.get("identity_profiles")
    if not isinstance(profiles, dict):
        raise ValueError("La source ne définit aucun compte autorisé.")
    authorized = {}
    for candidate, label in profiles.items():
        if not isinstance(candidate, str) or not _HANDLE.fullmatch(candidate) or not isinstance(label, str) or not label.strip():
            raise ValueError("Registre des comptes autorisés invalide.")
        authorized[candidate.casefold()] = label.strip()
    if requested not in authorized:
        raise ValueError("Ce compte n'est pas autorisé pour cette source d'identité.")
    authority = _public_url(source.get("url"))
    actual = _public_url(browser_result.get("url"))
    if authority.hostname != source.get("domain") or actual.hostname != source.get("domain"):
        raise ValueError("La capture est hors du domaine de l'autorité autorisée.")
    if (authority.path.rstrip("/") or "/") != (actual.path.rstrip("/") or "/"):
        raise ValueError("La capture ne correspond pas à la page d'autorité demandée.")
    links = browser_result.get("links")
    if not isinstance(links, list):
        raise ValueError("Les liens effectivement capturés sont absents.")
    publisher = source.get("publisher")
    if not isinstance(publisher, str) or not publisher.strip():
        raise ValueError("L'éditeur de l'autorité est absent.")
    profile_url = f"https://x.com/{requested}"
    linked = False
    for link in links:
        try:
            linked = _profile_url(link) == profile_url
        except ValueError:
            continue
        if linked:
            break
    historical = source.get("identity_historical", False)
    if not isinstance(historical, bool):
        raise ValueError("Le caractère historique de la source doit être explicite.")
    status = "historical_crosslink" if linked and historical else "linked_by_authority" if linked else "not_linked"
    limitations = list(_LIMITATIONS)
    if historical:
        limitations.append("La page est une archive historique; son lien ne démontre pas la gestion actuelle du compte.")
    if not linked:
        limitations.append("Aucun lien de profil correspondant n'a été trouvé dans cette capture; cela ne prouve pas que le compte est une imitation.")
    return {"kind": "account_identity", "handle": requested, "profile_url": profile_url,
            "account_label": authorized[requested], "publisher": publisher.strip(),
            "authority_url": source["url"], "checked_at": _captured_at(browser_result.get("captured_at")),
            "identity_status": status, "identity_verified": status == "linked_by_authority",
            "limitations": limitations}


def identity_claims(evidence: dict) -> list[dict]:
    content = evidence.get("content")
    for _ in range(5):
        if isinstance(content, str):
            try:
                content = json.loads(content)
            except ValueError:
                return []
        elif isinstance(content, dict) and content.get("kind") != "account_identity" and "text" in content:
            content = content["text"]
        else:
            break
    if not isinstance(content, dict) or content.get("kind") != "account_identity" or not isinstance(evidence.get("evidence_id"), str):
        return []
    status = content.get("identity_status")
    if status not in {"linked_by_authority", "historical_crosslink", "not_linked"}:
        return []
    if content.get("identity_verified") is not (status == "linked_by_authority"):
        return []
    try:
        handle = _canonical_handle(content.get("handle"))
        if _profile_url(content.get("profile_url")) != f"https://x.com/{handle}":
            return []
        _public_url(content.get("authority_url"))
        _captured_at(content.get("checked_at"))
    except ValueError:
        return []
    label, publisher = content.get("account_label"), content.get("publisher")
    if not isinstance(label, str) or not label or not isinstance(publisher, str) or not publisher:
        return []
    if status == "linked_by_authority":
        text = f"Le compte @{handle} ({label}) est lié explicitement par {publisher}."
        confidence = "supported"
    elif status == "historical_crosslink":
        text = f"Le compte @{handle} ({label}) possède un lien historique publié par {publisher}; son identité actuelle reste à vérifier."
        confidence = "partial"
    else:
        text = f"Aucun lien explicite vers @{handle} ({label}) n'a été trouvé dans la capture de {publisher}; l'identité reste non vérifiée."
        confidence = "unverified"
    return [{"text": f"{text} Ce constat ne confirme pas la véracité des publications ni l'identité d'autres comptes.",
             "claim_type": "account_identity", "evidence_ids": [evidence["evidence_id"]],
             "confidence": confidence, "url": content["authority_url"]}]
