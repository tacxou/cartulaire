import {
  authVerifyPasswordPayloadSchema,
  claimsMapPayloadSchema,
  COMMANDS,
  ERROR_CODES,
  identityResolvePayloadSchema,
} from '@cartulaire/connector-contracts'
import { CommandFailure, createConnectorServer, defineCommand } from '@cartulaire/connector-sdk'
import { findByIdentifier, findBySub, mapClaims } from './users'

const AUDIENCE = process.env['MOCK_CONNECTOR_AUDIENCE'] ?? 'connector.mock'
const SECRET = process.env['MOCK_CONNECTOR_SECRET'] ?? 'dev-daemon-connector-secret'
const PORT = Number(process.env['MOCK_CONNECTOR_PORT'] ?? 8443)

/** Commandes exposées par le connecteur mock — miroir de sa liste blanche. */
const PERMISSIONS = [
  COMMANDS.IDENTITY_RESOLVE,
  COMMANDS.AUTH_VERIFY_PASSWORD,
  COMMANDS.CLAIMS_MAP,
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

  defineCommand(COMMANDS.ADMIN_HEALTH, () => ({
    status: 'ok' as const,
    connector: 'mock',
    details: { users: 2 },
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
