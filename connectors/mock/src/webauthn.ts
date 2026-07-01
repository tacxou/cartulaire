import { createHash, createPublicKey, randomBytes, randomUUID, verify as cryptoVerify } from 'node:crypto'

/**
 * WebAuthn / passkeys côté connecteur (SPEC §23). SANS dépendance externe :
 * vérification réelle des cérémonies FIDO2 (ES256/P-256, attestation `none`).
 *
 * C'est le connecteur qui possède les credentials et vérifie la signature ;
 * le cœur (Relying Party) fournit `rpId`/`origin` et pilote la cérémonie
 * navigateur. Un connecteur de production utiliserait `@simplewebauthn/server`.
 */

// ─── base64url ──────────────────────────────────────────────────────────────
const b64url = (b: Buffer): string => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s: string): Buffer => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
const sha256 = (b: Buffer): Buffer => createHash('sha256').update(b).digest()

// ─── décodeur CBOR minimal (sous-ensemble WebAuthn) ─────────────────────────
function cborDecode(buf: Buffer, offset = 0): [unknown, number] {
  const first = buf[offset++]
  const major = first >> 5
  const info = first & 0x1f
  let len = info
  if (info === 24) len = buf[offset++]
  else if (info === 25) {
    len = buf.readUInt16BE(offset)
    offset += 2
  } else if (info === 26) {
    len = buf.readUInt32BE(offset)
    offset += 4
  } else if (info === 27) {
    len = Number(buf.readBigUInt64BE(offset))
    offset += 8
  }

  switch (major) {
    case 0:
      return [len, offset]
    case 1:
      return [-1 - len, offset]
    case 2: {
      const bytes = buf.subarray(offset, offset + len)
      return [bytes, offset + len]
    }
    case 3: {
      const str = buf.toString('utf8', offset, offset + len)
      return [str, offset + len]
    }
    case 4: {
      const arr: unknown[] = []
      for (let i = 0; i < len; i++) {
        const [v, next] = cborDecode(buf, offset)
        arr.push(v)
        offset = next
      }
      return [arr, offset]
    }
    case 5: {
      const map = new Map<unknown, unknown>()
      for (let i = 0; i < len; i++) {
        const [k, n1] = cborDecode(buf, offset)
        const [v, n2] = cborDecode(buf, n1)
        map.set(k, v)
        offset = n2
      }
      return [map, offset]
    }
    default:
      throw new Error(`CBOR major type ${major} non supporté`)
  }
}

// ─── parsing authenticatorData (WebAuthn L2 §6.1) ───────────────────────────
interface ParsedAuthData {
  rpIdHash: Buffer
  flags: number
  signCount: number
  credentialId?: Buffer
  cosePublicKey?: Map<number, unknown>
}
function parseAuthData(authData: Buffer): ParsedAuthData {
  const rpIdHash = authData.subarray(0, 32)
  const flags = authData[32]
  const signCount = authData.readUInt32BE(33)
  const out: ParsedAuthData = { rpIdHash, flags, signCount }

  if (flags & 0x40) {
    // Attested credential data present (bit AT)
    const credIdLen = authData.readUInt16BE(53)
    out.credentialId = authData.subarray(55, 55 + credIdLen)
    const [cose] = cborDecode(authData, 55 + credIdLen)
    out.cosePublicKey = cose as Map<number, unknown>
  }
  return out
}

/** Reconstruit une clé publique EC P-256 depuis une clé COSE (x=-2, y=-3). */
function coseToPublicKey(cose: Map<number, unknown>) {
  const x = cose.get(-2) as Buffer
  const y = cose.get(-3) as Buffer
  return createPublicKey({
    key: { kty: 'EC', crv: 'P-256', x: b64url(x), y: b64url(y) },
    format: 'jwk',
  })
}

// ─── état en mémoire ────────────────────────────────────────────────────────
interface Credential {
  id: string // credentialId en b64url
  publicKeyX: Buffer
  publicKeyY: Buffer
  counter: number
}
const credentialsBySubject = new Map<string, Credential[]>()

interface WaChallenge {
  subject: string
  challenge: string // b64url
  rpId: string
  origin: string
  kind: 'create' | 'get'
}
const waChallenges = new Map<string, WaChallenge>()

// ─── API d'enrôlement (registration / attestation) ──────────────────────────
export function webauthnRegisterOptions(subject: string, rpId: string, origin: string, userName: string) {
  const challenge = b64url(randomBytes(32))
  const challengeId = `wa_${randomUUID()}`
  waChallenges.set(challengeId, { subject, challenge, rpId, origin, kind: 'create' })
  return {
    challengeId,
    type: 'webauthn' as const,
    hint: 'Utilisez votre clé de sécurité ou votre appareil.',
    data: {
      publicKey: {
        challenge,
        rp: { id: rpId, name: 'Cartulaire' },
        user: { id: b64url(Buffer.from(subject)), name: userName, displayName: userName },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }], // ES256
        timeout: 60000,
        attestation: 'none',
        authenticatorSelection: { userVerification: 'preferred', residentKey: 'preferred' },
      },
    },
  }
}

export function webauthnRegisterVerify(
  subject: string,
  challengeId: string,
  response: Record<string, unknown>,
): { registered: boolean; methodId?: string } {
  const ch = waChallenges.get(challengeId)
  if (!ch || ch.subject !== subject || ch.kind !== 'create') return { registered: false }
  waChallenges.delete(challengeId)

  const inner = (response.response ?? {}) as Record<string, string>
  const clientData = JSON.parse(fromB64url(inner.clientDataJSON).toString('utf8'))
  if (clientData.type !== 'webauthn.create') return { registered: false }
  if (clientData.challenge !== ch.challenge) return { registered: false }
  if (clientData.origin !== ch.origin) return { registered: false }

  const [attObj] = cborDecode(fromB64url(inner.attestationObject)) as [Map<string, unknown>, number]
  const authData = attObj.get('authData') as Buffer
  const parsed = parseAuthData(authData)
  if (!parsed.credentialId || !parsed.cosePublicKey) return { registered: false }
  if (!(parsed.flags & 0x01)) return { registered: false } // User Present requis
  if (Buffer.compare(parsed.rpIdHash, sha256(Buffer.from(ch.rpId))) !== 0) return { registered: false }

  const cred: Credential = {
    id: b64url(parsed.credentialId),
    publicKeyX: parsed.cosePublicKey.get(-2) as Buffer,
    publicKeyY: parsed.cosePublicKey.get(-3) as Buffer,
    counter: parsed.signCount,
  }
  const list = credentialsBySubject.get(subject) ?? []
  list.push(cred)
  credentialsBySubject.set(subject, list)
  return { registered: true, methodId: `webauthn-${cred.id.slice(0, 8)}` }
}

// ─── API d'authentification (assertion) ─────────────────────────────────────
export function webauthnAuthOptions(subject: string, rpId: string, origin: string) {
  const challenge = b64url(randomBytes(32))
  const challengeId = `wa_${randomUUID()}`
  waChallenges.set(challengeId, { subject, challenge, rpId, origin, kind: 'get' })
  const creds = credentialsBySubject.get(subject) ?? []
  return {
    challengeId,
    type: 'webauthn' as const,
    hint: 'Utilisez votre clé de sécurité ou votre appareil.',
    data: {
      publicKey: {
        challenge,
        rpId,
        allowCredentials: creds.map((c) => ({ type: 'public-key', id: c.id })),
        timeout: 60000,
        userVerification: 'preferred',
      },
    },
  }
}

export function webauthnAuthVerify(
  subject: string,
  challengeId: string,
  response: Record<string, unknown>,
): boolean {
  const ch = waChallenges.get(challengeId)
  if (!ch || ch.subject !== subject || ch.kind !== 'get') return false
  waChallenges.delete(challengeId)

  const cred = (credentialsBySubject.get(subject) ?? []).find((c) => c.id === response.id)
  if (!cred) return false

  const inner = (response.response ?? {}) as Record<string, string>
  const clientDataRaw = fromB64url(inner.clientDataJSON)
  const clientData = JSON.parse(clientDataRaw.toString('utf8'))
  if (clientData.type !== 'webauthn.get') return false
  if (clientData.challenge !== ch.challenge) return false
  if (clientData.origin !== ch.origin) return false

  const authData = fromB64url(inner.authenticatorData)
  const parsed = parseAuthData(authData)
  if (!(parsed.flags & 0x01)) return false // User Present
  if (Buffer.compare(parsed.rpIdHash, sha256(Buffer.from(ch.rpId))) !== 0) return false
  // Anti-clonage : le compteur doit progresser (sauf si l'authenticateur ne le gère pas → 0).
  if (parsed.signCount !== 0 && parsed.signCount <= cred.counter) return false

  const signedData = Buffer.concat([authData, sha256(clientDataRaw)])
  const key = createPublicKey({
    key: { kty: 'EC', crv: 'P-256', x: b64url(cred.publicKeyX), y: b64url(cred.publicKeyY) },
    format: 'jwk',
  })
  const ok = cryptoVerify('sha256', signedData, key, fromB64url(inner.signature))
  if (ok) cred.counter = parsed.signCount
  return ok
}

/** Le sujet a-t-il au moins un passkey enrôlé ? (pour getMfaMethods) */
export function webauthnCredentialCount(subject: string): number {
  return (credentialsBySubject.get(subject) ?? []).length
}

/** Liste les passkeys enrôlés en tant que méthodes MFA. */
export function webauthnListMethods(subject: string): Array<{ id: string; type: 'webauthn'; label: string }> {
  return (credentialsBySubject.get(subject) ?? []).map((c) => ({
    id: `webauthn-${c.id.slice(0, 8)}`,
    type: 'webauthn' as const,
    label: 'Clé de sécurité / passkey',
  }))
}

export function webauthnDisable(subject: string, methodId: string): boolean {
  const list = credentialsBySubject.get(subject) ?? []
  const idx = list.findIndex((c) => `webauthn-${c.id.slice(0, 8)}` === methodId)
  if (idx < 0) return false
  list.splice(idx, 1)
  return true
}
