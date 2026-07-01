"""
cartulaire-connector-sdk — SDK officiel Python pour écrire un connecteur Cartulaire.

API publique (SPEC §31.2) :
    create_connector_server, define_command, verify_cartulaire_signature,
    reply_success, reply_error
"""
from .errors import ERROR_CODES, CommandFailure
from .signature import (
    constant_time_equals,
    generate_command_id,
    generate_trace_id,
    sign_command,
    verify_cartulaire_signature,
    verify_command_signature,
)
from .dispatch import (
    CommandContext,
    CommandDefinition,
    define_command,
    dispatch_command,
    reply_error,
    reply_success,
)
from .server import ConnectorServer, create_connector_server

__version__ = "0.0.1"

__all__ = [
    "create_connector_server",
    "ConnectorServer",
    "define_command",
    "dispatch_command",
    "verify_cartulaire_signature",
    "verify_command_signature",
    "sign_command",
    "constant_time_equals",
    "generate_command_id",
    "generate_trace_id",
    "reply_success",
    "reply_error",
    "CommandFailure",
    "CommandContext",
    "CommandDefinition",
    "ERROR_CODES",
    "__version__",
]
