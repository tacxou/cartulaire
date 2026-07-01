import { Global, Module } from '@nestjs/common'
import { IdentityService } from './identity.service'

/**
 * Module global : la passerelle d'identité est utilisée par le contrôleur
 * d'interaction (login) et par la configuration OIDC (findAccount → claims.map).
 */
@Global()
@Module({
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
