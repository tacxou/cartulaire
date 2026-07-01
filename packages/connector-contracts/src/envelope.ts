import { z } from 'zod'
import { commandErrorSchema } from './errors'

/**
 * Enveloppe de commande Cartulaire (SPEC §13).
 *
 * Toute commande émise par le cœur vers un daemon/connecteur est signée,
 * horodatée, expirable et liée à une audience précise. Ces schémas valident
 * la structure ; la signature elle-même est portée hors enveloppe (headers HTTP
 * ou métadonnées gRPC) et vérifiée par `@cartulaire/crypto`.
 */
export const commandRequestSchema = z.object({
  /** Identifiant unique, généré par l'émetteur — corrélation et anti-rejeu (§13.4). */
  id: z.string().min(1),
  /** Type de commande du catalogue standard (§14). */
  type: z.string().min(1),
  /** Date d'émission ISO-8601. */
  issuedAt: z.string().datetime(),
  /** Date d'expiration ISO-8601 — courte (quelques secondes). */
  expiresAt: z.string().datetime(),
  /** Émetteur, typiquement "cartulaire". */
  issuer: z.string().min(1),
  /** Audience : identifiant exact du connecteur ciblé, vérifié avant exécution. */
  audience: z.string().min(1),
  /** Identifiant de trace propagé de bout en bout (§34). */
  traceId: z.string().min(1),
  /** Charge utile spécifique à la commande. */
  payload: z.record(z.unknown()).default({}),
})

export type CommandRequest<TPayload = Record<string, unknown>> = Omit<
  z.infer<typeof commandRequestSchema>,
  'payload'
> & { payload: TPayload }

export const commandSuccessSchema = z.object({
  id: z.string().min(1),
  status: z.literal('success'),
  result: z.unknown(),
  error: z.null(),
})

export const commandErrorResponseSchema = z.object({
  id: z.string().min(1),
  status: z.literal('error'),
  result: z.null(),
  error: commandErrorSchema,
})

export const commandResponseSchema = z.discriminatedUnion('status', [
  commandSuccessSchema,
  commandErrorResponseSchema,
])

export type CommandResponse<TResult = unknown> =
  | { id: string; status: 'success'; result: TResult; error: null }
  | { id: string; status: 'error'; result: null; error: z.infer<typeof commandErrorSchema> }

/** Construit une réponse de succès normalisée. */
export function replySuccess<TResult>(id: string, result: TResult): CommandResponse<TResult> {
  return { id, status: 'success', result, error: null }
}

/** Construit une réponse d'erreur normalisée. */
export function replyError(
  id: string,
  error: z.infer<typeof commandErrorSchema>,
): CommandResponse<never> {
  return { id, status: 'error', result: null, error }
}
