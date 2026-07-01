import { Module } from '@nestjs/common'
import { ClientsModule } from '~/clients/clients.module'
import { ConsentLabelsModule } from '~/consent-labels/consent-labels.module'
import { OidcConfigModule } from '~/oidc-config/oidc-config.module'
import { InteractionController } from './interaction.controller'

@Module({
  controllers: [InteractionController],
  imports: [OidcConfigModule, ConsentLabelsModule, ClientsModule],
})
export class InteractionModule {}
