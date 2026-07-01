"""
Connecteur d'exemple Cartulaire — MongoDB (Python + pymongo + FastAPI).

Lancer :
    pip install -r requirements.txt
    CARTULAIRE_CONNECTOR_SECRET=... MONGODB_URI=mongodb://… \
    uvicorn connector:app --host 0.0.0.0 --port 8443
"""
import os
import sys

import bcrypt
from bson import ObjectId
from pymongo import MongoClient

from cartulaire_connector_sdk import (
    create_connector_server,
    define_command,
    CommandFailure,
    ERROR_CODES,
)

AUDIENCE = os.environ.get("CARTULAIRE_CONNECTOR_AUDIENCE", "connector.mongo.main")
SECRET = os.environ.get("CARTULAIRE_CONNECTOR_SECRET")
MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017/cartulaire")

if not SECRET:
    print("CARTULAIRE_CONNECTOR_SECRET est requis.", file=sys.stderr)
    sys.exit(1)

db = MongoClient(MONGODB_URI).get_default_database()


def _oid(v):
    try:
        return ObjectId(v)
    except Exception:  # noqa: BLE001
        return None


def resolve(payload, _cmd):
    user = db.users.find_one({"$or": [{"username": payload["identifier"]}, {"email": payload["identifier"]}]},
                             {"_id": 1})
    if not user:
        raise CommandFailure(ERROR_CODES["IDENTITY_NOT_FOUND"], "no user",
                             "Identifiant ou mot de passe invalide.")
    return {"sub": str(user["_id"])}


def verify_password(payload, _cmd):
    user = db.users.find_one({"_id": _oid(payload["subject"])}, {"passwordHash": 1})
    ok = bool(user) and bcrypt.checkpw(payload["password"].encode(), user["passwordHash"].encode())
    if not ok:
        raise CommandFailure(ERROR_CODES["INVALID_CREDENTIALS"], "bad password",
                             "Identifiant ou mot de passe invalide.")
    return {"valid": True, "mfaRequired": False}


def claims_map(payload, _cmd):
    user = db.users.find_one({"_id": _oid(payload["subject"])})
    if not user:
        raise CommandFailure(ERROR_CODES["IDENTITY_NOT_FOUND"], "no user", "Une erreur est survenue.")
    claims = {"sub": str(user["_id"])}
    if "profile" in payload["scopes"]:
        claims["name"] = (user.get("profile") or {}).get("name")
    if "email" in payload["scopes"]:
        claims["email"] = user.get("email")
    return claims


def consent_get(payload, _cmd):
    c = db.consents.find_one({"subject": payload["subject"], "clientId": payload["clientId"]})
    return {"scopes": (c or {}).get("scopes", [])}


def consent_save(payload, _cmd):
    db.consents.update_one(
        {"subject": payload["subject"], "clientId": payload["clientId"]},
        {"$set": {"scopes": payload["scopes"]}},
        upsert=True,
    )
    return {"saved": True}


server = create_connector_server(
    name="mongo-python",
    audience=AUDIENCE,
    secret=SECRET,
    permissions=["identity.resolve", "auth.verifyPassword", "claims.map",
                 "consent.get", "consent.save", "admin.health"],
    commands=[
        define_command("identity.resolve", resolve),
        define_command("auth.verifyPassword", verify_password),
        define_command("claims.map", claims_map),
        define_command("consent.get", consent_get),
        define_command("consent.save", consent_save),
        define_command("admin.health", lambda p, c: {"status": "ok", "connector": "mongo-python"}),
    ],
)

if __name__ == "__main__":
    server.run(port=int(os.environ.get("CARTULAIRE_CONNECTOR_PORT", 8443)))
