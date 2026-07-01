"""Codes d'erreur normalisés et erreur métier (miroir de @cartulaire/connector-contracts)."""
from __future__ import annotations

# Codes d'erreur du contrat de commande (SPEC §13.3, §36).
ERROR_CODES = {
    "INVALID_CREDENTIALS": "INVALID_CREDENTIALS",
    "IDENTITY_NOT_FOUND": "IDENTITY_NOT_FOUND",
    "MFA_REQUIRED": "MFA_REQUIRED",
    "MFA_INVALID": "MFA_INVALID",
    "PERMISSION_DENIED": "PERMISSION_DENIED",
    "INVALID_SIGNATURE": "INVALID_SIGNATURE",
    "COMMAND_EXPIRED": "COMMAND_EXPIRED",
    "AUDIENCE_MISMATCH": "AUDIENCE_MISMATCH",
    "UNKNOWN_COMMAND": "UNKNOWN_COMMAND",
    "CONNECTOR_UNAVAILABLE": "CONNECTOR_UNAVAILABLE",
    "TIMEOUT": "TIMEOUT",
    "VALIDATION_ERROR": "VALIDATION_ERROR",
    "INTERNAL_ERROR": "INTERNAL_ERROR",
}


class CommandFailure(Exception):
    """
    Erreur métier levée par un handler pour renvoyer une réponse d'erreur
    normalisée (ex. INVALID_CREDENTIALS) sans exposer de détail technique.

    `message` va dans les logs internes ; `safe_message` est le seul texte
    autorisé à atteindre l'utilisateur final (SPEC §36).
    """

    def __init__(
        self,
        code: str,
        message: str,
        safe_message: str = "Une erreur est survenue.",
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.safe_message = safe_message
        self.retryable = retryable
