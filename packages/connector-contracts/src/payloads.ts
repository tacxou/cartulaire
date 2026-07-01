import { z } from 'zod'

/**
 * Schémas de charge utile (payload) et de résultat pour les commandes clés.
 *
 * Le cœur ne fait jamais d'hypothèse sur le stockage : il émet ces payloads et
 * valide les résultats renvoyés par le connecteur. Chaque connecteur revalide
 * en entrée (défense en profondeur, SPEC §26.4).
 */

// identity.resolve — résout un identifiant libre vers un sujet interne (§22.2)
export const identityResolvePayloadSchema = z.object({
  identifier: z.string().min(1),
})
export const identityResolveResultSchema = z.object({
  sub: z.string().min(1),
})

// auth.verifyPassword — vérifie un mot de passe côté source (§22.3)
export const authVerifyPasswordPayloadSchema = z.object({
  subject: z.string().min(1),
  password: z.string().min(1),
})
export const authVerifyPasswordResultSchema = z.object({
  valid: z.boolean(),
  mfaRequired: z.boolean().default(false),
})

// claims.map — projette un sujet + scopes vers des claims OIDC (§16.4)
export const claimsMapPayloadSchema = z.object({
  subject: z.string().min(1),
  scopes: z.array(z.string()),
  clientId: z.string().min(1),
})
export const claimsMapResultSchema = z.record(z.unknown())

// consent.get / consent.save (§14.3)
export const consentGetPayloadSchema = z.object({
  subject: z.string().min(1),
  clientId: z.string().min(1),
})
export const consentSavePayloadSchema = z.object({
  subject: z.string().min(1),
  clientId: z.string().min(1),
  scopes: z.array(z.string()),
})

// admin.health (§14.6)
export const adminHealthResultSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  connector: z.string(),
  details: z.record(z.unknown()).optional(),
})

export type IdentityResolvePayload = z.infer<typeof identityResolvePayloadSchema>
export type IdentityResolveResult = z.infer<typeof identityResolveResultSchema>
export type AuthVerifyPasswordPayload = z.infer<typeof authVerifyPasswordPayloadSchema>
export type AuthVerifyPasswordResult = z.infer<typeof authVerifyPasswordResultSchema>
export type ClaimsMapPayload = z.infer<typeof claimsMapPayloadSchema>
export type ClaimsMapResult = z.infer<typeof claimsMapResultSchema>
export type AdminHealthResult = z.infer<typeof adminHealthResultSchema>
