import {
  authDisableMfaPayloadSchema,
  authGetMfaMethodsPayloadSchema,
  authRegisterMfaPayloadSchema,
  authRequestPasswordResetPayloadSchema,
  authResetPasswordPayloadSchema,
  authStartMfaPayloadSchema,
  authVerifyMfaPayloadSchema,
  authVerifyPasswordPayloadSchema,
  claimsMapPayloadSchema,
  COMMANDS,
  consentGetPayloadSchema,
  consentRevokePayloadSchema,
  consentSavePayloadSchema,
  ERROR_CODES,
  identityResolvePayloadSchema,
  sessionRevokePayloadSchema,
} from '@cartulaire/connector-contracts'
import { CommandFailure, createConnectorServer, defineCommand } from '@cartulaire/connector-sdk'
import { findByIdentifier, findBySub, mapClaims } from './users'
import { disableMfa, getMfaMethods, outbox, registerConfirm, registerStart, startMfa, verifyMfa } from './mfa'
import { requestPasswordReset, resetPassword } from './password-reset'

/**
 * Store de consentement en mémoire — clé `${subject}::${clientId}` → scopes.
 * C'est le connecteur (et lui seul) qui détient cet état (SPEC §10.2, §46).
 */
const consentStore = new Map<string, Set<string>>()
const consentKey = (subject: string, clientId: string) => `${subject}::${clientId}`

/** Compteur observable de révocations de session (utilisé par les tests). */
let sessionRevocations = 0

const AUDIENCE = process.env['MOCK_CONNECTOR_AUDIENCE'] ?? 'connector.mock'
const SECRET = process.env['MOCK_CONNECTOR_SECRET'] ?? 'dev-daemon-connector-secret'
const PORT = Number(process.env['MOCK_CONNECTOR_PORT'] ?? 8443)

/** Commandes exposées par le connecteur mock — miroir de sa liste blanche. */
const PERMISSIONS = [
  COMMANDS.IDENTITY_RESOLVE,
  COMMANDS.AUTH_VERIFY_PASSWORD,
  COMMANDS.AUTH_GET_MFA_METHODS,
  COMMANDS.AUTH_START_MFA,
  COMMANDS.AUTH_VERIFY_MFA,
  COMMANDS.AUTH_REGISTER_MFA,
  COMMANDS.AUTH_DISABLE_MFA,
  COMMANDS.AUTH_REQUEST_PASSWORD_RESET,
  COMMANDS.AUTH_RESET_PASSWORD,
  COMMANDS.CLAIMS_MAP,
  COMMANDS.CONSENT_GET,
  COMMANDS.CONSENT_SAVE,
  COMMANDS.CONSENT_REVOKE,
  COMMANDS.SESSION_REVOKE,
  COMMANDS.ADMIN_HEALTH,
] as const

const commands = [
  defineCommand(COMMANDS.IDENTITY_RESOLVE, (payload) => {
    const { identifier } = identityResolvePayloadSchema.parse(payload)
    const user = findByIdentifier(identifier)
    if (!user) {
      // Message générique : ne pas révéler l'existence d'un compte (§36.1).
      throw new CommandFailure(
        ERROR_CODES.IDENTITY_NOT_FOUND,
        `No user for identifier ${identifier}`,
        'Identifiant ou mot de passe invalide.',
      )
    }
    return { sub: user.sub }
  }),

  defineCommand(COMMANDS.AUTH_VERIFY_PASSWORD, (payload) => {
    const { subject, password } = authVerifyPasswordPayloadSchema.parse(payload)
    const user = findBySub(subject)
    const valid = !!user && user.password === password
    if (!valid) {
      throw new CommandFailure(
        ERROR_CODES.INVALID_CREDENTIALS,
        `Invalid password for ${subject}`,
        'Identifiant ou mot de passe invalide.',
      )
    }
    return { valid: true, mfaRequired: getMfaMethods(subject).required }
  }),

  defineCommand(COMMANDS.AUTH_GET_MFA_METHODS, (payload) => {
    const { subject } = authGetMfaMethodsPayloadSchema.parse(payload)
    return getMfaMethods(subject)
  }),

  defineCommand(COMMANDS.AUTH_START_MFA, (payload) => {
    const { subject, methodId, rpId, origin, linkBase } = authStartMfaPayloadSchema.parse(payload)
    try {
      return startMfa(subject, methodId, { rpId, origin, linkBase })
    } catch {
      throw new CommandFailure(ERROR_CODES.VALIDATION_ERROR, 'unknown mfa method', 'Une erreur est survenue.')
    }
  }),

  defineCommand(COMMANDS.AUTH_VERIFY_MFA, (payload) => {
    const { subject, methodId, challengeId, code, response } = authVerifyMfaPayloadSchema.parse(payload)
    const valid = verifyMfa(subject, methodId, challengeId, code, { response })
    if (!valid) {
      throw new CommandFailure(ERROR_CODES.MFA_INVALID, 'invalid mfa response', 'Code invalide.')
    }
    return { valid: true }
  }),

  defineCommand(COMMANDS.AUTH_REGISTER_MFA, (payload) => {
    const p = authRegisterMfaPayloadSchema.parse(payload)
    const ctx = { rpId: p.rpId, origin: p.origin, userName: p.userName, response: p.response }
    if (p.phase === 'start') return registerStart(p.subject, p.type, p.label, ctx)
    const res = registerConfirm(p.subject, p.challengeId ?? '', p.code, p.type, ctx)
    if (!res.registered) {
      throw new CommandFailure(ERROR_CODES.MFA_INVALID, 'enrollment failed', 'Code invalide.')
    }
    return res
  }),

  defineCommand(COMMANDS.AUTH_DISABLE_MFA, (payload) => {
    const { subject, methodId } = authDisableMfaPayloadSchema.parse(payload)
    return { disabled: disableMfa(subject, methodId) }
  }),

  defineCommand(COMMANDS.AUTH_REQUEST_PASSWORD_RESET, (payload) => {
    const { identifier, linkBase } = authRequestPasswordResetPayloadSchema.parse(payload)
    requestPasswordReset(identifier, linkBase)
    // Toujours succès, que l'identifiant corresponde ou non à un compte (§36.1).
    return { requested: true as const }
  }),

  defineCommand(COMMANDS.AUTH_RESET_PASSWORD, (payload) => {
    const { token, newPassword } = authResetPasswordPayloadSchema.parse(payload)
    const reset = resetPassword(token, newPassword)
    if (!reset) {
      throw new CommandFailure(ERROR_CODES.VALIDATION_ERROR, 'invalid or expired reset token', 'Lien invalide ou expiré.')
    }
    return { reset: true }
  }),

  defineCommand(COMMANDS.CLAIMS_MAP, (payload) => {
    const { subject, scopes } = claimsMapPayloadSchema.parse(payload)
    const user = findBySub(subject)
    if (!user) {
      throw new CommandFailure(
        ERROR_CODES.IDENTITY_NOT_FOUND,
        `No user ${subject}`,
        'Une erreur est survenue.',
      )
    }
    return mapClaims(user, scopes)
  }),

  defineCommand(COMMANDS.CONSENT_GET, (payload) => {
    const { subject, clientId } = consentGetPayloadSchema.parse(payload)
    const scopes = consentStore.get(consentKey(subject, clientId))
    return { scopes: scopes ? [...scopes] : [] }
  }),

  defineCommand(COMMANDS.CONSENT_SAVE, (payload) => {
    const { subject, clientId, scopes } = consentSavePayloadSchema.parse(payload)
    const key = consentKey(subject, clientId)
    const set = consentStore.get(key) ?? new Set<string>()
    for (const s of scopes) set.add(s)
    consentStore.set(key, set)
    return { saved: true, scopes: [...set] }
  }),

  defineCommand(COMMANDS.CONSENT_REVOKE, (payload) => {
    const { subject, clientId } = consentRevokePayloadSchema.parse(payload)
    consentStore.delete(consentKey(subject, clientId))
    return { revoked: true }
  }),

  defineCommand(COMMANDS.SESSION_REVOKE, (payload) => {
    // Le mock ne conserve pas de sessions serveur : on accuse réception et on
    // incrémente un compteur observable (health) pour les tests.
    sessionRevokePayloadSchema.parse(payload)
    sessionRevocations += 1
    return { revoked: true }
  }),

  defineCommand(COMMANDS.ADMIN_HEALTH, () => ({
    status: 'ok' as const,
    connector: 'mock',
    details: {
      users: 2,
      consents: consentStore.size,
      sessionRevocations,
      mfaOutbox: outbox.length,
      // Démo/tests uniquement : dernier lien magique « envoyé ».
      lastMagicLink: outbox.length ? (outbox[outbox.length - 1].link ?? null) : null,
    },
  })),
]

const server = createConnectorServer({
  name: 'mock',
  audience: AUDIENCE,
  secret: SECRET,
  permissions: PERMISSIONS,
  commands,
})

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[connector-mock] listening on http://0.0.0.0:${PORT} (audience=${AUDIENCE})`)
})
