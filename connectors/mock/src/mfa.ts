import { createHmac, randomInt, randomUUID } from 'node:crypto'

/**
 * MFA côté connecteur (démo). C'est ICI que vit tout le savoir d'un facteur :
 * secret TOTP, envoi d'OTP, codes de secours… Le cœur ne connaît rien de tout ça
 * (SPEC §10.2, §23). Un connecteur réel remplacerait ce module.
 */

export type MfaMethodType = 'totp' | 'email_otp' | 'sms_otp' | 'magic_link' | 'webauthn' | 'recovery'

interface BaseMethod {
  id: string
  type: MfaMethodType
  label: string
}
interface TotpMethod extends BaseMethod {
  type: 'totp'
  secret: Buffer
}
interface OtpMethod extends BaseMethod {
  type: 'email_otp' | 'sms_otp'
  to: string
}
interface RecoveryMethod extends BaseMethod {
  type: 'recovery'
  codes: Set<string>
}
type Method = TotpMethod | OtpMethod | RecoveryMethod | BaseMethod

interface UserMfa {
  required: boolean
  methods: Method[]
}

// ─── Enrôlement de démonstration ────────────────────────────────────────────
const MFA_USERS: Record<string, UserMfa> = {
  user_clement: {
    required: true,
    methods: [
      { id: 'totp-1', type: 'totp', label: "Application d'authentification", secret: Buffer.from('clement-totp-secret') },
      { id: 'recovery-1', type: 'recovery', label: 'Codes de secours', codes: new Set(['123456', '234567']) },
    ],
  },
  user_alice: {
    required: true,
    methods: [{ id: 'email-1', type: 'email_otp', label: 'Code par email', to: 'alice@example.com' }],
  },
}

/** « Boîte d'envoi » observable — les OTP envoyés (pour les tests/démo uniquement). */
export const outbox: Array<{ channel: 'email' | 'sms'; to: string; code: string }> = []

interface Challenge {
  subject: string
  methodId: string
  type: MfaMethodType
  code?: string
  expiresAt: number
}
const challenges = new Map<string, Challenge>()

// ─── TOTP (RFC 6238) ────────────────────────────────────────────────────────
function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const h = createHmac('sha1', secret).update(buf).digest()
  const offset = h[h.length - 1] & 0xf
  const bin = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3]
  return (bin % 1_000_000).toString().padStart(6, '0')
}
export function totp(secret: Buffer, time = Date.now(), step = 30): string {
  return hotp(secret, Math.floor(time / 1000 / step))
}
function verifyTotp(secret: Buffer, code: string, window = 1): boolean {
  const now = Date.now()
  for (let w = -window; w <= window; w++) {
    if (totp(secret, now + w * 30_000) === code) return true
  }
  return false
}

function userOf(subject: string): UserMfa | undefined {
  return MFA_USERS[subject]
}

// ─── API utilisée par les handlers de commandes ─────────────────────────────
export function getMfaMethods(subject: string): { required: boolean; methods: Array<{ id: string; type: MfaMethodType; label: string }> } {
  const u = userOf(subject)
  if (!u) return { required: false, methods: [] }
  return { required: u.required, methods: u.methods.map(({ id, type, label }) => ({ id, type, label })) }
}

export function startMfa(subject: string, methodId: string) {
  const u = userOf(subject)
  const method = u?.methods.find((m) => m.id === methodId)
  if (!method) throw new Error('unknown method')

  const challengeId = `mfa_${randomUUID()}`
  const base = { subject, methodId, type: method.type, expiresAt: Date.now() + 5 * 60_000 }

  switch (method.type) {
    case 'totp':
      challenges.set(challengeId, base)
      return { challengeId, type: method.type, hint: "Entrez le code de votre application d'authentification." }

    case 'email_otp':
    case 'sms_otp': {
      const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
      challenges.set(challengeId, { ...base, code })
      const channel = method.type === 'email_otp' ? 'email' : 'sms'
      outbox.push({ channel, to: (method as OtpMethod).to, code }) // « envoi » simulé
      const masked = (method as OtpMethod).to.replace(/(.).*(.@|.{2}$)/, '$1***$2')
      return { challengeId, type: method.type, hint: `Code envoyé par ${channel} à ${masked}.` }
    }

    case 'recovery':
      challenges.set(challengeId, base)
      return { challengeId, type: method.type, hint: 'Entrez un de vos codes de secours.' }

    case 'magic_link':
    case 'webauthn':
      // Contrat prêt ; implémentation connecteur à fournir (voir README).
      return { challengeId, type: method.type, hint: 'Méthode non encore implémentée par ce connecteur.', data: { implemented: false } }

    default:
      throw new Error('unsupported method')
  }
}

export function verifyMfa(subject: string, methodId: string, challengeId: string, code?: string): boolean {
  const ch = challenges.get(challengeId)
  if (!ch || ch.subject !== subject || ch.methodId !== methodId || ch.expiresAt < Date.now()) return false

  const method = userOf(subject)?.methods.find((m) => m.id === methodId)
  if (!method || !code) return false

  let ok = false
  switch (method.type) {
    case 'totp':
      ok = verifyTotp((method as TotpMethod).secret, code)
      break
    case 'email_otp':
    case 'sms_otp':
      ok = ch.code === code
      break
    case 'recovery': {
      const codes = (method as RecoveryMethod).codes
      if (codes.has(code)) {
        codes.delete(code) // usage unique
        ok = true
      }
      break
    }
    default:
      ok = false
  }

  if (ok) challenges.delete(challengeId) // anti-rejeu
  return ok
}
