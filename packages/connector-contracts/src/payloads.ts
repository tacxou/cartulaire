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

// ─── MFA / second facteur (§14.2, §23) ──────────────────────────────────────
// Cadre GÉNÉRIQUE : le connecteur possède chaque méthode (secret TOTP, envoi
// SMS/email, credentials WebAuthn). Le cœur orchestre getMfaMethods → startMfa →
// verifyMfa sans jamais connaître l'implémentation d'un facteur.

/** Types de second facteur reconnus par le catalogue. */
export const MFA_METHOD_TYPES = ['totp', 'email_otp', 'sms_otp', 'magic_link', 'webauthn', 'recovery'] as const
export type MfaMethodType = (typeof MFA_METHOD_TYPES)[number]

export const mfaMethodSchema = z.object({
  /** Identifiant stable de la méthode enrôlée (opaque côté cœur). */
  id: z.string().min(1),
  type: z.enum(MFA_METHOD_TYPES),
  /** Libellé affichable (ex. "Application d'authentification", "SMS ****89"). */
  label: z.string(),
})
export type MfaMethod = z.infer<typeof mfaMethodSchema>

// auth.getMfaMethods — quelles méthodes pour ce sujet, et le MFA est-il requis ?
export const authGetMfaMethodsPayloadSchema = z.object({
  subject: z.string().min(1),
  clientId: z.string().optional(),
})
export const authGetMfaMethodsResultSchema = z.object({
  required: z.boolean(),
  methods: z.array(mfaMethodSchema),
})

// Contexte WebAuthn (Relying Party) transmis par le cœur au connecteur.
// Le cœur possède l'origine/rpId ; le connecteur possède les credentials.
const webauthnRpSchema = z.object({
  rpId: z.string().optional(),
  origin: z.string().optional(),
})

// auth.startMfa — initie un défi pour une méthode (envoi OTP, options WebAuthn…)
export const authStartMfaPayloadSchema = z
  .object({
    subject: z.string().min(1),
    methodId: z.string().min(1),
  })
  .merge(webauthnRpSchema)
export const authStartMfaResultSchema = z.object({
  /** Identifiant du défi, à repasser à verifyMfa (anti-rejeu, corrélation). */
  challengeId: z.string().min(1),
  type: z.enum(MFA_METHOD_TYPES),
  /** Indice non sensible affiché à l'utilisateur (ex. "Code envoyé à c***@ex.com"). */
  hint: z.string().optional(),
  /** Données spécifiques à la méthode (ex. options WebAuthn) — opaques pour le cœur. */
  data: z.record(z.unknown()).optional(),
})

// auth.verifyMfa — vérifie la réponse au défi
export const authVerifyMfaPayloadSchema = z.object({
  subject: z.string().min(1),
  methodId: z.string().min(1),
  challengeId: z.string().min(1),
  /** Code saisi (TOTP, OTP, code de secours). */
  code: z.string().optional(),
  /** Réponse structurée (assertion WebAuthn…) — opaque pour le cœur. */
  response: z.record(z.unknown()).optional(),
})
export const authVerifyMfaResultSchema = z.object({
  valid: z.boolean(),
})

// auth.registerMfa — enrôlement d'un facteur, en deux phases (§14.2, §23)
export const authRegisterMfaPayloadSchema = z
  .object({
    subject: z.string().min(1),
    type: z.enum(MFA_METHOD_TYPES),
    /** `start` initie l'enrôlement ; `confirm` le valide avec un code/réponse. */
    phase: z.enum(['start', 'confirm']),
    /** Libellé/destination pour start (email, n° masqué, nom de clé…). */
    label: z.string().optional(),
    /** Nom d'utilisateur affiché (WebAuthn user.name). */
    userName: z.string().optional(),
    challengeId: z.string().optional(),
    code: z.string().optional(),
    response: z.record(z.unknown()).optional(),
  })
  .merge(webauthnRpSchema)
export const authRegisterMfaResultSchema = z.object({
  challengeId: z.string().optional(),
  /** Secret TOTP (base32) + URI otpauth à présenter/scanner, phase start. */
  secret: z.string().optional(),
  otpauthUri: z.string().optional(),
  hint: z.string().optional(),
  /** Données spécifiques (options de création WebAuthn…). */
  data: z.record(z.unknown()).optional(),
  /** Phase confirm : facteur enrôlé. */
  registered: z.boolean().optional(),
  methodId: z.string().optional(),
})

// auth.disableMfa — retire un facteur enrôlé
export const authDisableMfaPayloadSchema = z.object({
  subject: z.string().min(1),
  methodId: z.string().min(1),
})
export const authDisableMfaResultSchema = z.object({
  disabled: z.boolean(),
})

// claims.map — projette un sujet + scopes vers des claims OIDC (§16.4)
export const claimsMapPayloadSchema = z.object({
  subject: z.string().min(1),
  scopes: z.array(z.string()),
  clientId: z.string().min(1),
})
export const claimsMapResultSchema = z.record(z.unknown())

// consent.get / consent.save / consent.revoke (§14.3)
export const consentGetPayloadSchema = z.object({
  subject: z.string().min(1),
  clientId: z.string().min(1),
})
export const consentGetResultSchema = z.object({
  /** Scopes déjà consentis par ce sujet pour ce client (vide si aucun). */
  scopes: z.array(z.string()),
})
export const consentSavePayloadSchema = z.object({
  subject: z.string().min(1),
  clientId: z.string().min(1),
  scopes: z.array(z.string()),
})
export const consentRevokePayloadSchema = z.object({
  subject: z.string().min(1),
  clientId: z.string().min(1),
})

// session.revoke / session.validate (§14.4, §19)
export const sessionRevokePayloadSchema = z.object({
  sid: z.string().optional(),
  subject: z.string().optional(),
})
export const sessionValidatePayloadSchema = z.object({
  sid: z.string().min(1),
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
export type AuthGetMfaMethodsResult = z.infer<typeof authGetMfaMethodsResultSchema>
export type AuthStartMfaResult = z.infer<typeof authStartMfaResultSchema>
export type AuthVerifyMfaResult = z.infer<typeof authVerifyMfaResultSchema>
export type AuthRegisterMfaResult = z.infer<typeof authRegisterMfaResultSchema>
export type AuthDisableMfaResult = z.infer<typeof authDisableMfaResultSchema>
export type ConsentGetPayload = z.infer<typeof consentGetPayloadSchema>
export type ConsentGetResult = z.infer<typeof consentGetResultSchema>
export type ConsentSavePayload = z.infer<typeof consentSavePayloadSchema>
export type SessionRevokePayload = z.infer<typeof sessionRevokePayloadSchema>
export type AdminHealthResult = z.infer<typeof adminHealthResultSchema>
