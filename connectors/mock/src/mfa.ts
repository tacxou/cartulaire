import { createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto'
import {
  webauthnAuthOptions,
  webauthnAuthVerify,
  webauthnDisable,
  webauthnListMethods,
  webauthnRegisterOptions,
  webauthnRegisterVerify,
} from './webauthn'

/** Contexte Relying Party fourni par le cœur pour WebAuthn. */
export interface WebauthnCtx {
  rpId?: string
  origin?: string
  userName?: string
  response?: Record<string, unknown>
}

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
  const base = (userOf(subject)?.methods ?? []).map(({ id, type, label }) => ({ id, type, label }))
  const methods = [...base, ...webauthnListMethods(subject)]
  return { required: methods.length > 0, methods }
}

export function startMfa(subject: string, methodId: string, ctx: WebauthnCtx = {}) {
  // WebAuthn : défi d'authentification (assertion), piloté par le navigateur.
  if (methodId.startsWith('webauthn')) {
    return webauthnAuthOptions(subject, ctx.rpId ?? 'localhost', ctx.origin ?? 'http://localhost')
  }

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

// ─── Enrôlement (auth.registerMfa / auth.disableMfa) ────────────────────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function base32(buf: Buffer): string {
  let bits = 0
  let val = 0
  let out = ''
  for (const b of buf) {
    val = ((val << 8) | b) >>> 0
    bits += 8
    while (bits >= 5) {
      out += B32[(val >>> (bits - 5)) & 31]
      bits -= 5
    }
    // Ne conserver que les `bits` bits restants — évite le débordement 32 bits.
    val &= (1 << bits) - 1
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31]
  return out
}

interface Enrollment {
  subject: string
  type: MfaMethodType
  secret?: Buffer
  code?: string
  to?: string
}
const enrollments = new Map<string, Enrollment>()

function ensureUser(subject: string): UserMfa {
  if (!MFA_USERS[subject]) MFA_USERS[subject] = { required: true, methods: [] }
  return MFA_USERS[subject]
}

export function registerStart(subject: string, type: MfaMethodType, label?: string, ctx: WebauthnCtx = {}) {
  if (type === 'webauthn') {
    return webauthnRegisterOptions(subject, ctx.rpId ?? 'localhost', ctx.origin ?? 'http://localhost', ctx.userName ?? subject)
  }
  const challengeId = `enr_${randomUUID()}`
  if (type === 'totp') {
    const secret = randomBytes(20)
    enrollments.set(challengeId, { subject, type, secret })
    const b32 = base32(secret)
    const uri = `otpauth://totp/Cartulaire:${encodeURIComponent(subject)}?secret=${b32}&issuer=Cartulaire`
    return { challengeId, type, secret: b32, otpauthUri: uri, hint: 'Scannez le QR/URI, puis entrez le code généré.' }
  }
  if (type === 'email_otp' || type === 'sms_otp') {
    const to = label ?? (type === 'email_otp' ? 'user@example.com' : '+10000000000')
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
    enrollments.set(challengeId, { subject, type, code, to })
    outbox.push({ channel: type === 'email_otp' ? 'email' : 'sms', to, code })
    return { challengeId, type, hint: `Code de vérification envoyé à ${to}.` }
  }
  // webauthn / magic_link / recovery : enrôlement à implémenter côté connecteur.
  return { challengeId, type, hint: 'Enrôlement non encore supporté pour cette méthode.', data: { implemented: false } }
}

export function registerConfirm(
  subject: string,
  challengeId: string,
  code?: string,
  type?: MfaMethodType,
  ctx: WebauthnCtx = {},
) {
  if (type === 'webauthn') {
    return ctx.response
      ? webauthnRegisterVerify(subject, challengeId, ctx.response)
      : { registered: false }
  }
  const enr = enrollments.get(challengeId)
  if (!enr || enr.subject !== subject || !code) return { registered: false }

  let ok = false
  if (enr.type === 'totp' && enr.secret) ok = verifyTotp(enr.secret, code)
  else if ((enr.type === 'email_otp' || enr.type === 'sms_otp') && enr.code) ok = enr.code === code
  if (!ok) return { registered: false }

  const user = ensureUser(subject)
  user.required = true
  const methodId = `${enr.type}-${randomUUID().slice(0, 8)}`
  if (enr.type === 'totp') {
    user.methods.push({ id: methodId, type: 'totp', label: "Application d'authentification", secret: enr.secret! })
  } else {
    user.methods.push({ id: methodId, type: enr.type, label: `Code par ${enr.type === 'email_otp' ? 'email' : 'SMS'}`, to: enr.to! } as OtpMethod)
  }
  enrollments.delete(challengeId)
  return { registered: true, methodId }
}

export function disableMfa(subject: string, methodId: string): boolean {
  if (methodId.startsWith('webauthn')) return webauthnDisable(subject, methodId)
  const user = userOf(subject)
  if (!user) return false
  const before = user.methods.length
  user.methods = user.methods.filter((m) => m.id !== methodId)
  if (user.methods.length === 0) user.required = false
  return user.methods.length < before
}

export function verifyMfa(
  subject: string,
  methodId: string,
  challengeId: string,
  code?: string,
  ctx: WebauthnCtx = {},
): boolean {
  // WebAuthn : vérification de l'assertion signée par la clé.
  if (methodId.startsWith('webauthn')) {
    return ctx.response ? webauthnAuthVerify(subject, challengeId, ctx.response) : false
  }

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
