import {
  commandResponseSchema,
  type CommandRequest,
  type CommandResponse,
  ERROR_CODES,
} from '@cartulaire/connector-contracts'
import { generateCommandId, generateTraceId, signCommand } from '@cartulaire/crypto'
import { CARTULAIRE_HEADERS } from './headers'

export interface CommandTarget {
  /** URL de l'endpoint `/commands` du daemon ou du connecteur. */
  url: string
  /** Audience attendue — identifiant du destinataire (§13.4). */
  audience: string
  /** Secret partagé HMAC pour signer les commandes vers cette cible. */
  secret: string
}

export interface CommandClientOptions {
  /** Émetteur inscrit dans l'enveloppe. Défaut : "cartulaire". */
  issuer?: string
  /** Durée de vie d'une commande en ms (expiresAt = issuedAt + ttl). Défaut : 5000. */
  commandTtlMs?: number
  /** Timeout réseau en ms. Défaut : 5000. */
  timeoutMs?: number
  /** Implémentation fetch (injectable pour les tests). Défaut : global fetch. */
  fetchImpl?: typeof fetch
}

export interface SendOptions {
  /** traceId à propager ; généré si absent (§34). */
  traceId?: string
  timeoutMs?: number
}

/**
 * Client de commande signé (SPEC §12.1 Mode 1).
 *
 * Construit l'enveloppe (§13.1), la signe (HMAC via `@cartulaire/crypto`),
 * l'émet en HTTP POST vers la cible, puis valide strictement la réponse avec le
 * schéma du contrat. Utilisé par `apps/api` pour appeler le daemon, et par le
 * daemon pour relayer vers un connecteur.
 */
export class CommandClient {
  private readonly issuer: string
  private readonly commandTtlMs: number
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch

  constructor(options: CommandClientOptions = {}) {
    this.issuer = options.issuer ?? 'cartulaire'
    this.commandTtlMs = options.commandTtlMs ?? 5_000
    this.timeoutMs = options.timeoutMs ?? 5_000
    const f = options.fetchImpl ?? globalThis.fetch
    if (!f) {
      throw new Error('Aucune implémentation fetch disponible (Node >= 18 requis).')
    }
    this.fetchImpl = f
  }

  /** Construit et signe une enveloppe de commande sans l'émettre. */
  build<TPayload extends Record<string, unknown>>(
    target: CommandTarget,
    type: string,
    payload: TPayload,
    options: SendOptions = {},
  ): { request: CommandRequest<TPayload>; body: string; signature: string; timestamp: string } {
    const now = Date.now()
    const request: CommandRequest<TPayload> = {
      id: generateCommandId(),
      type,
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.commandTtlMs).toISOString(),
      issuer: this.issuer,
      audience: target.audience,
      traceId: options.traceId ?? generateTraceId(),
      payload,
    }

    const body = JSON.stringify(request)
    const timestamp = String(now)
    const signature = signCommand(
      { body, timestamp, id: request.id, type: request.type, audience: request.audience },
      target.secret,
    )

    return { request, body, signature, timestamp }
  }

  /** Émet une commande signée et renvoie la réponse normalisée validée. */
  async send<TResult = unknown, TPayload extends Record<string, unknown> = Record<string, unknown>>(
    target: CommandTarget,
    type: string,
    payload: TPayload,
    options: SendOptions = {},
  ): Promise<CommandResponse<TResult>> {
    const { request, body, signature, timestamp } = this.build(target, type, payload, options)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? this.timeoutMs)

    let raw: unknown
    try {
      const res = await this.fetchImpl(target.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [CARTULAIRE_HEADERS.SIGNATURE]: signature,
          [CARTULAIRE_HEADERS.TIMESTAMP]: timestamp,
          [CARTULAIRE_HEADERS.TRACE_ID]: request.traceId,
        },
        body,
        signal: controller.signal,
      })
      raw = await res.json()
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError'
      return {
        id: request.id,
        status: 'error',
        result: null,
        error: {
          code: aborted ? ERROR_CODES.TIMEOUT : ERROR_CODES.CONNECTOR_UNAVAILABLE,
          message: err instanceof Error ? err.message : String(err),
          safeMessage: 'Une erreur est survenue.',
          retryable: true,
        },
      }
    } finally {
      clearTimeout(timeout)
    }

    const parsed = commandResponseSchema.safeParse(raw)
    if (!parsed.success) {
      return {
        id: request.id,
        status: 'error',
        result: null,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: `Réponse connecteur invalide: ${parsed.error.message}`,
          safeMessage: 'Une erreur est survenue.',
          retryable: false,
        },
      }
    }

    return parsed.data as CommandResponse<TResult>
  }
}
