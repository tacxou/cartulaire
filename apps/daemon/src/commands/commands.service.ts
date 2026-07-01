import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  commandRequestSchema,
  ERROR_CODES,
  replyError,
  type CommandResponse,
} from '@cartulaire/connector-contracts'
import { verifyCommandSignature } from '@cartulaire/crypto'
import { CommandClient } from '@cartulaire/core'
import type { ConnectorConfig, DaemonConfig } from '../config'
import { DAEMON_CONFIG } from '../constants'

/**
 * Routeur de commandes du daemon (SPEC §11.2).
 *
 * Deux liens de confiance indépendants :
 *   1. cœur (API) → daemon : signature vérifiée avec `inboundSecret` ;
 *   2. daemon → connecteur : commande re-signée avec le secret du connecteur.
 *
 * Le daemon applique la liste blanche de permissions AVANT transmission (§26.4),
 * isole toute erreur d'un connecteur et ne renvoie jamais d'erreur brute (§11.2).
 */
@Injectable()
export class CommandsService {
  private readonly logger = new Logger(CommandsService.name)
  private readonly connectorsByAudience: Map<string, ConnectorConfig>
  private readonly client: CommandClient

  constructor(@Inject(DAEMON_CONFIG) private readonly config: DaemonConfig) {
    this.connectorsByAudience = new Map(config.connectors.map((c) => [c.audience, c]))
    this.client = new CommandClient({ issuer: 'cartulaire.daemon' })
  }

  async route(rawBody: string, signature?: string, timestamp?: string): Promise<CommandResponse> {
    const parsed = commandRequestSchema.safeParse(safeJson(rawBody))
    if (!parsed.success) {
      return replyError('unknown', fail(ERROR_CODES.VALIDATION_ERROR, parsed.error?.message ?? 'Corps invalide'))
    }
    const cmd = parsed.data

    // 1) Vérifier le lien cœur → daemon (§26.2)
    if (!signature || !timestamp) {
      return replyError(cmd.id, fail(ERROR_CODES.INVALID_SIGNATURE, 'En-têtes de signature manquants'))
    }
    const sig = verifyCommandSignature(
      { body: rawBody, timestamp, id: cmd.id, type: cmd.type, audience: cmd.audience },
      signature,
      this.config.inboundSecret,
      { maxSkewMs: this.config.maxSkewMs },
    )
    if (!sig.valid) {
      const code =
        sig.reason === 'timestamp_expired' ? ERROR_CODES.COMMAND_EXPIRED : ERROR_CODES.INVALID_SIGNATURE
      this.logger.warn(`Commande rejetée (${sig.reason}) trace=${cmd.traceId}`)
      return replyError(cmd.id, fail(code, `Signature entrante invalide: ${sig.reason}`))
    }

    if (new Date(cmd.expiresAt).getTime() <= Date.now()) {
      return replyError(cmd.id, fail(ERROR_CODES.COMMAND_EXPIRED, 'Commande expirée'))
    }

    // 2) Router selon l'audience
    const connector = this.connectorsByAudience.get(cmd.audience)
    if (!connector) {
      this.logger.warn(`Aucun connecteur pour audience=${cmd.audience} trace=${cmd.traceId}`)
      return replyError(cmd.id, fail(ERROR_CODES.CONNECTOR_UNAVAILABLE, `Audience inconnue: ${cmd.audience}`))
    }

    // 3) Liste blanche de permissions, côté daemon (§26.4)
    if (!connector.permissions.includes(cmd.type)) {
      this.logger.warn(`Commande ${cmd.type} non autorisée pour ${connector.name} trace=${cmd.traceId}`)
      return replyError(cmd.id, fail(ERROR_CODES.PERMISSION_DENIED, `Commande ${cmd.type} non autorisée`))
    }

    // 4) Relais signé daemon → connecteur ; on isole toute erreur (§11.2)
    const started = Date.now()
    const response = await this.client.send(
      { url: connector.url, audience: connector.audience, secret: connector.secret },
      cmd.type,
      cmd.payload,
      { traceId: cmd.traceId },
    )
    this.logger.log(
      `${cmd.type} → ${connector.name} status=${response.status} durée=${Date.now() - started}ms trace=${cmd.traceId}`,
    )

    // On préserve l'id d'origine pour la corrélation côté cœur.
    return { ...response, id: cmd.id } as CommandResponse
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function fail(code: string, message: string) {
  return { code, message, safeMessage: 'Une erreur est survenue.', retryable: false }
}
