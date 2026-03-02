import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OidcConfiguration, OidcModuleOptions, OidcModuleOptionsFactory } from 'nest-oidc-provider'
import {
  AccessToken,
  Account,
  AdapterFactory,
  AuthorizationCode,
  BackchannelAuthenticationRequest,
  DeviceCode,
  Interaction,
  JWKS,
  KoaContextWithOIDC,
  ResourceServer,
} from 'oidc-provider'
import { AbstractServiceStorage } from '~/_common/_abstracts/abstract.service.storage'
import { StorageService } from '~/storage/storage.service'
import { isPkceRequired } from './_functions/is-pkce-required.function'
import { findAccount } from './_functions/find-account.function'
import { issueRefreshToken } from './_functions/issue-refresh-token.function'
import { introspectionAllowedPolicy } from './_functions/_features/introspection.function'
import {
  resourceIndicatorsDefaultResource,
  resourceIndicatorsGetResourceServerInfo,
} from './_functions/_features/resource-indicators.function'

@Injectable()
export class OidcConfigService implements OidcModuleOptionsFactory, OnModuleInit {
  private readonly logger = new Logger(OidcConfigService.name)

  public constructor(
    private readonly dbService: AbstractServiceStorage,
    private readonly configService: ConfigService,
  ) {}

  public async onModuleInit() {
    //TODO: parse and validate the configuration yml file
    this.logger.debug('onModuleInit')
  }

  public createModuleOptions(): OidcModuleOptions | Promise<OidcModuleOptions> {
    return {
      issuer: this.configService.get('oidc.issuer'),
      oidc: this.getConfiguration(),
      path: '/oidc',
      // proxy: true,
    }
  }

  public createAdapterFactory(): AdapterFactory | Promise<AdapterFactory> {
    return (modelName: string) => new StorageService(modelName, this.dbService)
  }

  /**
   * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#configuration-options
   * @returns OidcConfiguration
   */
  public getConfiguration(): OidcConfiguration {
    return {
      clients: [
        {
          client_id: 'test',
          client_secret: 'test',
          grant_types: [
            'implicit',
            // 'client_credentials',
            'authorization_code',
            'refresh_token',
            'urn:ietf:params:oauth:grant-type:device_code',
          ],
          token_endpoint_auth_method: 'none',
          // application_type: 'web',
          response_types: ['code'],
          redirect_uris: [
            'https://oidcdebugger.com/debug',
            'https://127.0.0.1:3000/login',
            'https://127.0.0.1:3000/',
            'https://psteniusubi.github.io/oidc-tester/authorization-code-flow.html',
          ],
        },
      ],
      features: {
        devInteractions: { enabled: false },
        userinfo: { enabled: true },
        jwtUserinfo: { enabled: true },
        deviceFlow: { enabled: true },
        clientCredentials: { enabled: true },
        revocation: { enabled: true },
        encryption: { enabled: true },

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
      issueRefreshToken: issueRefreshToken,

      /**
       * The `findAccount` function is responsible for retrieving the account information for a given subject (user) and token.
       * It is called by the OIDC provider when it needs to generate an ID token or access token for a user.
       * The function should return an object that implements the `Account` interface, which includes the user's claims and a method to retrieve those claims.
       *
       * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#accounts
       */
      findAccount: findAccount,

      /**
       * PKCE (Proof Key for Code Exchange) is a security extension to the Authorization Code flow,
       * that mitigates the risk of authorization code interception attacks.
       *
       * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#pkce
       */
      pkce: {
        required: isPkceRequired,
      },

      /**
       * Interaction URL generation depends on the type of interaction.
       * The default is to use the interaction's uid as a path parameter,
       * but you can customize this to include additional information or use a different format.
       *
       * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#interactions
       */
      interactions: {
        // policy: [],
        url(_ctx: KoaContextWithOIDC, interaction: Interaction) {
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
      jwks: this.configService.get<JWKS>('oidc.jwks', undefined),

      /**
       * Load additional configuration from environment variables or configuration files
       *
       * @var config OidcConfiguration
       */
      ...this.configService.get<OidcConfiguration>('oidc'),
    }
  }
}
