"""
Cœur du connecteur : valide, vérifie signature/audience/permissions puis dispatche.
Ne lève jamais — renvoie toujours une réponse normalisée (SPEC §13.2/§13.3).
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Mapping, Optional, Sequence

from .errors import ERROR_CODES, CommandFailure
from .signature import verify_command_signature

# Un handler reçoit (payload, context) et renvoie un résultat sérialisable.
Handler = Callable[[Dict[str, Any], "CommandContext"], Any]


@dataclass(frozen=True)
class CommandContext:
    id: str
    type: str
    trace_id: str
    issuer: str
    audience: str


@dataclass(frozen=True)
class CommandDefinition:
    type: str
    handler: Handler


def define_command(command_type: str, handler: Handler) -> CommandDefinition:
    """Déclare une commande gérée par le connecteur."""
    return CommandDefinition(type=command_type, handler=handler)


def reply_success(command_id: str, result: Any) -> Dict[str, Any]:
    return {"id": command_id, "status": "success", "result": result, "error": None}


def reply_error(
    command_id: str,
    code: str,
    message: str,
    safe_message: str = "Une erreur est survenue.",
    retryable: bool = False,
) -> Dict[str, Any]:
    return {
        "id": command_id,
        "status": "error",
        "result": None,
        "error": {
            "code": code,
            "message": message,
            "safeMessage": safe_message,
            "retryable": retryable,
        },
    }


_REQUIRED_FIELDS = ("id", "type", "issuedAt", "expiresAt", "issuer", "audience", "traceId")


def dispatch_command(
    raw_body: str,
    *,
    signature: Optional[str],
    timestamp: Optional[str],
    secret: str,
    audience: str,
    permissions: Sequence[str],
    handlers: Mapping[str, Handler],
    max_skew_ms: int = 5000,
    now_ms: Optional[int] = None,
) -> Dict[str, Any]:
    """Valide et exécute une commande signée ; renvoie l'enveloppe de réponse."""
    try:
        cmd = json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        return reply_error("unknown", ERROR_CODES["VALIDATION_ERROR"], "Corps JSON invalide")

    if not isinstance(cmd, dict) or any(f not in cmd for f in _REQUIRED_FIELDS):
        cmd_id = cmd.get("id", "unknown") if isinstance(cmd, dict) else "unknown"
        return reply_error(cmd_id, ERROR_CODES["VALIDATION_ERROR"], "Enveloppe invalide")

    cmd_id = str(cmd["id"])
    cmd_type = str(cmd["type"])

    # 1) Signature + fraîcheur de l'horodatage
    if not signature or not timestamp:
        return reply_error(cmd_id, ERROR_CODES["INVALID_SIGNATURE"], "En-têtes de signature manquants")

    sig = verify_command_signature(
        body=raw_body,
        timestamp=timestamp,
        command_id=cmd_id,
        command_type=cmd_type,
        audience=str(cmd["audience"]),
        signature=signature,
        secret=secret,
        max_skew_ms=max_skew_ms,
        now_ms=now_ms,
    )
    if not sig.valid:
        code = ERROR_CODES["COMMAND_EXPIRED"] if sig.reason == "timestamp_expired" else ERROR_CODES["INVALID_SIGNATURE"]
        return reply_error(cmd_id, code, f"Signature invalide: {sig.reason}")

    # 2) Expiration au niveau enveloppe (§13.4)
    try:
        exp = datetime.fromisoformat(str(cmd["expiresAt"]).replace("Z", "+00:00"))
        if exp <= datetime.now(timezone.utc):
            return reply_error(cmd_id, ERROR_CODES["COMMAND_EXPIRED"], "Commande expirée")
    except ValueError:
        return reply_error(cmd_id, ERROR_CODES["VALIDATION_ERROR"], "expiresAt invalide")

    # 3) Audience exacte (§13.4)
    if cmd["audience"] != audience:
        return reply_error(cmd_id, ERROR_CODES["AUDIENCE_MISMATCH"], f"Audience {cmd['audience']} ≠ {audience}")

    # 4) Liste blanche de permissions (§26.4)
    if cmd_type not in permissions:
        return reply_error(cmd_id, ERROR_CODES["PERMISSION_DENIED"], f"Commande {cmd_type} non autorisée")

    handler = handlers.get(cmd_type)
    if handler is None:
        return reply_error(cmd_id, ERROR_CODES["UNKNOWN_COMMAND"], f"Commande {cmd_type} non gérée")

    # 5) Exécution
    ctx = CommandContext(
        id=cmd_id,
        type=cmd_type,
        trace_id=str(cmd["traceId"]),
        issuer=str(cmd["issuer"]),
        audience=str(cmd["audience"]),
    )
    try:
        result = handler(cmd.get("payload", {}) or {}, ctx)
        return reply_success(cmd_id, result)
    except CommandFailure as f:
        return reply_error(cmd_id, f.code, f.message, f.safe_message, f.retryable)
    except Exception as e:  # noqa: BLE001
        return reply_error(cmd_id, ERROR_CODES["INTERNAL_ERROR"], str(e))
