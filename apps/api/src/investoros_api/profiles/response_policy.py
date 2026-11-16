"""Bounded response checks, not a legal-compliance certification."""

import re
import unicodedata


def validate_response_policy(text: str, failed_write: bool = False):
    normalized = unicodedata.normalize("NFKD", text.casefold()).encode("ascii", "ignore").decode()
    for sentence in re.split(r"[.!?\n]", normalized):
        if re.search(r"\b(?:aucun|aucune|jamais|sans|pas)\b|n['’]", sentence):
            continue
        if re.search(
            r"\b(?:rendement|capital|profit)\b.{0,40}\bgaranti|\bconforme a toutes les lois|\b(?:certifie|approuve) par (?:lamf|l.amf|lautorite)",
            sentence,
        ):
            raise ValueError(
                "Ne promets aucune garantie financière ni certification juridique ou réglementaire. Explique les limites du prototype et les vérifications nécessaires."
            )
    if (
        failed_write
        and not re.search(r"\b(?:pas|impossible|echec|echoue)\b", normalized)
        and re.search(
            r"(?:profil|preference|objectif|situation).{0,35}(?:mis a jour|enregistre|modifie)|(?:enregistre|modifie).{0,35}(?:profil|preference|objectif|situation)",
            normalized,
        )
    ):
        raise ValueError(
            "La dernière écriture du profil a échoué. Ne prétends pas l’avoir enregistrée; explique la limite et demande la précision requise."
        )


def regulatory_profile_answer(message: str) -> str | None:
    normalized = (
        unicodedata.normalize("NFKD", message.casefold()).encode("ascii", "ignore").decode()
    )
    if (
        "amf" in normalized
        and re.search(r"certifi|approuv", normalized)
        and re.search(r"profil|prototype|demonstration", normalized)
    ):
        return (
            "La démonstration ne fournit ni certification AMF, ni garantie de capital ou de rendement. "
            "Ce questionnaire ne constitue pas une évaluation réglementaire de convenance. "
            "Pour une décision financière réelle, faites vérifier votre situation par un représentant autorisé."
        )
    return None
