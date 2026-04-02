import { BadRequestException, Body, Controller, Get, Logger, Post, Req, Res } from '@nestjs/common'
import { Request, Response } from 'express'
import { InjectOidcProvider, InteractionHelper, OidcInteraction, Provider } from 'nest-oidc-provider'
import { ConsentLabelsService } from '~/consent-labels/consent-labels.service'
// import { verifyToken } from 'node-2fa'

@Controller('/interaction')
export class InteractionController {
  private readonly logger = new Logger(InteractionController.name)

  public constructor(
    @InjectOidcProvider() private readonly provider: Provider,
    private readonly consentLabels: ConsentLabelsService,
  ) {}

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

      if (lastSubmission && lastSubmission.twofa) {
        return res.render('2fa', {
          client,
          uid,
          params,
          details: prompt.details,
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

      // console.log('Login form', form)
      this.logger.debug(`Login UID: ${uid}`)
      this.logger.debug(`Login user: ${form.username}`)
      this.logger.debug(`Client ID: ${params.client_id}`)

      // const user = await this.usersService.validateUser(
      //   form.username,
      //   form.password,
      // )
      // console.log('user', user.toJSON())
      if (form.username !== 'admin' || form.password !== 'admin') {
        throw new BadRequestException('Invalid username or password')
      }

      if (lastSubmission && lastSubmission.twofa && req.body.token) {
        // console.log('verif', verifyToken(user.googleAuthKey, req.body.token))
        // if (!verifyToken(user.googleAuthKey, req.body.token)) {
        //   return interaction.finished(
        //     {
        //       twofa: true,
        //       form,
        //     },
        //     {
        //       mergeWithLastSubmission: false,
        //     },
        //   )
        // }
      } else {
        // if (user.googleAuthKey) {
        //   return interaction.finished(
        //     {
        //       twofa: true,
        //       form,
        //     },
        //     {
        //       mergeWithLastSubmission: false,
        //     },
        //   )
        // }
      }

      return interaction.finished(
        {
          login: {
            // accountId: user._id.toString(),
            accountId: '123',
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
    const consent = {} as any

    if (!interactionDetails.grantId) consent.grantId = grantId
    const result = { consent }

    return interaction.finished(result, {
      mergeWithLastSubmission: true,
    })
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
  public async abortLogin(@OidcInteraction() interaction: InteractionHelper): Promise<void> {
    await interaction.finished(
      {
        error: 'access_denied',
        error_description: 'End-user aborted interaction',
      },
      { mergeWithLastSubmission: false },
    )
  }
}
