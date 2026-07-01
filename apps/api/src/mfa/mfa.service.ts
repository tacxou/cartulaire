import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandClient, type CommandTarget } from '@cartulaire/core'
import {
  COMMANDS,
  type AuthGetMfaMethodsResult,
  type AuthStartMfaResult,
  type AuthVerifyMfaResult,
  type MfaMethod,
} from '@cartulaire/connector-contracts'

/**
 * Orchestration MFA côté cœur (SPEC §23). Le cœur ne connaît AUCUN facteur : il
 * demande au connecteur les méthodes (`auth.getMfaMethods`), initie un défi
 * (`auth.startMfa`) et vérifie la réponse (`auth.verifyMfa`). TOTP, OTP e-mail/SMS,
 * magic-link, WebAuthn… : tout est implémenté côté connecteur.
 */
@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name)
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

  /** Méthodes MFA disponibles pour un sujet et si le MFA est requis. */
  async getMethods(subject: string, clientId?: string): Promise<{ required: boolean; methods: MfaMethod[] }> {
    const res = await this.client.send<AuthGetMfaMethodsResult>(this.target, COMMANDS.AUTH_GET_MFA_METHODS, {
      subject,
      clientId,
    })
    if (res.status !== 'success' || !res.result) {
      // En cas d'échec du connecteur, on n'exige pas de MFA qu'on ne peut vérifier.
      this.logger.warn(`auth.getMfaMethods indisponible pour "${subject}"`)
      return { required: false, methods: [] }
    }
    return res.result
  }

  /** Initie un défi pour la méthode choisie (envoi OTP, options WebAuthn…). */
  async start(subject: string, methodId: string): Promise<AuthStartMfaResult | null> {
    const res = await this.client.send<AuthStartMfaResult>(this.target, COMMANDS.AUTH_START_MFA, {
      subject,
      methodId,
    })
    return res.status === 'success' && res.result ? res.result : null
  }

  /** Vérifie la réponse au défi. */
  async verify(subject: string, methodId: string, challengeId: string, code?: string): Promise<boolean> {
    const res = await this.client.send<AuthVerifyMfaResult>(this.target, COMMANDS.AUTH_VERIFY_MFA, {
      subject,
      methodId,
      challengeId,
      code,
    })
    return res.status === 'success' && !!res.result?.valid
  }
}
