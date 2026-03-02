import {
  AccessToken,
  Account,
  AuthorizationCode,
  BackchannelAuthenticationRequest,
  DeviceCode,
  KoaContextWithOIDC,
} from 'oidc-provider'

export function findAccount(
  _ctx: KoaContextWithOIDC,
  sub: string,
  token?: AuthorizationCode | AccessToken | DeviceCode | BackchannelAuthenticationRequest,
): Account {
  console.log('findAccount', sub, token)
  return {
    emailVerified: true,
    email: 'ebrahimmfadae@gmail.com',
    accountId: sub,
    aaa: 'bbb',
    async claims(_, scope) {
      console.log('claims', scope)
      return {
        sub,
        email: sub,
        family_name: '1',
        name: '1',
        // email: account.email,
        // email_verified: account.email_verified,
        // name: account.name,
        // given_name: account.given_name,
        // family_name: account.family_name,
        // picture: account.picture,
        // locale: account.locale,
        // updated_at: account.updated_at,
      }
    },
  }
}
