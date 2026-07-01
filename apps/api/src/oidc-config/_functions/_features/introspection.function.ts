import { AccessToken, Client, ClientCredentials, KoaContextWithOIDC, RefreshToken } from 'oidc-provider'

/**
 * The `introspectionAllowedPolicy` function is responsible for determining whether a token introspection request should be allowed for a given client and token.
 * It is called by the OIDC provider when it receives a token introspection request, and it should return a boolean value indicating whether the request should be allowed.
 * The function can use the client and token information to make a decision about whether to allow the introspection request.
 * For example, it might check the client's authentication method or the token's client ID to determine whether the request should be allowed.
 *
 * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#interactionspolicy
 * @param ctx Koa request context
 * @param client Client instance
 * @param token Access token, client credentials or refresh token instance
 * @returns boolean
 */
export function introspectionAllowedPolicy(
  ctx: KoaContextWithOIDC,
  client: Client,
  token: AccessToken | ClientCredentials | RefreshToken,
) {
  console.log('introspection allowedPolicy', {
    client,
    token,
  })
  if (client.introspectionEndpointAuthMethod === 'none' && token.clientId !== ctx.oidc.client?.clientId) {
    return false
  }
  return true
}
