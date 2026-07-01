import { Global, Module } from '@nestjs/common'
import { MfaService } from './mfa.service'

/** Module global : l'orchestration MFA est utilisée par le contrôleur d'interaction. */
@Global()
@Module({
  providers: [MfaService],
  exports: [MfaService],
})
export class MfaModule {}
