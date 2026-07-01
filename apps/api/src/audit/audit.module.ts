import { Global, Module } from '@nestjs/common'
import { AuditService } from './audit.service'

/** Module global : l'audit est émis depuis l'interaction, le consentement et la config OIDC. */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
