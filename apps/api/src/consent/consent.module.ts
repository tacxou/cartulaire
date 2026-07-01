import { Global, Module } from '@nestjs/common'
import { ConsentService } from './consent.service'

/**
 * Module global : la délégation de consentement/session est utilisée par le
 * contrôleur d'interaction (confirm) et par la configuration OIDC (loadExistingGrant).
 */
@Global()
@Module({
  providers: [ConsentService],
  exports: [ConsentService],
})
export class ConsentModule {}
