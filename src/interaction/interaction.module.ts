import { Module } from '@nestjs/common'
import { ConsentLabelsModule } from '~/consent-labels/consent-labels.module'
import { OidcConfigModule } from '~/oidc-config/oidc-config.module'
import { InteractionController } from './interaction.controller'

@Module({
  controllers: [InteractionController],
  imports: [OidcConfigModule, ConsentLabelsModule],
})
export class InteractionModule {}
