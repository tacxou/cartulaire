/**
 * Cartulaire — client WebAuthn (§23, §24.3). JavaScript minimal, servi depuis
 * l'origine (CSP `script-src 'self'`), aucun CDN. Pilote la cérémonie navigateur
 * `navigator.credentials` ; la vérification cryptographique reste côté connecteur.
 */
;(function () {
  function b64urlToBuf(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/')
    const pad = s.length % 4 ? 4 - (s.length % 4) : 0
    s += '='.repeat(pad)
    const bin = atob(s)
    const buf = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
    return buf.buffer
  }
  function bufToB64url(buf) {
    const bytes = new Uint8Array(buf)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  function csrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]')
    return meta ? meta.getAttribute('content') : ''
  }

  /** Enrôle une nouvelle passkey (cérémonie d'attestation). */
  async function register() {
    const start = await fetch('/account/mfa/webauthn/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken() },
      body: '{}',
    }).then((r) => r.json())

    const pk = start.publicKey
    pk.challenge = b64urlToBuf(pk.challenge)
    pk.user.id = b64urlToBuf(pk.user.id)
    if (pk.excludeCredentials) pk.excludeCredentials.forEach((c) => (c.id = b64urlToBuf(c.id)))

    const cred = await navigator.credentials.create({ publicKey: pk })
    const response = {
      id: cred.id,
      rawId: bufToB64url(cred.rawId),
      type: cred.type,
      response: {
        clientDataJSON: bufToB64url(cred.response.clientDataJSON),
        attestationObject: bufToB64url(cred.response.attestationObject),
      },
    }
    const res = await fetch('/account/mfa/webauthn/finish', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken() },
      body: JSON.stringify({ challengeId: start.challengeId, response: response }),
    }).then((r) => r.json())

    if (res && res.registered) window.location.href = '/account'
    else window.alert("Échec de l'enrôlement de la passkey.")
  }

  /** Authentifie via une passkey (cérémonie d'assertion) puis soumet le formulaire. */
  async function authenticate(optionsEl, formEl) {
    const opts = JSON.parse(optionsEl.textContent)
    const pk = opts.publicKey
    pk.challenge = b64urlToBuf(pk.challenge)
    if (pk.allowCredentials) pk.allowCredentials.forEach((c) => (c.id = b64urlToBuf(c.id)))

    const assertion = await navigator.credentials.get({ publicKey: pk })
    const response = {
      id: assertion.id,
      rawId: bufToB64url(assertion.rawId),
      type: assertion.type,
      response: {
        clientDataJSON: bufToB64url(assertion.response.clientDataJSON),
        authenticatorData: bufToB64url(assertion.response.authenticatorData),
        signature: bufToB64url(assertion.response.signature),
        userHandle: assertion.response.userHandle ? bufToB64url(assertion.response.userHandle) : null,
      },
    }
    formEl.querySelector('input[name="response"]').value = JSON.stringify(response)
    formEl.submit()
  }

  window.CartulaireWebAuthn = { register: register, authenticate: authenticate }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-webauthn-register]')) {
      e.preventDefault()
      register().catch((err) => window.alert(err.message))
    }
    if (e.target.closest('[data-webauthn-authenticate]')) {
      e.preventDefault()
      authenticate(document.getElementById('wa-options'), document.getElementById('wa-form')).catch((err) =>
        window.alert(err.message),
      )
    }
  })
})()
