import Joi from 'joi'

/**
 * Configuration du daemon (SPEC §11.2, §26).
 *
 * Pour la V0, la configuration est chargée depuis l'environnement. En V1 elle
 * proviendra d'un fichier YAML validé par `@cartulaire/config` (§32), avec la
 * liste blanche de permissions par connecteur (§26.4).
 */
export interface ConnectorConfig {
  name: string
  /** Endpoint `/commands` du connecteur. */
  url: string
  /** Audience du connecteur — clé de routage des commandes (§13.4). */
  audience: string
  /** Secret HMAC partagé daemon ↔ connecteur. */
  secret: string
  /** Liste blanche des commandes autorisées pour ce connecteur (§26.4). */
  permissions: string[]
}

export interface DaemonConfig {
  port: number
  logLevel: string
  /** Secret HMAC partagé cœur (API) ↔ daemon, pour vérifier les commandes entrantes. */
  inboundSecret: string
  /** Fenêtre d'acceptation de l'horodatage (ms). */
  maxSkewMs: number
  connectors: ConnectorConfig[]
}

export const validationSchema = Joi.object({
  CARTULAIRE_DAEMON_PORT: Joi.number().port().default(8788),
  CARTULAIRE_DAEMON_LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'verbose')
    .default('debug'),
  CARTULAIRE_DAEMON_INBOUND_SECRET: Joi.string().min(16).required(),
  CARTULAIRE_DAEMON_MAX_SKEW_MS: Joi.number().positive().default(5000),

  // Connecteur mock (V0) — un unique connecteur déclaré par variables d'env.
  CARTULAIRE_CONNECTOR_MOCK_URL: Joi.string().uri().default('http://localhost:8443/commands'),
  CARTULAIRE_CONNECTOR_MOCK_AUDIENCE: Joi.string().default('connector.mock'),
  CARTULAIRE_CONNECTOR_MOCK_SECRET: Joi.string().min(16).required(),
  CARTULAIRE_CONNECTOR_MOCK_PERMISSIONS: Joi.string().default(
    'identity.resolve,auth.verifyPassword,claims.map,consent.get,consent.save,consent.revoke,session.revoke,admin.health',
  ),
}).unknown(true)

export function loadConfig(): DaemonConfig {
  const { error, value } = validationSchema.validate(process.env, { stripUnknown: false })
  if (error) {
    throw new Error(`Configuration daemon invalide: ${error.message}`)
  }

  return {
    port: Number(value.CARTULAIRE_DAEMON_PORT),
    logLevel: value.CARTULAIRE_DAEMON_LOG_LEVEL,
    inboundSecret: value.CARTULAIRE_DAEMON_INBOUND_SECRET,
    maxSkewMs: Number(value.CARTULAIRE_DAEMON_MAX_SKEW_MS),
    connectors: [
      {
        name: 'mock',
        url: value.CARTULAIRE_CONNECTOR_MOCK_URL,
        audience: value.CARTULAIRE_CONNECTOR_MOCK_AUDIENCE,
        secret: value.CARTULAIRE_CONNECTOR_MOCK_SECRET,
        permissions: String(value.CARTULAIRE_CONNECTOR_MOCK_PERMISSIONS)
          .split(',')
          .map((p: string) => p.trim())
          .filter(Boolean),
      },
    ],
  }
}
