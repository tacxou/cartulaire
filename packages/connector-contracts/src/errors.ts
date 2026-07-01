import { z } from 'zod'

/**
 * Codes d'erreur normalisés du contrat de commande (SPEC §13.3, §36).
 *
 * `message` est destiné aux logs internes ; `safeMessage` est le seul texte
 * autorisé à atteindre l'utilisateur final.
 */
export const ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  IDENTITY_NOT_FOUND: 'IDENTITY_NOT_FOUND',
  MFA_REQUIRED: 'MFA_REQUIRED',
  MFA_INVALID: 'MFA_INVALID',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  COMMAND_EXPIRED: 'COMMAND_EXPIRED',
  AUDIENCE_MISMATCH: 'AUDIENCE_MISMATCH',
  UNKNOWN_COMMAND: 'UNKNOWN_COMMAND',
  CONNECTOR_UNAVAILABLE: 'CONNECTOR_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export const commandErrorSchema = z.object({
  /** Code machine, stable, utilisé pour le branchement logique côté cœur. */
  code: z.string(),
  /** Message technique, réservé aux logs internes — jamais exposé. */
  message: z.string(),
  /** Message utilisateur-safe, seul texte autorisé côté navigateur. */
  safeMessage: z.string(),
  /** Indique si l'opération peut être retentée à l'identique. */
  retryable: z.boolean().default(false),
})

export type CommandError = z.infer<typeof commandErrorSchema>
