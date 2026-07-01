"""
Serveur connecteur minimal en bibliothèque standard (SPEC §31.2).

Expose `POST /commands` (protégé, signé) et `GET /health` (public). Zéro
dépendance : tout framework (FastAPI, Flask…) reste utilisable en réutilisant
`dispatch_command` directement.
"""
from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Dict, Sequence

from .dispatch import CommandDefinition, Handler, dispatch_command


class ConnectorServer:
    """Serveur connecteur configuré. Appelez `.run(host, port)` pour écouter."""

    def __init__(
        self,
        *,
        name: str,
        audience: str,
        secret: str,
        permissions: Sequence[str],
        commands: Sequence[CommandDefinition],
        max_skew_ms: int = 5000,
    ) -> None:
        self.name = name
        self.audience = audience
        self.secret = secret
        self.permissions = list(permissions)
        self.max_skew_ms = max_skew_ms
        self.handlers: Dict[str, Handler] = {c.type: c.handler for c in commands}

    def handle_raw(self, raw_body: str, signature=None, timestamp=None) -> dict:
        """Traite une requête brute (utile pour les tests, sans HTTP)."""
        return dispatch_command(
            raw_body,
            signature=signature,
            timestamp=timestamp,
            secret=self.secret,
            audience=self.audience,
            permissions=self.permissions,
            handlers=self.handlers,
            max_skew_ms=self.max_skew_ms,
        )

    def run(self, host: str = "0.0.0.0", port: int = 8443) -> None:
        server = ThreadingHTTPServer((host, port), _make_handler(self))
        print(f"[{self.name}] écoute http://{host}:{port} (audience={self.audience})")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            server.shutdown()


def create_connector_server(
    *,
    name: str,
    audience: str,
    secret: str,
    permissions: Sequence[str],
    commands: Sequence[CommandDefinition],
    max_skew_ms: int = 5000,
) -> ConnectorServer:
    """Crée un serveur connecteur (SPEC §31.2)."""
    return ConnectorServer(
        name=name,
        audience=audience,
        secret=secret,
        permissions=permissions,
        commands=commands,
        max_skew_ms=max_skew_ms,
    )


def _make_handler(connector: ConnectorServer):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):  # silence par défaut
            pass

        def _send_json(self, payload: dict, status: int = 200) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:  # noqa: N802
            if self.path == "/health":
                self._send_json({"status": "ok", "connector": connector.name})
            else:
                self._send_json({"error": "not_found"}, 404)

        def do_POST(self) -> None:  # noqa: N802
            if self.path != "/commands":
                self._send_json({"error": "not_found"}, 404)
                return
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length).decode("utf-8") if length else ""
            response = connector.handle_raw(
                raw,
                signature=self.headers.get("X-Cartulaire-Signature"),
                timestamp=self.headers.get("X-Cartulaire-Timestamp"),
            )
            # On répond toujours 200 : le statut métier est dans l'enveloppe.
            self._send_json(response)

    return Handler
