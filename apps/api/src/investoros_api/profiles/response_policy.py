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
    if failed_write and re.search(
        r"(?:profil|preference|objectif|situation).{0,35}(?:mis a jour|enregistre|modifie)|(?:enregistre|modifie).{0,35}(?:profil|preference|objectif|situation)",
        normalized,
    ):
        raise ValueError(
            "La dernière écriture du profil a échoué. Ne prétends pas l’avoir enregistrée; explique la limite et demande la précision requise."
        )
