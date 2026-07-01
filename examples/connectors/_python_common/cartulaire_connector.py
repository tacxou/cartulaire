"""
SDK minimal Cartulaire pour connecteurs Python (SPEC §13, §26.2, §31.2).

Implémente le contrat de commande signé côté serveur, sans dépendance au SDK
Node : vérification de signature HMAC-SHA256, fraîcheur de l'horodatage, audience,
liste blanche de permissions, réponse normalisée. Copiez ce fichier dans votre
connecteur (il est volontairement autonome).

Canonique de signature (identique à @cartulaire/crypto) :
    timestamp . id . type . audience . body
"""
from __future__ import annotations

import hashlib
import hmac
import time
from datetime import datetime, timezone
from typing import Awaitable, Callable, Dict, Any

from fastapi import FastAPI, Request, Response
import json

# Codes d'erreur normalisés (miroir de @cartulaire/connector-contracts)
ERROR_CODES = {
    "INVALID_CREDENTIALS": "INVALID_CREDENTIALS",
    "IDENTITY_NOT_FOUND": "IDENTITY_NOT_FOUND",
    "PERMISSION_DENIED": "PERMISSION_DENIED",
    "INVALID_SIGNATURE": "INVALID_SIGNATURE",
    "COMMAND_EXPIRED": "COMMAND_EXPIRED",
    "AUDIENCE_MISMATCH": "AUDIENCE_MISMATCH",
    "UNKNOWN_COMMAND": "UNKNOWN_COMMAND",
    "VALIDATION_ERROR": "VALIDATION_ERROR",
    "INTERNAL_ERROR": "INTERNAL_ERROR",
}


class CommandFailure(Exception):
    """Erreur métier renvoyée en réponse normalisée sans détail technique."""

    def __init__(self, code: str, message: str, safe_message: str, retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.message = message
        self.safe_message = safe_message
        self.retryable = retryable


Handler = Callable[[Dict[str, Any], Dict[str, Any]], Any]


def _sign(body: str, timestamp: str, cmd_id: str, cmd_type: str, audience: str, secret: str) -> str:
    canonical = f"{timestamp}.{cmd_id}.{cmd_type}.{audience}.{body}"
    return hmac.new(secret.encode(), canonical.encode(), hashlib.sha256).hexdigest()


def _reply_success(cmd_id: str, result: Any) -> Dict[str, Any]:
    return {"id": cmd_id, "status": "success", "result": result, "error": None}


def _reply_error(cmd_id: str, code: str, message: str, safe: str = "Une erreur est survenue.", retryable: bool = False):
    return {
        "id": cmd_id,
        "status": "error",
        "result": None,
        "error": {"code": code, "message": message, "safeMessage": safe, "retryable": retryable},
    }


def create_connector_app(
    *,
    name: str,
    audience: str,
    secret: str,
    permissions: list[str],
    handlers: Dict[str, Handler],
    max_skew_ms: int = 5000,
) -> FastAPI:
    """Construit une application FastAPI exposant POST /commands et GET /health."""
    app = FastAPI()
    allowed = set(permissions)

    @app.get("/health")
    def health() -> Dict[str, str]:
        return {"status": "ok", "service": name}

    @app.post("/commands")
    async def commands(request: Request) -> Response:
        raw = (await request.body()).decode("utf-8")
        signature = request.headers.get("x-cartulaire-signature")
        timestamp = request.headers.get("x-cartulaire-timestamp")

        try:
            cmd = json.loads(raw)
        except json.JSONDecodeError:
            return _json(_reply_error("unknown", ERROR_CODES["VALIDATION_ERROR"], "invalid json"))

        cmd_id = cmd.get("id", "unknown")

        # 1) signature + horodatage
        if not signature or not timestamp:
            return _json(_reply_error(cmd_id, ERROR_CODES["INVALID_SIGNATURE"], "missing headers"))
        try:
            skew = abs(int(time.time() * 1000) - int(timestamp))
        except ValueError:
            return _json(_reply_error(cmd_id, ERROR_CODES["INVALID_SIGNATURE"], "bad timestamp"))
        if skew > max_skew_ms:
            return _json(_reply_error(cmd_id, ERROR_CODES["COMMAND_EXPIRED"], "timestamp expired"))
        expected = _sign(raw, timestamp, cmd_id, cmd.get("type", ""), cmd.get("audience", ""), secret)
        if not hmac.compare_digest(expected, signature):
            return _json(_reply_error(cmd_id, ERROR_CODES["INVALID_SIGNATURE"], "signature mismatch"))

        # 2) expiration enveloppe
        try:
            exp = datetime.fromisoformat(cmd["expiresAt"].replace("Z", "+00:00"))
            if exp <= datetime.now(timezone.utc):
                return _json(_reply_error(cmd_id, ERROR_CODES["COMMAND_EXPIRED"], "command expired"))
        except (KeyError, ValueError):
            return _json(_reply_error(cmd_id, ERROR_CODES["VALIDATION_ERROR"], "bad expiresAt"))

        # 3) audience + 4) liste blanche
        if cmd.get("audience") != audience:
            return _json(_reply_error(cmd_id, ERROR_CODES["AUDIENCE_MISMATCH"], "audience mismatch"))
        cmd_type = cmd.get("type", "")
        if cmd_type not in allowed:
            return _json(_reply_error(cmd_id, ERROR_CODES["PERMISSION_DENIED"], f"{cmd_type} not allowed"))
        handler = handlers.get(cmd_type)
        if handler is None:
            return _json(_reply_error(cmd_id, ERROR_CODES["UNKNOWN_COMMAND"], f"{cmd_type} not handled"))

        # 5) exécution
        try:
            result = handler(cmd.get("payload", {}), cmd)
            if hasattr(result, "__await__"):
                result = await result
            return _json(_reply_success(cmd_id, result))
        except CommandFailure as f:
            return _json(_reply_error(cmd_id, f.code, f.message, f.safe_message, f.retryable))
        except Exception as e:  # noqa: BLE001
            return _json(_reply_error(cmd_id, ERROR_CODES["INTERNAL_ERROR"], str(e)))

    return app


def _json(payload: Dict[str, Any]) -> Response:
    # On répond toujours 200 : le statut métier est porté par l'enveloppe.
    return Response(content=json.dumps(payload), media_type="application/json")
