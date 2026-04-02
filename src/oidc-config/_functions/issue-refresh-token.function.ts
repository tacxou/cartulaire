import {
  AuthorizationCode,
  BackchannelAuthenticationRequest,
  Client,
  DeviceCode,
  KoaContextWithOIDC,
} from 'oidc-provider'

export function issueRefreshToken(
  _ctx: KoaContextWithOIDC,
  client: Client,
  code: AuthorizationCode | DeviceCode | BackchannelAuthenticationRequest,
) {
  // console.log('issueRefreshToken', client, code)
  return (
    client.grantTypeAllowed('refresh_token') &&
    (code.scopes.has('offline_access') || code.scopes.has('openid') || code.scopes.has('token'))
  )
}
