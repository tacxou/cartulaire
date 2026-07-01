import {
  commandRequestSchema,
  replyError,
  replySuccess,
  ERROR_CODES,
  type CommandResponse,
  type ErrorCode,
} from '@cartulaire/connector-contracts'
import { verifyCommandSignature } from '@cartulaire/crypto'

/**
 * En-têtes du transport signé (SPEC §12.1). Dupliqués ici pour que le SDK
 * connecteur ne dépende d'aucun package du cœur.
 */
export const CARTULAIRE_HEADERS = {
  SIGNATURE: 'x-cartulaire-signature',
  TIMESTAMP: 'x-cartulaire-timestamp',
  TRACE_ID: 'x-cartulaire-trace-id',
} as const

/** Contexte fourni à chaque handler de commande. */
export interface CommandContext {
  id: string
  type: string
  traceId: string
  issuer: string
  audience: string
}

/** Handler d'une commande : reçoit le payload validé, renvoie un résultat. */
export type CommandHandler<TPayload = Record<string, unknown>, TResult = unknown> = (
  payload: TPayload,
  ctx: CommandContext,
) => Promise<TResult> | TResult

export interface CommandDefinition {
  type: string
  handler: CommandHandler
}

/** Déclare une commande gérée par le connecteur. */
export function defineCommand<TPayload = Record<string, unknown>, TResult = unknown>(
  type: string,
  handler: CommandHandler<TPayload, TResult>,
): CommandDefinition {
  return { type, handler: handler as CommandHandler }
}

/**
 * Erreur métier levée par un handler pour renvoyer une réponse d'erreur
 * normalisée (ex. INVALID_CREDENTIALS) sans exposer de détail technique.
 */
export class CommandFailure extends Error {
  constructor(
    public readonly code: ErrorCode | string,
    message: string,
    public readonly safeMessage: string,
    public readonly retryable = false,
  ) {
    super(message)
    this.name = 'CommandFailure'
  }
}

export interface DispatchOptions {
  /** Secret HMAC partagé avec l'émetteur (daemon ou cœur). */
  secret: string
  /** Audience attendue par ce connecteur (§13.4). */
  audience: string
  /** Liste blanche des commandes autorisées (§26.4). */
  permissions: readonly string[]
  /** Table des handlers déclarés. */
  handlers: Map<string, CommandHandler>
  /** Fenêtre d'acceptation de l'horodatage (ms). Défaut : 5000. */
  maxSkewMs?: number
  now?: number
}

/**
 * Cœur du connecteur : valide, vérifie la signature et l'audience, applique la
 * liste blanche de permissions, puis dispatche vers le handler. Ne lève jamais —
 * renvoie toujours une réponse normalisée (§13.2/§13.3).
 */
export async function dispatchCommand(
  rawBody: string,
  headers: { signature?: string; timestamp?: string },
  options: DispatchOptions,
): Promise<CommandResponse> {
  const now = options.now ?? Date.now()

  let json: unknown
  try {
    json = JSON.parse(rawBody)
  } catch {
    return replyError('unknown', err(ERROR_CODES.VALIDATION_ERROR, 'Corps JSON invalide'))
  }

  const parsed = commandRequestSchema.safeParse(json)
  if (!parsed.success) {
    return replyError('unknown', err(ERROR_CODES.VALIDATION_ERROR, parsed.error.message))
  }
  const cmd = parsed.data

  // Signature + fraîcheur de l'horodatage
  if (!headers.signature || !headers.timestamp) {
    return replyError(cmd.id, err(ERROR_CODES.INVALID_SIGNATURE, 'En-têtes de signature manquants'))
  }
  const sig = verifyCommandSignature(
    { body: rawBody, timestamp: headers.timestamp, id: cmd.id, type: cmd.type, audience: cmd.audience },
    headers.signature,
    options.secret,
    { maxSkewMs: options.maxSkewMs, now },
  )
  if (!sig.valid) {
    const code =
      sig.reason === 'timestamp_expired' ? ERROR_CODES.COMMAND_EXPIRED : ERROR_CODES.INVALID_SIGNATURE
    return replyError(cmd.id, err(code, `Signature invalide: ${sig.reason}`))
  }

  // Expiration au niveau enveloppe (§13.4)
  if (new Date(cmd.expiresAt).getTime() <= now) {
    return replyError(cmd.id, err(ERROR_CODES.COMMAND_EXPIRED, 'Commande expirée'))
  }

  // Audience exacte (§13.4)
  if (cmd.audience !== options.audience) {
    return replyError(
      cmd.id,
      err(ERROR_CODES.AUDIENCE_MISMATCH, `Audience ${cmd.audience} ≠ ${options.audience}`),
    )
  }

  // Liste blanche de permissions (§26.4)
  if (!options.permissions.includes(cmd.type)) {
    return replyError(cmd.id, err(ERROR_CODES.PERMISSION_DENIED, `Commande ${cmd.type} non autorisée`))
  }

  const handler = options.handlers.get(cmd.type)
  if (!handler) {
    return replyError(cmd.id, err(ERROR_CODES.UNKNOWN_COMMAND, `Commande ${cmd.type} non gérée`))
  }

  try {
    const result = await handler(cmd.payload, {
      id: cmd.id,
      type: cmd.type,
      traceId: cmd.traceId,
      issuer: cmd.issuer,
      audience: cmd.audience,
    })
    return replySuccess(cmd.id, result)
  } catch (e) {
    if (e instanceof CommandFailure) {
      return replyError(cmd.id, {
        code: e.code,
        message: e.message,
        safeMessage: e.safeMessage,
        retryable: e.retryable,
      })
    }
    return replyError(cmd.id, {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: e instanceof Error ? e.message : String(e),
      safeMessage: 'Une erreur est survenue.',
      retryable: false,
    })
  }
}

function err(code: string, message: string) {
  return { code, message, safeMessage: 'Une erreur est survenue.', retryable: false }
}
