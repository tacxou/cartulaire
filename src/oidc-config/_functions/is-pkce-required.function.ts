import { Client, KoaContextWithOIDC } from 'oidc-provider'

/**
 * Determine if PKCE is required for the given client and request context.
 * PKCE is required for public clients (those that do not have a client secret) and is recommended for all clients.
 *
 * @see https://www.rfc-editor.org/rfc/rfc7636.html#section-4.1
 * @see https://www.rfc-editor.org/rfc/rfc9700.html#section-2.1.1-2.2
 * @see https://www.rfc-editor.org/rfc/rfc9700.html#section-2.1.1-2.1
 * @see https://openid.net/specs/fapi-security-profile-2_0-final.html#section
 * @param ctx Koa request context
 * @param client Client instance
 * @returns boolean
 */
export function isPkceRequired(_ctx: KoaContextWithOIDC, client: Client): boolean {
  // All public clients MUST use PKCE as per
  // https://www.rfc-editor.org/rfc/rfc9700.html#section-2.1.1-2.1
  if (client.clientAuthMethod === 'none') {
    return true
  }

  // const fapiProfile = ctx.oidc.isFapi('2.0', '1.0 Final')
  // // FAPI 2.0 as per
  // // https://openid.net/specs/fapi-security-profile-2_0-final.html#section-5.3.2.2-2.5
  // if (fapiProfile === '2.0') {
  //   return true
  // }

  // In all other cases use of PKCE is RECOMMENDED as per
  // https://www.rfc-editor.org/rfc/rfc9700.html#section-2.1.1-2.2
  // but the server doesn't force them to.
  return false
}
