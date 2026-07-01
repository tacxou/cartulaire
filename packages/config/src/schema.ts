import { z } from 'zod'

/**
 * Schéma de configuration Cartulaire (SPEC §32).
 *
 * Toute configuration est validée au démarrage — fail-fast, message explicite.
 * Les secrets ne sont jamais en clair dans le fichier : ils sont référencés par
 * variable d'environnement (`*Env`) ou montés en fichier (`*Path`).
 */
export const connectorConfigSchema = z.object({
  type: z.enum(['http', 'grpc']).default('http'),
  url: z.string().url(),
  audience: z.string().min(1),
  auth: z
    .object({
      mode: z.enum(['signed-hmac', 'signed-jwt', 'mtls']).default('signed-hmac'),
      keyId: z.string().optional(),
      secretEnv: z.string().optional(),
    })
    .default({ mode: 'signed-hmac' }),
  permissions: z.array(z.string()).default([]),
})

export const clientConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['confidential', 'public']),
  secretEnv: z.string().optional(),
  redirectUris: z.array(z.string().url()),
  grants: z.array(z.string()).default(['authorization_code', 'refresh_token']),
  scopes: z.array(z.string()).default(['openid']),
})

export const cartulaireConfigSchema = z.object({
  server: z.object({
    publicUrl: z.string().url(),
    trustProxy: z.boolean().default(false),
  }),
  security: z.object({
    cookieSecretEnv: z.string().min(1),
    tokenSigningKeyPath: z.string().optional(),
    tokenSigningAlg: z.enum(['EdDSA', 'RS256']).default('EdDSA'),
  }),
  ui: z
    .object({
      productName: z.string().default('Cartulaire'),
      logo: z.string().default('/assets/logo.svg'),
      background: z.string().default('/assets/background.svg'),
      theme: z.record(z.string()).optional(),
    })
    .default({}),
  protocols: z
    .object({
      oauth: z.object({ enabled: z.boolean() }).default({ enabled: true }),
      oidc: z.object({ enabled: z.boolean() }).default({ enabled: true }),
      cas: z.object({ enabled: z.boolean() }).default({ enabled: false }),
      saml: z.object({ enabled: z.boolean() }).default({ enabled: false }),
    })
    .default({
      oauth: { enabled: true },
      oidc: { enabled: true },
      cas: { enabled: false },
      saml: { enabled: false },
    }),
  connectors: z.record(connectorConfigSchema).default({}),
  clients: z.array(clientConfigSchema).default([]),
})

export type CartulaireConfig = z.infer<typeof cartulaireConfigSchema>
export type ConnectorConfig = z.infer<typeof connectorConfigSchema>
export type ClientConfig = z.infer<typeof clientConfigSchema>
