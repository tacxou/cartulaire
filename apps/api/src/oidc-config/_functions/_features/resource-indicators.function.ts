import { Client, KoaContextWithOIDC, ResourceServer } from 'oidc-provider'

/**
 * The `resourceIndicatorsDefaultResource` function is responsible for determining the default resource indicator value for a given client and request context.
 * It is called by the OIDC provider when it needs to determine the default resource indicator value for a request that does not include a resource indicator.
 *
 * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#defaultresource
 * @param ctx Koa request context
 * @param client Client instance
 * @param oneOf Resource indicator value is one of the client's registered resource indicators
 * @returns string | string[]
 */
export function resourceIndicatorsDefaultResource(
  ctx: KoaContextWithOIDC,
  client: Client,
  oneOf?: string[] | undefined,
): string | string[] {
  console.log('defaultResource', oneOf, client)

  return ctx.oidc.issuer
}

/**
 * The `resourceIndicatorsGetResourceServerInfo` function is responsible for retrieving the resource server information for a given resource indicator and client.
 * It is called by the OIDC provider when it needs to determine the resource server information for a request that includes a resource indicator.
 *
 * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#getresourceserverinfo
 * @param _ctx Koa request context
 * @param resourceIndicator Resource indicator value
 * @param client Client instance
 * @returns ResourceServer
 */
export function resourceIndicatorsGetResourceServerInfo(
  _ctx: KoaContextWithOIDC,
  resourceIndicator: string,
  client: Client,
): ResourceServer {
  console.log('getResourceServerInfo', resourceIndicator, client)

  return <ResourceServer>{
    scope: client.scope,
    audience: 'resource-server-audience-value',
    accessTokenTTL: 2 * 60 * 60, // 2 hours
    accessTokenFormat: 'jwt',
    jwt: {
      sign: { alg: 'RS256' },
    },
  }
}
