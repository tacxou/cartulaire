import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common'
import { Response } from 'express'
import { PasswordResetService } from './password-reset.service'

/**
 * Mot de passe oublié (first-party, hors flux d'interaction OIDC). Toutes les
 * opérations sont déléguées au connecteur (§14.2) ; le cœur ne révèle jamais
 * si un identifiant correspond à un compte (§36.1).
 */
@Controller()
export class PasswordResetController {
  constructor(private readonly passwordReset: PasswordResetService) {}

  @Get('forgot-password')
  forgotPassword(@Res() res: Response): void {
    res.render('pages/forgot-password')
  }

  @Post('forgot-password')
  async requestReset(@Body() body: Record<string, string>, @Res() res: Response): Promise<void> {
    const identifier = (body.identifier ?? '').trim()
    if (!identifier) {
      res.status(400).render('pages/forgot-password', { error: 'Veuillez saisir un identifiant.' })
      return
    }
    // Toujours le même écran, que l'identifiant existe ou non (§36.1).
    await this.passwordReset.requestReset(identifier)
    res.render('pages/forgot-password-sent')
  }

  @Get('reset-password')
  resetPasswordForm(@Query('token') token: string | undefined, @Res() res: Response): void {
    if (!token) {
      res.redirect('/forgot-password')
      return
    }
    res.render('pages/reset-password', { token })
  }

  @Post('reset-password')
  async resetPassword(@Body() body: Record<string, string>, @Res() res: Response): Promise<void> {
    const token = body.token ?? ''
    const newPassword = body.newPassword ?? ''
    const confirmPassword = body.confirmPassword ?? ''

    if (!token) {
      res.redirect('/forgot-password')
      return
    }
    if (newPassword.length < 8) {
      res.status(400).render('pages/reset-password', { token, error: 'Le mot de passe doit contenir au moins 8 caractères.' })
      return
    }
    if (newPassword !== confirmPassword) {
      res.status(400).render('pages/reset-password', { token, error: 'Les mots de passe ne correspondent pas.' })
      return
    }

    const ok = await this.passwordReset.reset(token, newPassword)
    if (!ok) {
      res.status(400).render('pages/reset-password', {
        token,
        error: 'Ce lien de réinitialisation est invalide ou a expiré.',
        tokenInvalid: true,
      })
      return
    }
    res.render('pages/reset-password-success')
  }
}
