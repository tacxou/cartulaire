import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandClient, type CommandTarget } from '@cartulaire/core'
import {
  COMMANDS,
  type AuthGetMfaMethodsResult,
  type AuthRegisterMfaResult,
  type AuthStartMfaResult,
  type AuthVerifyMfaResult,
  type MfaMethod,
  type MfaMethodType,
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
  private readonly rp: { rpId: string; origin: string }

  constructor(private readonly config: ConfigService) {
    const timeoutMs = this.config.get<number>('daemon.timeoutMs', 5000)
    this.client = new CommandClient({ issuer: 'cartulaire', timeoutMs })
    this.target = {
      url: this.config.get<string>('daemon.url')!,
      audience: this.config.get<string>('daemon.identityAudience')!,
      secret: this.config.get<string>('daemon.secret')!,
    }
    // Contexte Relying Party WebAuthn (§23) transmis au connecteur.
    this.rp = {
      rpId: this.config.get<string>('webauthn.rpId', 'localhost'),
      origin: this.config.get<string>('webauthn.origin', 'http://localhost:9000'),
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
  async start(subject: string, methodId: string, interactionUid?: string): Promise<AuthStartMfaResult | null> {
    // Le cœur possède l'uid d'interaction : il construit la base du lien magique
    // (§14.2) que le connecteur complètera avec le jeton et enverra par email.
    const linkBase = interactionUid ? `${this.rp.origin}/interaction/${interactionUid}/magic` : undefined
    const res = await this.client.send<AuthStartMfaResult>(this.target, COMMANDS.AUTH_START_MFA, {
      subject,
      methodId,
      linkBase,
      ...this.rp, // rpId/origin — nécessaires pour WebAuthn (ignorés par TOTP/OTP)
    })
    return res.status === 'success' && res.result ? res.result : null
  }

  /** Vérifie la réponse au défi (code OTP/TOTP, ou `response` WebAuthn). */
  async verify(
    subject: string,
    methodId: string,
    challengeId: string,
    code?: string,
    response?: Record<string, unknown>,
  ): Promise<boolean> {
    const res = await this.client.send<AuthVerifyMfaResult>(this.target, COMMANDS.AUTH_VERIFY_MFA, {
      subject,
      methodId,
      challengeId,
      code,
      response,
    })
    return res.status === 'success' && !!res.result?.valid
  }

  /** Initie l'enrôlement (TOTP → secret/otpauth ; OTP → envoi ; WebAuthn → options). */
  async registerStart(
    subject: string,
    type: MfaMethodType,
    label?: string,
    userName?: string,
  ): Promise<AuthRegisterMfaResult | null> {
    const res = await this.client.send<AuthRegisterMfaResult>(this.target, COMMANDS.AUTH_REGISTER_MFA, {
      subject,
      type,
      phase: 'start',
      label,
      userName,
      ...this.rp,
    })
    return res.status === 'success' && res.result ? res.result : null
  }

  /** Confirme l'enrôlement (code de vérification, ou `response` WebAuthn). */
  async registerConfirm(
    subject: string,
    type: MfaMethodType,
    challengeId: string,
    code?: string,
    response?: Record<string, unknown>,
  ): Promise<boolean> {
    const res = await this.client.send<AuthRegisterMfaResult>(this.target, COMMANDS.AUTH_REGISTER_MFA, {
      subject,
      type,
      phase: 'confirm',
      challengeId,
      code,
      response,
      ...this.rp,
    })
    return res.status === 'success' && !!res.result?.registered
  }

  /** Retire un facteur enrôlé. */
  async disable(subject: string, methodId: string): Promise<boolean> {
    const res = await this.client.send<{ disabled: boolean }>(this.target, COMMANDS.AUTH_DISABLE_MFA, {
      subject,
      methodId,
    })
    return res.status === 'success' && !!res.result?.disabled
  }
}
