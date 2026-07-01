from cartulaire_connector_sdk import sign_command, verify_command_signature, constant_time_equals


COMMON = dict(
    body='{"id":"cmd_1","type":"identity.resolve"}',
    timestamp="1782869509000",
    command_id="cmd_1",
    command_type="identity.resolve",
    audience="connector.mock",
    secret="shared-secret",
)


def test_sign_is_deterministic_and_hex():
    a = sign_command(**COMMON)
    b = sign_command(**COMMON)
    assert a == b
    assert len(a) == 64 and all(c in "0123456789abcdef" for c in a)


def test_verify_valid_within_skew():
    sig = sign_command(**COMMON)
    res = verify_command_signature(signature=sig, now_ms=1782869509000, **COMMON)
    assert res.valid and res.reason is None


def test_verify_rejects_tampered_signature():
    res = verify_command_signature(signature="deadbeef" * 8, now_ms=1782869509000, **COMMON)
    assert not res.valid and res.reason == "signature_mismatch"


def test_verify_rejects_expired_timestamp():
    sig = sign_command(**COMMON)
    # 10 s de dérive > max_skew_ms (5 s)
    res = verify_command_signature(signature=sig, now_ms=1782869519000, **COMMON)
    assert not res.valid and res.reason == "timestamp_expired"


def test_verify_rejects_invalid_timestamp():
    bad = {**COMMON, "timestamp": "not-a-number"}
    sig = sign_command(**COMMON)
    res = verify_command_signature(signature=sig, now_ms=1782869509000, **bad)
    assert not res.valid and res.reason == "timestamp_invalid"


def test_constant_time_equals():
    assert constant_time_equals("abc", "abc")
    assert not constant_time_equals("abc", "abd")
    assert not constant_time_equals("abc", "abcd")
