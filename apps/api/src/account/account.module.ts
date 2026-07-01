import { Module } from '@nestjs/common'
import { AccountController } from './account.controller'

/** Page de gestion du compte (utilise MfaService, fourni globalement par MfaModule). */
@Module({
  controllers: [AccountController],
})
export class AccountModule {}
