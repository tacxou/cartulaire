import json
import time

from cartulaire_connector_sdk import (
    CommandFailure,
    ERROR_CODES,
    define_command,
    dispatch_command,
    sign_command,
)

SECRET = "shared-secret"
AUDIENCE = "connector.mock"


def build_signed(cmd_type, payload, *, audience=AUDIENCE, ttl_ms=5000, now_ms=None):
    now = now_ms if now_ms is not None else int(time.time() * 1000)
    cmd = {
        "id": "cmd_test",
        "type": cmd_type,
        "issuedAt": _iso(now),
        "expiresAt": _iso(now + ttl_ms),
        "issuer": "cartulaire",
        "audience": audience,
        "traceId": "trace_test",
        "payload": payload,
    }
    body = json.dumps(cmd)
    ts = str(now)
    sig = sign_command(
        body=body, timestamp=ts, command_id=cmd["id"], command_type=cmd_type, audience=audience, secret=SECRET
    )
    return body, sig, ts


def _iso(ms):
    from datetime import datetime, timezone

    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")


HANDLERS = {
    "identity.resolve": define_command("identity.resolve", lambda p, c: {"sub": "user_" + p["identifier"]}).handler,
    "auth.verifyPassword": define_command(
        "auth.verifyPassword",
        lambda p, c: (_ for _ in ()).throw(
            CommandFailure(ERROR_CODES["INVALID_CREDENTIALS"], "bad", "Identifiant ou mot de passe invalide.")
        ),
    ).handler,
}
PERMISSIONS = ["identity.resolve", "auth.verifyPassword"]


def _dispatch(body, sig, ts, **over):
    kwargs = dict(secret=SECRET, audience=AUDIENCE, permissions=PERMISSIONS, handlers=HANDLERS)
    kwargs.update(over)
    return dispatch_command(body, signature=sig, timestamp=ts, **kwargs)


def test_success():
    body, sig, ts = build_signed("identity.resolve", {"identifier": "clement"})
    res = _dispatch(body, sig, ts)
    assert res["status"] == "success" and res["result"] == {"sub": "user_clement"}


def test_command_failure_maps_to_error():
    body, sig, ts = build_signed("auth.verifyPassword", {"subject": "x", "password": "y"})
    res = _dispatch(body, sig, ts)
    assert res["status"] == "error" and res["error"]["code"] == ERROR_CODES["INVALID_CREDENTIALS"]
    assert res["error"]["safeMessage"] == "Identifiant ou mot de passe invalide."


def test_bad_signature():
    body, _sig, ts = build_signed("identity.resolve", {"identifier": "clement"})
    res = _dispatch(body, "00" * 32, ts)
    assert res["status"] == "error" and res["error"]["code"] == ERROR_CODES["INVALID_SIGNATURE"]


def test_audience_mismatch():
    body, sig, ts = build_signed("identity.resolve", {"identifier": "c"}, audience="connector.other")
    res = _dispatch(body, sig, ts)
    assert res["error"]["code"] == ERROR_CODES["AUDIENCE_MISMATCH"]


def test_permission_denied():
    body, sig, ts = build_signed("consent.save", {"subject": "s"})
    res = _dispatch(body, sig, ts)
    assert res["error"]["code"] == ERROR_CODES["PERMISSION_DENIED"]


def test_expired_command():
    now = int(time.time() * 1000)
    body, sig, ts = build_signed("identity.resolve", {"identifier": "c"}, ttl_ms=-1000, now_ms=now)
    # timestamp frais, mais expiresAt dans le passé → COMMAND_EXPIRED
    res = _dispatch(body, sig, ts, now_ms=now)
    assert res["error"]["code"] == ERROR_CODES["COMMAND_EXPIRED"]
