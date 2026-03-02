import { Module } from '@nestjs/common'
import { InteractionController } from './interaction.controller'
import { OidcConfigModule } from '~/oidc-config/oidc-config.module'

@Module({
  controllers: [InteractionController],
  imports: [OidcConfigModule],
})
export class InteractionModule {}
