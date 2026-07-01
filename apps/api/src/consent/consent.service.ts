import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandClient, type CommandTarget } from '@cartulaire/core'
import {
  COMMANDS,
  type ConsentGetResult,
  type SessionRevokePayload,
} from '@cartulaire/connector-contracts'

/**
 * Délégation du consentement et de la révocation de session (SPEC §14.3, §14.4, §19).
 *
 * Le cœur ne stocke jamais durablement un consentement ni une session : il les
 * lit/écrit via le daemon → connecteur. En cas d'échec, on dégrade proprement
 * (aucun consentement pré-existant, révocation best-effort) sans exposer d'erreur.
 */
@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name)
  private readonly client: CommandClient
  private readonly target: CommandTarget

  constructor(private readonly config: ConfigService) {
    const timeoutMs = this.config.get<number>('daemon.timeoutMs', 5000)
    this.client = new CommandClient({ issuer: 'cartulaire', timeoutMs })
    this.target = {
      url: this.config.get<string>('daemon.url')!,
      audience: this.config.get<string>('daemon.identityAudience')!,
      secret: this.config.get<string>('daemon.secret')!,
    }
  }

  /** Scopes déjà consentis par ce sujet pour ce client (vide si aucun/erreur). */
  async getConsent(subject: string, clientId: string): Promise<string[]> {
    const res = await this.client.send<ConsentGetResult>(this.target, COMMANDS.CONSENT_GET, {
      subject,
      clientId,
    })
    if (res.status !== 'success' || !res.result) {
      this.logger.debug(`consent.get indisponible pour "${subject}"/"${clientId}"`)
      return []
    }
    return res.result.scopes ?? []
  }

  /** Persiste le consentement de l'utilisateur pour ce client (§14.3). */
  async saveConsent(subject: string, clientId: string, scopes: string[]): Promise<void> {
    const res = await this.client.send(this.target, COMMANDS.CONSENT_SAVE, {
      subject,
      clientId,
      scopes,
    })
    if (res.status !== 'success') {
      this.logger.warn(`consent.save a échoué pour "${subject}"/"${clientId}"`)
    }
  }

  /** Révoque le consentement d'un client pour un sujet. */
  async revokeConsent(subject: string, clientId: string): Promise<void> {
    await this.client.send(this.target, COMMANDS.CONSENT_REVOKE, { subject, clientId })
  }

  /** Révoque une session côté source (best-effort, §19). */
  async revokeSession(payload: SessionRevokePayload): Promise<void> {
    const res = await this.client.send(this.target, COMMANDS.SESSION_REVOKE, { ...payload })
    if (res.status !== 'success') {
      this.logger.warn(`session.revoke a échoué (${JSON.stringify(payload)})`)
    }
  }
}
