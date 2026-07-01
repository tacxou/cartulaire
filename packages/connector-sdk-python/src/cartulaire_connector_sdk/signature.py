"""
Signature des commandes — Mode 1 HTTP signé (SPEC §12.1, §26.2).

Canonique IDENTIQUE à `@cartulaire/crypto` (Node) :
    timestamp . id . type . audience . body
HMAC-SHA256, sortie hexadécimale. Vérification à temps constant.
"""
from __future__ import annotations

import hashlib
import hmac
import time
import uuid
from dataclasses import dataclass
from typing import Optional


def _canonical(body: str, timestamp: str, command_id: str, command_type: str, audience: str) -> str:
    return f"{timestamp}.{command_id}.{command_type}.{audience}.{body}"


def sign_command(
    *,
    body: str,
    timestamp: str,
    command_id: str,
    command_type: str,
    audience: str,
    secret: str,
) -> str:
    """Calcule la signature HMAC-SHA256 (hex) d'une commande."""
    canonical = _canonical(body, timestamp, command_id, command_type, audience)
    return hmac.new(secret.encode("utf-8"), canonical.encode("utf-8"), hashlib.sha256).hexdigest()


@dataclass(frozen=True)
class VerifyResult:
    valid: bool
    reason: Optional[str] = None  # signature_mismatch | timestamp_expired | timestamp_invalid


def verify_command_signature(
    *,
    body: str,
    timestamp: str,
    command_id: str,
    command_type: str,
    audience: str,
    signature: str,
    secret: str,
    max_skew_ms: int = 5000,
    now_ms: Optional[int] = None,
) -> VerifyResult:
    """
    Vérifie la signature ET la fraîcheur de l'horodatage. Le connecteur rejette
    toute commande dont la signature ou la fenêtre temporelle est invalide,
    avant exécution (SPEC §13.4, §26.2).
    """
    now = now_ms if now_ms is not None else int(time.time() * 1000)

    try:
        ts = int(timestamp)
    except (TypeError, ValueError):
        return VerifyResult(False, "timestamp_invalid")

    if abs(now - ts) > max_skew_ms:
        return VerifyResult(False, "timestamp_expired")

    expected = sign_command(
        body=body,
        timestamp=timestamp,
        command_id=command_id,
        command_type=command_type,
        audience=audience,
        secret=secret,
    )
    if not constant_time_equals(expected, signature):
        return VerifyResult(False, "signature_mismatch")

    return VerifyResult(True)


# Alias public conforme à la SPEC §31.2.
verify_cartulaire_signature = verify_command_signature


def constant_time_equals(a: str, b: str) -> bool:
    """Comparaison à temps constant de deux chaînes."""
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def generate_command_id() -> str:
    return f"cmd_{uuid.uuid4()}"


def generate_trace_id() -> str:
    return f"trace_{uuid.uuid4()}"
