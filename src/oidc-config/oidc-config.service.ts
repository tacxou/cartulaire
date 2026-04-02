import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HttpAdapterHost } from '@nestjs/core'
import { OidcConfiguration, OidcModuleOptions, OidcModuleOptionsFactory } from 'nest-oidc-provider'
import * as nunjucks from 'nunjucks'
import {
  AdapterFactory,
  Interaction,
  JWKS,
  KoaContextWithOIDC
} from 'oidc-provider'
import { AbstractServiceStorage } from '~/_common/_abstracts/abstract.service.storage'
import { ClientsService } from '~/clients/clients.service'
import { JwksService } from '~/jwks/jwks.service'
import { StorageService } from '~/storage/storage.service'
import { introspectionAllowedPolicy } from './_functions/_features/introspection.function'
import {
  resourceIndicatorsDefaultResource,
  resourceIndicatorsGetResourceServerInfo,
} from './_functions/_features/resource-indicators.function'
import { findAccount } from './_functions/find-account.function'
import { isPkceRequired } from './_functions/is-pkce-required.function'
import { issueRefreshToken } from './_functions/issue-refresh-token.function'
import { loadExistingGrant } from './_functions/load-existing-grant.function'
import { renderError } from './_functions/render-error.function'

@Injectable()
export class OidcConfigService implements OidcModuleOptionsFactory, OnModuleInit {
  private readonly logger = new Logger(OidcConfigService.name)

  public constructor(
    private readonly dbService: AbstractServiceStorage,
    private readonly configService: ConfigService,
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly clientsService: ClientsService,
    private readonly jwksService: JwksService,
  ) {}

  public async onModuleInit() {
    this.logger.debug('OIDC configuration initialized ⚒️')
  }

  public async createModuleOptions(): Promise<OidcModuleOptions> {
    const jwks = await this.jwksService.loadOrCreate()
    return {
      issuer: this.configService.get<string>('oidc.issuer'),
      oidc: this.getConfiguration(jwks),
      path: '/oidc',
      proxy: true,
    }
  }

  public createAdapterFactory(): AdapterFactory | Promise<AdapterFactory> {
    return (modelName: string) => new StorageService(modelName, this.dbService)
  }

  /**
   * Get the OIDC configuration
   *
   * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#configuration-options
   * @returns OidcConfiguration
   */
  public getConfiguration(jwks: JWKS): OidcConfiguration {
    const clients = this.clientsService.getClients()
    this.logger.log(`${clients.length} client(s) chargé(s) depuis ${this.clientsService.filePath} ✅`)

    const renderNunjucks = (template: string, data: Record<string, unknown>): string => {
      const nunjucksEnv: nunjucks.Environment = this.httpAdapterHost.httpAdapter.getInstance().get('nunjucksEnv')
      return nunjucksEnv.render(template, data)
    }

    return {
      clients,
      features: {
        devInteractions: { enabled: false },
        userinfo: { enabled: true },
        jwtUserinfo: { enabled: true },
        deviceFlow: { enabled: true },
        clientCredentials: { enabled: true },
        revocation: { enabled: true },
        encryption: { enabled: true },

        /**
         * UI de déconnexion (RP-Initiated Logout 1.0)
         * - Affiche une confirmation “logout”
         * - Et une page de succès sur `/oidc/session/end/success`
         */
        rpInitiatedLogout: {
          enabled: true,
          logoutSource: async (ctx: KoaContextWithOIDC, formHtml: string) => {
            // NB: dans oidc-provider, ctx.req/ctx.res sont des objets Node (pas Express)
            // eslint-disable-next-line no-console
            console.dir({ req: ctx.req, res: ctx.res }, { depth: 1 })
            const clientDisplay =
              ctx?.oidc?.client?.clientName ||
              ctx?.oidc?.client?.clientId ||
              ctx?.oidc?.session?.state?.clientId ||
              null

            ctx.type = 'html'
            ctx.body = renderNunjucks('pages/logout.njk', {
              clientDisplay,
              formHtml,
            })
          },

          postLogoutSuccessSource: async (ctx: any) => {
            const clientDisplay =
              ctx?.oidc?.client?.clientName || ctx?.oidc?.client?.clientId || null

            ctx.type = 'html'
            ctx.body = renderNunjucks('pages/logout-success.njk', { clientDisplay })
          },
        },

        introspection: {
          enabled: true,

          /**
           * The `introspectionAllowedPolicy` function is responsible for determining whether a token introspection request should be allowed for a given client and token.
           * It is called by the OIDC provider when it receives a token introspection request, and it should return a boolean value indicating whether the request should be allowed.
           * The function can use the client and token information to make a decision about whether to allow the introspection request.
           * For example, it might check the client's authentication method or the token's client ID to determine whether the request should be allowed.
           *
           * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#allowedpolicy
           * @param ctx Koa request context
           * @param client Client instance
           * @param token Access token, client credentials or refresh token instance
           * @returns boolean
           */
          allowedPolicy: introspectionAllowedPolicy,
        },

        resourceIndicators: {
          enabled: true,

          /**
           * Depending on the request's grant_type this can be either an  model instance
           *
           * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#usegrantedresource
           * @param ctx Koa request context
           * @param model AuthorizationCode, BackchannelAuthenticationRequest, RefreshToken or DeviceCode
           * @returns boolean
           */
          useGrantedResource: () => {
            //TODO: check if this is correct or enabled
            return true
          },

          /**
           * Enable JWT access tokens if resource match with issuer
           *
           * @param ctx Koa request context
           * @param client Client instance
           * @param oneOf Resource indicator value is one of the client's registered resource indicators
           * @returns string
           */
          defaultResource: resourceIndicatorsDefaultResource,

          /**
           * The `getResourceServerInfo` function is responsible for retrieving the resource server information for a given resource indicator and client.
           * It is called by the OIDC provider when it needs to determine the resource server information for a request that includes a resource indicator.
           *
           * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#getresourceserverinfo
           * @param ctx Koa request context
           * @param resourceIndicator Resource indicator value
           * @param client Client instance
           * @returns ResourceServer
           */
          getResourceServerInfo: resourceIndicatorsGetResourceServerInfo,
        },
      },

      /**
       * Render the error page using the Nunjucks template engine.
       *
       * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#rendererror
       * @param ctx Koa request context
       * @param out Output object
       * @param error Error object
       * @returns void
       */
      renderError: (ctx, out, error) => renderError(ctx, out, error, renderNunjucks),

      claims: {
        openid: ['sub'],
        profile: ['name'],
      },

      /**
       * The `issueRefreshToken` function is responsible for determining whether a refresh token should be issued for a given client and authorization code.
       * It is called by the OIDC provider when it needs to decide whether to include a refresh token in the response to an authorization request.
       * The function should return a boolean value indicating whether a refresh token should be issued.
       *
       * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#issuerefreshtoken
       */
      issueRefreshToken,

      /**
       * The `findAccount` function is responsible for retrieving the account information for a given subject (user) and token.
       * It is called by the OIDC provider when it needs to generate an ID token or access token for a user.
       * The function should return an object that implements the `Account` interface, which includes the user's claims and a method to retrieve those claims.
       *
       * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#accounts
       */
      findAccount,

      /**
       * PKCE (Proof Key for Code Exchange) is a security extension to the Authorization Code flow,
       * that mitigates the risk of authorization code interception attacks.
       *
       * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#pkce
       */

      /**
       * Active tous les response_types définis dans les specs OIDC Core 1.0 et OAuth 2.0
       * Multiple Response Type Encoding Practices. Par défaut en v9, oidc-provider exclut
       * les types retournant un access token depuis l'authorization endpoint (RFC 9700).
       * On les réautorise explicitement ici pour supporter le flow implicit.
       *
       * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#responsetypes
       */
      responseTypes: [
        'code',
        'id_token',
        'code id_token',
        'code token',
        'id_token token',
        'code id_token token',
        'none',
      ],

      pkce: {
        required: isPkceRequired,
      },

      /**
       * Déclare `skip_consent` comme métadonnée client personnalisée reconnue par le provider.
       *
       * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#extraclientmetadata
       */
      extraClientMetadata: {
        properties: ['skip_consent'],
        validator(_ctx, key, value) {
          if (key === 'skip_consent' && value !== undefined && typeof value !== 'boolean') {
            throw new Error('skip_consent doit être un booléen')
          }
        },
      },

      /**
       * Contourne la page de consentement pour les clients ayant `skip_consent: true`.
       * Un grant est créé automatiquement (ou rechargé s'il existe déjà) avec tous les scopes demandés.
       * Pour les autres clients, recharge le grant existant depuis la session (comportement par défaut).
       *
       * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#loadexistinggrant
       */
      loadExistingGrant,

      /**
       * Interaction URL generation depends on the type of interaction.
       * The default is to use the interaction's uid as a path parameter,
       * but you can customize this to include additional information or use a different format.
       *
       * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#interactions
       */
      interactions: {
        // policy: [],
        url(ctx: KoaContextWithOIDC, interaction: Interaction) {
          // eslint-disable-next-line no-console
          console.log('[oidc][interaction.url] client_id=', ctx?.oidc?.params?.client_id)
          return `/interaction/${interaction.uid}`
        },
      },

      /**
       * The JWKS (JSON Web Key Set) is a set of keys that the OIDC provider uses to sign and encrypt tokens.
       * It is typically generated using a tool like `node-jose` and stored in a secure location.
       * The `jwks` configuration option allows you to specify the location of the JWKS file or the JWKS object itself.
       *
       * @see https://github.com/panva/node-oidc-provider-example/blob/main/01-oidc-configured/generate-keys.js
       */
      jwks,

      /**
       * Load additional configuration from environment variables or configuration files
       *
       * @var config OidcConfiguration
       */
      ...this.configService.get<OidcConfiguration>('oidc'),
    }
  }
}
