import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandClient, type CommandTarget } from '@cartulaire/core'
import { COMMANDS, type AuthVerifyPasswordResult, type IdentityResolveResult } from '@cartulaire/connector-contracts'

/**
 * Passerelle d'identité du cœur (SPEC §22, §10.3).
 *
 * Le cœur ne vérifie jamais lui-même un mot de passe ni ne connaît le stockage :
 * il émet des commandes signées vers le daemon, qui les route vers le connecteur
 * d'identité. Toute erreur est ramenée à un message générique (§36.1) — on ne
 * révèle jamais si un compte existe ou si seul le mot de passe est faux.
 */
@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name)
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

  /**
   * Authentifie un utilisateur : résout l'identifiant puis vérifie le mot de
   * passe, via deux commandes signées. Renvoie le `sub` ou `null` (générique).
   */
  async authenticate(identifier: string, password: string): Promise<{ sub: string } | null> {
    const resolve = await this.client.send<IdentityResolveResult>(
      this.target,
      COMMANDS.IDENTITY_RESOLVE,
      { identifier },
    )
    if (resolve.status !== 'success' || !resolve.result?.sub) {
      this.logger.debug(`identity.resolve refusé pour "${identifier}"`)
      return null
    }
    const sub = resolve.result.sub

    const verify = await this.client.send<AuthVerifyPasswordResult>(
      this.target,
      COMMANDS.AUTH_VERIFY_PASSWORD,
      { subject: sub, password },
    )
    if (verify.status !== 'success' || !verify.result?.valid) {
      this.logger.debug(`auth.verifyPassword refusé pour "${sub}"`)
      return null
    }

    return { sub }
  }

  /**
   * Projette les claims d'un sujet selon les scopes demandés, via `claims.map`
   * (§16.4). En cas d'échec, on renvoie au minimum `{ sub }`.
   */
  async mapClaims(
    subject: string,
    scopes: string[],
    clientId: string,
  ): Promise<Record<string, unknown>> {
    const res = await this.client.send<Record<string, unknown>>(this.target, COMMANDS.CLAIMS_MAP, {
      subject,
      scopes,
      clientId,
    })
    if (res.status !== 'success' || !res.result) {
      this.logger.warn(`claims.map échec pour "${subject}" — fallback { sub }`)
      return { sub: subject }
    }
    return res.result
  }
}
