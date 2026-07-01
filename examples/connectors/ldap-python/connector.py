"""
Connecteur d'exemple Cartulaire — LDAP / Active Directory (Python + ldap3).

Lancer :
    pip install -r requirements.txt
    CARTULAIRE_CONNECTOR_SECRET=... LDAP_URL=ldaps://... \
    uvicorn connector:app --host 0.0.0.0 --port 8443
"""
import os
import sys

from ldap3 import Server, Connection, ALL, SUBTREE
from ldap3.core.exceptions import LDAPBindError

from cartulaire_connector import create_connector_app, CommandFailure, ERROR_CODES

AUDIENCE = os.environ.get("CARTULAIRE_CONNECTOR_AUDIENCE", "connector.ldap.main")
SECRET = os.environ.get("CARTULAIRE_CONNECTOR_SECRET")
LDAP_URL = os.environ.get("LDAP_URL", "ldaps://ldap.example.local:636")
BIND_DN = os.environ.get("LDAP_BIND_DN", "cn=cartulaire,ou=services,dc=example,dc=local")
BIND_PASSWORD = os.environ.get("LDAP_BIND_PASSWORD", "")
BASE_DN = os.environ.get("LDAP_BASE_DN", "dc=example,dc=local")
USER_FILTER = os.environ.get("LDAP_USER_FILTER", "(&(objectClass=person)(|(uid={identifier})(mail={identifier})))")

if not SECRET:
    print("CARTULAIRE_CONNECTOR_SECRET est requis.", file=sys.stderr)
    sys.exit(1)

server = Server(LDAP_URL, get_info=ALL)


def _service_conn() -> Connection:
    return Connection(server, BIND_DN, BIND_PASSWORD, auto_bind=True)


def _find_user(conn: Connection, identifier: str):
    conn.search(BASE_DN, USER_FILTER.format(identifier=identifier), search_scope=SUBTREE,
                attributes=["entryUUID", "cn", "mail"])
    return conn.entries[0] if conn.entries else None


def resolve(payload, _cmd):
    with _service_conn() as conn:
        user = _find_user(conn, payload["identifier"])
        if not user:
            raise CommandFailure(ERROR_CODES["IDENTITY_NOT_FOUND"], "no entry",
                                 "Identifiant ou mot de passe invalide.")
        return {"sub": str(user.entryUUID)}


def verify_password(payload, _cmd):
    with _service_conn() as conn:
        conn.search(BASE_DN, f"(entryUUID={payload['subject']})", search_scope=SUBTREE)
        if not conn.entries:
            raise CommandFailure(ERROR_CODES["INVALID_CREDENTIALS"], "no dn",
                                 "Identifiant ou mot de passe invalide.")
        dn = conn.entries[0].entry_dn
    # Un bind réussi avec le mot de passe fourni = credentials valides.
    try:
        Connection(server, dn, payload["password"], auto_bind=True).unbind()
        return {"valid": True, "mfaRequired": False}
    except LDAPBindError:
        raise CommandFailure(ERROR_CODES["INVALID_CREDENTIALS"], "bind failed",
                             "Identifiant ou mot de passe invalide.")


app = create_connector_app(
    name="ldap-python",
    audience=AUDIENCE,
    secret=SECRET,
    permissions=["identity.resolve", "auth.verifyPassword", "admin.health"],
    handlers={
        "identity.resolve": resolve,
        "auth.verifyPassword": verify_password,
        "admin.health": lambda p, c: {"status": "ok", "connector": "ldap-python"},
    },
)
