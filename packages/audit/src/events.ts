/**
 * Catalogue des événements d'audit Cartulaire (SPEC §35).
 *
 * L'audit est **distinct** des logs techniques : il trace les décisions de
 * sécurité (qui, quoi, quel client, quel résultat) pour un SIEM ou un registre.
 */
export const AUDIT_EVENTS = {
  LOGIN_SUCCESS: 'login.success',
  LOGIN_FAILURE: 'login.failure',
  MFA_SUCCESS: 'mfa.success',
  MFA_FAILURE: 'mfa.failure',
  OAUTH_CONSENT_ACCEPTED: 'oauth.consent.accepted',
  OAUTH_TOKEN_ISSUED: 'oauth.token.issued',
  OAUTH_TOKEN_REVOKED: 'oauth.token.revoked',
  SESSION_REVOKED: 'session.revoked',
  CONNECTOR_ERROR: 'connector.error',
  ADMIN_CONFIG_RELOAD: 'admin.config.reload',
} as const

export type AuditEventType = (typeof AUDIT_EVENTS)[keyof typeof AUDIT_EVENTS]

export type AuditProtocol = 'oauth' | 'oidc' | 'cas' | 'saml'

/** Un événement d'audit. Ne contient JAMAIS de secret (mot de passe, token…). */
export interface AuditEvent {
  type: AuditEventType
  /** Horodatage ISO-8601, ajouté par l'émetteur. */
  timestamp: string
  /** Corrélation de bout en bout (§34). */
  traceId?: string
  /** Sujet concerné (jamais l'identifiant en clair si sensible). */
  subject?: string
  clientId?: string
  protocol?: AuditProtocol
  /** Adresse IP source si disponible et pertinente. */
  ip?: string
  /** Motif court (ex. `invalid_credentials`) — jamais de détail sensible. */
  reason?: string
  /** Données additionnelles non sensibles. */
  data?: Record<string, unknown>
}

/** Champ minimal requis pour émettre : le reste est complété par l'émetteur. */
export type AuditEventInput = Omit<AuditEvent, 'timestamp'> & { timestamp?: string }
