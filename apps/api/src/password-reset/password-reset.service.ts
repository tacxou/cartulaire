import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandClient, type CommandTarget } from '@cartulaire/core'
import { COMMANDS } from '@cartulaire/connector-contracts'

/**
 * Réinitialisation de mot de passe (SPEC §22, §36.1). Le cœur ne sait jamais
 * si un identifiant correspond à un compte : `requestReset` renvoie toujours
 * le même résultat au niveau connecteur (§36.1) et ne journalise jamais
 * l'identifiant recherché.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name)
  private readonly client: CommandClient
  private readonly target: CommandTarget
  private readonly origin: string

  constructor(private readonly config: ConfigService) {
    const timeoutMs = this.config.get<number>('daemon.timeoutMs', 5000)
    this.client = new CommandClient({ issuer: 'cartulaire', timeoutMs })
    this.target = {
      url: this.config.get<string>('daemon.url')!,
      audience: this.config.get<string>('daemon.identityAudience')!,
      secret: this.config.get<string>('daemon.secret')!,
    }
    this.origin = this.config.get<string>('webauthn.origin', 'http://localhost:9000')
  }

  /** Initie une réinitialisation (lien envoyé hors-bande par le connecteur). */
  async requestReset(identifier: string): Promise<void> {
    const linkBase = `${this.origin}/reset-password`
    const res = await this.client.send(this.target, COMMANDS.AUTH_REQUEST_PASSWORD_RESET, {
      identifier,
      linkBase,
    })
    if (res.status !== 'success') {
      this.logger.warn(`auth.requestPasswordReset indisponible (${res.error?.code ?? 'inconnu'})`)
    }
  }

  /** Consomme un jeton de réinitialisation et fixe le nouveau mot de passe. */
  async reset(token: string, newPassword: string): Promise<boolean> {
    const res = await this.client.send<{ reset: boolean }>(this.target, COMMANDS.AUTH_RESET_PASSWORD, {
      token,
      newPassword,
    })
    return res.status === 'success' && !!res.result?.reset
  }
}
