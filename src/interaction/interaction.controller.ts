import { BadRequestException, Body, Controller, Get, Logger, Post, Req, Res } from '@nestjs/common'
import { Request, Response } from 'express'
import { InjectOidcProvider, InteractionHelper, OidcInteraction, Provider } from 'nest-oidc-provider'
// import { verifyToken } from 'node-2fa'

@Controller('/interaction')
export class InteractionController {
  private readonly logger = new Logger(InteractionController.name)

  public constructor(@InjectOidcProvider() private readonly provider: Provider) {}

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
          const msgMap = new Map([
            ['openid', 'Your account identifier'],
            ['offline_access', 'Keep connected to your account'],
            ['profile', 'Your profile information (name, email, phone, ...)'],
            ['email', 'Your email address'],
            ['phone', 'Your phone number'],
            ['address', 'Your address information'],
          ])
          return res.render('pages/consent', {
            client,
            uid,
            params,
            details: prompt.details,
            session,
            msgMap,
          })
        }

        default: {
          return undefined
        }
      }
    } catch (e: any) {
      console.log('prompt', e)
      res.status(400).header('refresh', '5;url=/').send(e.message)
    }
  }

  @Post(':uid')
  public async login(
    @OidcInteraction() interaction: InteractionHelper,
    @Body() form: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<any> {
    const { prompt, params, uid, session, lastSubmission } = await interaction.details()
    console.log('lastSubmission2', lastSubmission)

    if (prompt.name !== 'login') {
      throw new BadRequestException('invalid prompt name')
    }

    // if (lastSubmission) form = { ...lastSubmission.form || {}, ...form }

    try {
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
      const client = await this.provider.Client.find((params as any).client_id)
      console.log('Login error', e)
      console.error(e)
      res.status(400).render('pages/login', {
        errorMessage: e.message,
        params,
        uid,
        client,
        details: prompt.details,
        session,
      })
    }
  }

  @Post(':uid/confirm')
  public async confirm(@OidcInteraction() interaction: InteractionHelper, @Res() res: Response): Promise<void> {
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
  public async abortLogin(@OidcInteraction() interaction: InteractionHelper) {
    await interaction.finished(
      {
        error: 'access_denied',
        error_description: 'End-user aborted interaction',
      },
      { mergeWithLastSubmission: false },
    )
  }
}
