"""
Connecteur d'exemple Cartulaire — SQL (Python + SQLAlchemy Core + FastAPI).

Lancer :
    pip install -r requirements.txt
    CARTULAIRE_CONNECTOR_SECRET=... DATABASE_URL=postgresql+psycopg://… \
    uvicorn connector:app --host 0.0.0.0 --port 8443

Schéma attendu (à adapter) :
    users(id text pk, username text, email text, password_hash text)
    consents(subject text, client_id text, scopes text)   -- scopes = CSV/JSON
"""
import os
import sys

import bcrypt
from sqlalchemy import create_engine, text

from cartulaire_connector import create_connector_app, CommandFailure, ERROR_CODES

AUDIENCE = os.environ.get("CARTULAIRE_CONNECTOR_AUDIENCE", "connector.sql.main")
SECRET = os.environ.get("CARTULAIRE_CONNECTOR_SECRET")
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+psycopg://cartulaire@localhost:5432/cartulaire")

if not SECRET:
    print("CARTULAIRE_CONNECTOR_SECRET est requis.", file=sys.stderr)
    sys.exit(1)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)


def resolve(payload, _cmd):
    with engine.connect() as c:
        row = c.execute(
            text("SELECT id FROM users WHERE username = :i OR email = :i LIMIT 1"),
            {"i": payload["identifier"]},
        ).first()
    if not row:
        raise CommandFailure(ERROR_CODES["IDENTITY_NOT_FOUND"], "no user",
                             "Identifiant ou mot de passe invalide.")
    return {"sub": str(row[0])}


def verify_password(payload, _cmd):
    with engine.connect() as c:
        row = c.execute(text("SELECT password_hash FROM users WHERE id = :id"),
                        {"id": payload["subject"]}).first()
    ok = bool(row) and bcrypt.checkpw(payload["password"].encode(), row[0].encode())
    if not ok:
        raise CommandFailure(ERROR_CODES["INVALID_CREDENTIALS"], "bad password",
                             "Identifiant ou mot de passe invalide.")
    return {"valid": True, "mfaRequired": False}


def claims_map(payload, _cmd):
    with engine.connect() as c:
        row = c.execute(text("SELECT id, username, email FROM users WHERE id = :id"),
                        {"id": payload["subject"]}).mappings().first()
    if not row:
        raise CommandFailure(ERROR_CODES["IDENTITY_NOT_FOUND"], "no user", "Une erreur est survenue.")
    claims = {"sub": str(row["id"])}
    if "profile" in payload["scopes"]:
        claims["preferred_username"] = row["username"]
    if "email" in payload["scopes"]:
        claims["email"] = row["email"]
    return claims


def consent_get(payload, _cmd):
    with engine.connect() as c:
        row = c.execute(
            text("SELECT scopes FROM consents WHERE subject = :s AND client_id = :cid"),
            {"s": payload["subject"], "cid": payload["clientId"]},
        ).first()
    scopes = row[0].split(",") if row and row[0] else []
    return {"scopes": [s for s in scopes if s]}


def consent_save(payload, _cmd):
    scopes_csv = ",".join(payload["scopes"])
    with engine.begin() as c:
        c.execute(
            text(
                "INSERT INTO consents (subject, client_id, scopes) VALUES (:s, :cid, :sc) "
                "ON CONFLICT (subject, client_id) DO UPDATE SET scopes = :sc"
            ),
            {"s": payload["subject"], "cid": payload["clientId"], "sc": scopes_csv},
        )
    return {"saved": True}


app = create_connector_app(
    name="sql-python",
    audience=AUDIENCE,
    secret=SECRET,
    permissions=["identity.resolve", "auth.verifyPassword", "claims.map",
                 "consent.get", "consent.save", "admin.health"],
    handlers={
        "identity.resolve": resolve,
        "auth.verifyPassword": verify_password,
        "claims.map": claims_map,
        "consent.get": consent_get,
        "consent.save": consent_save,
        "admin.health": lambda p, c: {"status": "ok", "connector": "sql-python"},
    },
)
