import { BadRequestException, Body, Controller, Get, Logger, Post, Query, Req, Res } from '@nestjs/common'
import { Request, Response } from 'express'
import {
  InjectOidcProvider,
  InteractionHelper,
  KoaContextWithOIDC,
  OidcContext,
  OidcInteraction,
  Provider,
} from 'nest-oidc-provider'
import { ConsentLabelsService } from '~/consent-labels/consent-labels.service'
import { ClientsService } from '~/clients/clients.service'
import { IdentityService } from '~/identity/identity.service'
import { ConsentService } from '~/consent/consent.service'
import { AuditService } from '~/audit/audit.service'
import { MfaService } from '~/mfa/mfa.service'

@Controller('/interaction')
export class InteractionController {
  private readonly logger = new Logger(InteractionController.name)

  public constructor(
    @InjectOidcProvider() private readonly provider: Provider,
    private readonly consentLabels: ConsentLabelsService,
    private readonly clientsService: ClientsService,
    private readonly identity: IdentityService,
    private readonly consent: ConsentService,
    private readonly audit: AuditService,
    private readonly mfa: MfaService,
  ) {}

  private buildOAuthErrorRedirect(
    params: Record<string, unknown>,
    error: string,
    errorDescription: string,
  ): string | null {
    const redirectUri = params.redirect_uri
    if (typeof redirectUri !== 'string' || !redirectUri) return null

    const url = new URL(redirectUri)
    url.searchParams.set('error', error)
    url.searchParams.set('error_description', errorDescription)
    if (params.state != null && params.state !== '') {
      url.searchParams.set('state', String(params.state))
    }
    return url.toString()
  }

  private isAllowedOAuthReturnTo(returnTo: string): boolean {
    let target: URL
    try {
      target = new URL(returnTo)
    } catch {
      return false
    }

    return this.clientsService.getClients().some((client) =>
      (client.redirect_uris ?? []).some((uri) => {
        try {
          const registered = new URL(uri)
          return target.origin === registered.origin && target.pathname === registered.pathname
        } catch {
          return returnTo.startsWith(uri)
        }
      }),
    )
  }

  @Get(':uid')
  public async interaction(
    @OidcInteraction() interaction: InteractionHelper,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<void> {
    console.log('req', req.body)
    try {
      const { uid, prompt, params, session, lastSubmission } = await interaction.details()
      console.log('prompt', prompt)
      console.log('params', params)
      console.log('session', session)
      console.log('lastSubmission', lastSubmission)
      const client = await this.provider.Client.find((params as any).client_id)

      // Étape MFA en cours (le mot de passe a été validé, on attend le 2ᵉ facteur).
      if (lastSubmission && (lastSubmission as any).mfa) {
        return res.render('pages/2fa', {
          client,
          uid,
          params,
          mfa: (lastSubmission as any).mfa,
          session,
        })
      }

      switch (prompt.name) {
        case 'login': {
          return res.render('pages/login', {
            client,
            uid,
            params,
            details: prompt.details,
            session,
          })
        }
        case 'consent': {
          const d = prompt.details as {
            missingOIDCScope?: string[] | string
            missingOIDCClaims?: string[] | string
            missingResourceScopes?: Record<string, string[] | string>
          }

          const asScopeList = (v: string[] | string | undefined): string[] => {
            if (!v) return []
            if (Array.isArray(v)) return v.filter(Boolean)
            return String(v).trim().split(/\s+/).filter(Boolean)
          }

          const consentScopes = asScopeList(d?.missingOIDCScope).map((scope) => ({
            scope,
            description: this.consentLabels.getScopeDescription(scope),
          }))
          const consentClaims = asScopeList(d?.missingOIDCClaims as string | string[] | undefined).map((claim) => ({
            claim,
            description: this.consentLabels.getClaimDescription(claim),
          }))
          const consentResourceScopes =
            d?.missingResourceScopes && typeof d.missingResourceScopes === 'object'
              ? Object.entries(d.missingResourceScopes).map(([resource, scopes]) => ({
                  resource,
                  scopes: asScopeList(scopes as string | string[]),
                }))
              : []

          return res.render('pages/consent', {
            client,
            uid,
            params,
            details: prompt.details,
            session,
            consentScopes,
            consentClaims,
            consentResourceScopes,
          })
        }

        default: {
          return undefined
        }
      }
    } catch (e: any) {
      const rawMessage = e?.response?.message ?? e?.message ?? 'Une erreur est survenue'
      const errorDescription = Array.isArray(rawMessage) ? rawMessage.join(', ') : String(rawMessage)
      this.logger.warn(`Interaction error: ${errorDescription}`)
      res.status(400).render('pages/error', {
        error: {
          error: 'invalid_request',
          error_description: errorDescription,
        },
      })
    }
  }

  @Post(':uid')
  public async login(
    @OidcInteraction() interaction: InteractionHelper,
    @Body() form: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<any> {
    try {
      const { prompt, params, uid, session, lastSubmission } = await interaction.details()
      console.log('lastSubmission2', lastSubmission)

      // if (lastSubmission) form = { ...lastSubmission.form || {}, ...form }

      if (prompt.name !== 'login') {
        return res.status(400).render('pages/error', {
          error: {
            error: 'invalid_request',
            error_description: 'Invalid prompt name',
          },
        })
      }

      const clientId = String((params as any).client_id ?? '')

      // ── Étape 2 : vérification du second facteur (MFA) ──────────────────────
      // Le mot de passe a déjà été validé à l'étape 1 ; l'état MFA (sujet, méthode,
      // défi) est conservé côté serveur dans `lastSubmission.mfa`.
      const pendingMfa = lastSubmission && (lastSubmission as any).mfa
      if (pendingMfa) {
        // WebAuthn : le client soumet l'assertion JSON dans `response` ; les
        // autres facteurs soumettent un `code`.
        let waResponse: Record<string, unknown> | undefined
        if (form.response) {
          try {
            waResponse = JSON.parse(form.response)
          } catch {
            waResponse = undefined
          }
        }
        const valid = await this.mfa.verify(
          pendingMfa.subject,
          pendingMfa.methodId,
          pendingMfa.challengeId,
          form.code,
          waResponse,
        )
        if (!valid) {
          this.audit.mfaFailure(pendingMfa.subject, pendingMfa.type, clientId)
          const client = await this.provider.Client.find(clientId)
          // On rejoue l'écran MFA avec le même défi (message générique).
          return res.status(400).render('pages/2fa', {
            client,
            uid,
            params,
            mfa: pendingMfa,
            errorMessage: 'Code invalide.',
          })
        }
        this.audit.mfaSuccess(pendingMfa.subject, pendingMfa.type, clientId)
        // Valeurs amr normalisées RFC 8176 (pwd, otp, sms, swk…) + 'mfa'.
        const factorAmr: Record<string, string> = {
          totp: 'otp',
          email_otp: 'otp',
          sms_otp: 'sms',
          magic_link: 'otp',
          webauthn: 'swk',
          recovery: 'mfa',
        }
        const amr = [...new Set(['pwd', factorAmr[pendingMfa.type] ?? 'mfa', 'mfa'])]
        return interaction.finished(
          {
            login: {
              accountId: pendingMfa.subject,
              acr: 'urn:cartulaire:loa:2',
              amr,
            },
          },
          { mergeWithLastSubmission: false },
        )
      }

      // ── Étape 1 : mot de passe (délégué au daemon, §22) ─────────────────────
      this.logger.debug(`Login UID: ${uid}`)
      this.logger.debug(`Client ID: ${params.client_id}`)

      const account = await this.identity.authenticate(form.username, form.password)
      if (!account) {
        this.audit.loginFailure('invalid_credentials', clientId)
        // Message générique imposé — ne jamais révéler la cause exacte (§36.1).
        throw new BadRequestException('Identifiant ou mot de passe invalide.')
      }
      this.audit.loginSuccess(account.sub, clientId)

      // Step-up : si le connecteur exige un second facteur, on initie un défi et
      // on boucle sur l'interaction sans satisfaire le prompt `login` (§23).
      const mfaInfo = await this.mfa.getMethods(account.sub, clientId)
      if (mfaInfo.required && mfaInfo.methods.length > 0) {
        const method = mfaInfo.methods[0] // choix par défaut ; l'UI pourrait proposer une sélection
        const challenge = await this.mfa.start(account.sub, method.id)
        if (challenge) {
          return interaction.finished(
            {
              mfa: {
                subject: account.sub,
                methodId: method.id,
                type: method.type,
                challengeId: challenge.challengeId,
                hint: challenge.hint,
                // Options WebAuthn (challenge/allowCredentials) pour navigator.credentials.get.
                options: (challenge as { data?: { publicKey?: unknown } }).data?.publicKey,
              },
            },
            { mergeWithLastSubmission: false },
          )
        }
        this.logger.warn(`MFA requis mais défi indisponible pour ${account.sub}`)
      }

      return interaction.finished(
        {
          login: {
            accountId: account.sub,
            amr: ['pwd'],
          },
        },
        {
          mergeWithLastSubmission: false,
        },
      )
    } catch (e: any) {
      const rawMessage = e?.response?.message ?? e?.message ?? 'Une erreur est survenue'
      const errorMessage = Array.isArray(rawMessage) ? rawMessage.join(', ') : String(rawMessage)
      this.logger.warn(`Login error: ${errorMessage}`)

      // Session OIDC invalide/expiree: afficher directement la page d'erreur.
      if (errorMessage === 'invalid_request') {
        return res.status(400).render('pages/error', {
          error: {
            error: 'invalid_request',
            error_description: errorMessage,
          },
        })
      }

      // Cas credentials invalides: on tente de rerendre le formulaire login.
      let details: Awaited<ReturnType<InteractionHelper['details']>> | null = null
      try {
        details = await interaction.details()
      } catch {
        return res.status(400).render('pages/error', {
          error: {
            error: 'invalid_request',
            error_description: errorMessage,
          },
        })
      }

      const client = await this.provider.Client.find((details.params as any).client_id)

      res.status(400).render('pages/login', {
        errorMessage,
        form,
        params: details.params,
        uid: details.uid,
        client,
        details: details.prompt.details,
        session: details.session,
      })
    }
  }

  @Post(':uid/confirm')
  public async confirm(
    @OidcInteraction() interaction: InteractionHelper,
  ): Promise<void> {
    const interactionDetails = await interaction.details()
    const {
      prompt: { name, details },
      params,
      session: { accountId },
    } = interactionDetails
    let { grantId } = interactionDetails

    if (name !== 'consent') return undefined

    const grant = grantId
      ? await this.provider.Grant.find(grantId)
      : new this.provider.Grant({
          accountId,
          clientId: (params as any).client_id,
        })

    if (details.missingOIDCScope) grant.addOIDCScope((details as any).missingOIDCScope.join(' '))
    if (details.missingOIDCClaims) grant.addOIDCClaims((details as any).missingOIDCClaims.join(' '))

    if (details.missingResourceScopes) {
      for (const [indicator, scope] of Object.entries(details.missingResourceScopes)) {
        grant.addResourceScope(indicator, (scope as string[]).join(' '))
      }
    }

    grantId = await grant.save()

    // Persiste le consentement côté connecteur via le daemon (§14.3) — best-effort.
    const consentedScopes: string[] = Array.isArray((details as any).missingOIDCScope)
      ? (details as any).missingOIDCScope
      : []
    if (consentedScopes.length) {
      await this.consent.saveConsent(String(accountId), String((params as any).client_id), consentedScopes)
      this.audit.consentAccepted(String(accountId), String((params as any).client_id), consentedScopes)
    }

    const consent = {} as any

    if (!interactionDetails.grantId) consent.grantId = grantId
    const result = { consent }

    return interaction.finished(result, {
      mergeWithLastSubmission: true,
    })
  }

  @Get(':uid/abort/logout')
  public async abortLogoutPage(
    @OidcInteraction() interaction: InteractionHelper,
    @Res() res: Response,
  ): Promise<void> {
    const { uid } = await interaction.details()
    res.render('pages/abort-logout', { uid })
  }

  @Get(':uid/abort/sign-out')
  public async abortSignOut(
    @OidcContext() ctx: KoaContextWithOIDC,
    @Query('returnTo') returnTo: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const session = await ctx.oidc.provider.Session.get(ctx)
    if (session) {
      await session.destroy()
      this.logger.debug('OIDC session destroyed after consent abort')
    }

    if (returnTo && this.isAllowedOAuthReturnTo(returnTo)) {
      res.redirect(302, returnTo)
      return
    }

    res.render('pages/logout-success', { clientDisplay: null })
  }

  @Get(':uid/abort')
  public async abortLoginPage(
    @OidcInteraction() interaction: InteractionHelper,
  ): Promise<void> {
    try {
      const { uid, prompt, params, session, grantId, lastSubmission } = await interaction.details()
      this.logger.debug(
        `Abort interaction: uid=${uid}, prompt=${prompt.name}, client=${String((params as any).client_id ?? '')}, account=${String(session?.accountId ?? '')}, grant=${String(grantId ?? '')}, hasLastSubmission=${Boolean(lastSubmission)}`
      )
    } catch (e: any) {
      this.logger.warn(`Unable to log abort interaction details: ${e?.message ?? 'unknown error'}`)
    }

    // Ne pas appeler Session.destroy() ici : après `interaction.result`, le navigateur suit
    // l’URL de reprise (`resume`) qui exige que `session.uid` corresponde au snapshot dans
    // l’interaction (voir oidc-provider `actions/authorization/resume.js`). Sinon :
    // « interaction session and authentication session mismatch ».
    // Pour une déconnexion complète du fournisseur OIDC, utiliser le flux RP-Initiated Logout
    // (`/oidc/session/end`…).
    await interaction.finished(
      {
        error: 'access_denied',
        error_description: 'End-user aborted interaction',
      },
      { mergeWithLastSubmission: false },
    )
  }

  @Get(':uid/abort/complete')
  public async abortComplete(
    @OidcInteraction() interaction: InteractionHelper,
    @Res() res: Response,
  ): Promise<void> {
    const { params } = await interaction.details()
    const resumeUrl = await interaction.result(
      {
        error: 'access_denied',
        error_description: 'End-user aborted interaction',
      },
      { mergeWithLastSubmission: false },
    )

    res.json({
      resumeUrl,
      fallbackRedirectUrl: this.buildOAuthErrorRedirect(
        params as Record<string, unknown>,
        'access_denied',
        'End-user aborted interaction',
      ),
    })
  }
}
