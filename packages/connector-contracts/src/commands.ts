/**
 * Catalogue des commandes standard Cartulaire (SPEC §14).
 *
 * Cette liste est la source de vérité partagée entre le cœur Cartulaire et
 * tout connecteur, quel que soit son langage d'implémentation. Toute évolution
 * du catalogue est versionnée avec ce package.
 */
export const COMMANDS = {
  // §14.1 Identité
  IDENTITY_RESOLVE: 'identity.resolve',
  IDENTITY_SEARCH: 'identity.search',
  IDENTITY_GET_BY_ID: 'identity.getById',
  IDENTITY_GET_BY_USERNAME: 'identity.getByUsername',
  IDENTITY_GET_BY_EMAIL: 'identity.getByEmail',
  IDENTITY_GET_CLAIMS: 'identity.getClaims',
  IDENTITY_GET_GROUPS: 'identity.getGroups',
  IDENTITY_GET_ROLES: 'identity.getRoles',

  // §14.2 Authentification
  AUTH_VERIFY_PASSWORD: 'auth.verifyPassword',
  AUTH_VERIFY_MFA: 'auth.verifyMfa',
  AUTH_GET_MFA_METHODS: 'auth.getMfaMethods',
  AUTH_START_MFA: 'auth.startMfa',
  AUTH_REGISTER_MFA: 'auth.registerMfa',
  AUTH_DISABLE_MFA: 'auth.disableMfa',
  AUTH_CHANGE_PASSWORD: 'auth.changePassword',
  AUTH_REQUEST_PASSWORD_RESET: 'auth.requestPasswordReset',
  AUTH_RESET_PASSWORD: 'auth.resetPassword',

  // §14.3 OAuth / OIDC
  CLIENT_GET: 'client.get',
  CLIENT_LIST_ALLOWED_REDIRECT_URIS: 'client.listAllowedRedirectUris',
  CLIENT_GET_SECRET: 'client.getSecret',
  CLIENT_VALIDATE_SECRET: 'client.validateSecret',
  CONSENT_GET: 'consent.get',
  CONSENT_SAVE: 'consent.save',
  CONSENT_REVOKE: 'consent.revoke',
  CLAIMS_MAP: 'claims.map',

  // §14.4 Sessions
  SESSION_VALIDATE: 'session.validate',
  SESSION_REVOKE: 'session.revoke',
  SESSION_REVOKE_ALL: 'session.revokeAll',

  // §14.5 Audit
  AUDIT_EMIT: 'audit.emit',
  AUDIT_SEARCH: 'audit.search',

  // §14.6 Administration
  ADMIN_HEALTH: 'admin.health',
  ADMIN_TEST_CONNECTION: 'admin.testConnection',
  ADMIN_RELOAD_CONFIG: 'admin.reloadConfig',
} as const

export type CommandType = (typeof COMMANDS)[keyof typeof COMMANDS]

/** Liste exhaustive des types de commande, utilisable pour la validation. */
export const COMMAND_TYPES: readonly CommandType[] = Object.values(COMMANDS)

/** Vérifie qu'une chaîne correspond à une commande du catalogue standard. */
export function isKnownCommand(type: string): type is CommandType {
  return (COMMAND_TYPES as readonly string[]).includes(type)
}
