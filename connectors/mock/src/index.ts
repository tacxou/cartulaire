import {
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

/**
 * Store de consentement en mémoire — clé `${subject}::${clientId}` → scopes.
 * C'est le connecteur (et lui seul) qui détient cet état (SPEC §10.2, §46).
 */
const consentStore = new Map<string, Set<string>>()
const consentKey = (subject: string, clientId: string) => `${subject}::${clientId}`

const AUDIENCE = process.env['MOCK_CONNECTOR_AUDIENCE'] ?? 'connector.mock'
const SECRET = process.env['MOCK_CONNECTOR_SECRET'] ?? 'dev-daemon-connector-secret'
const PORT = Number(process.env['MOCK_CONNECTOR_PORT'] ?? 8443)

/** Commandes exposées par le connecteur mock — miroir de sa liste blanche. */
const PERMISSIONS = [
  COMMANDS.IDENTITY_RESOLVE,
  COMMANDS.AUTH_VERIFY_PASSWORD,
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
    return { valid: true, mfaRequired: false }
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
    // Le mock ne conserve pas de sessions serveur : on accuse simplement réception.
    sessionRevokePayloadSchema.parse(payload)
    return { revoked: true }
  }),

  defineCommand(COMMANDS.ADMIN_HEALTH, () => ({
    status: 'ok' as const,
    connector: 'mock',
    details: { users: 2, consents: consentStore.size },
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
