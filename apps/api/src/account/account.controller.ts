import { Body, Controller, Get, Logger, Post, Res } from '@nestjs/common'
import { Response } from 'express'
import { OidcSession } from 'nest-oidc-provider'
import type { MfaMethodType } from '@cartulaire/connector-contracts'
import { MfaService } from '~/mfa/mfa.service'

/** Session OIDC minimale telle qu'exposée par `@OidcSession()`. */
interface OidcSessionLike {
  accountId?: string
}

/**
 * Page de gestion du compte (first-party). Protégée par la session OIDC : seul
 * un utilisateur connecté peut voir et gérer ses facteurs MFA. Toutes les
 * opérations sont déléguées au connecteur (§10.3, §14.2).
 */
@Controller('/account')
export class AccountController {
  private readonly logger = new Logger(AccountController.name)

  constructor(private readonly mfa: MfaService) {}

  @Get()
  async index(@OidcSession() session: OidcSessionLike, @Res() res: Response): Promise<void> {
    const sub = session?.accountId
    if (!sub) {
      return res.status(401).render('pages/account', { authenticated: false })
    }
    const { methods } = await this.mfa.getMethods(sub)
    return res.render('pages/account', { authenticated: true, sub, methods })
  }

  @Post('mfa/enroll')
  async enroll(
    @OidcSession() session: OidcSessionLike,
    @Body() body: Record<string, string>,
    @Res() res: Response,
  ): Promise<void> {
    const sub = session?.accountId
    if (!sub) return res.status(401).render('pages/account', { authenticated: false })

    const type = (body.type as MfaMethodType) || 'totp'
    const enrollment = await this.mfa.registerStart(sub, type, body.label || undefined)
    const { methods } = await this.mfa.getMethods(sub)
    return res.render('pages/account', {
      authenticated: true,
      sub,
      methods,
      enrollment: enrollment ? { ...enrollment, type } : null,
    })
  }

  @Post('mfa/confirm')
  async confirm(
    @OidcSession() session: OidcSessionLike,
    @Body() body: Record<string, string>,
    @Res() res: Response,
  ): Promise<void> {
    const sub = session?.accountId
    if (!sub) return res.status(401).render('pages/account', { authenticated: false })

    const ok = await this.mfa.registerConfirm(
      sub,
      (body.type as MfaMethodType) || 'totp',
      body.challengeId ?? '',
      body.code ?? '',
    )
    const { methods } = await this.mfa.getMethods(sub)
    return res.status(ok ? 200 : 400).render('pages/account', {
      authenticated: true,
      sub,
      methods,
      enrolled: ok,
      enrollError: ok ? null : 'Code invalide, enrôlement non confirmé.',
    })
  }

  @Post('mfa/remove')
  async remove(
    @OidcSession() session: OidcSessionLike,
    @Body() body: Record<string, string>,
    @Res() res: Response,
  ): Promise<void> {
    const sub = session?.accountId
    if (!sub) return res.status(401).render('pages/account', { authenticated: false })
    if (body.methodId) await this.mfa.disable(sub, body.methodId)
    return res.redirect('/account')
  }
}
