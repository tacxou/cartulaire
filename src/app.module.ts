import { DynamicModule, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import config, { ConfigInstance, validationSchema } from './config'
import { OidcModule } from 'nest-oidc-provider'
import { OidcConfigService } from './oidc-config/oidc-config.service'
import { OidcConfigModule } from './oidc-config/oidc-config.module'
import { InteractionModule } from './interaction/interaction.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config],
      validationSchema,
    }),
    OidcModule.forRootAsync({
      imports: [OidcConfigModule],
      useExisting: OidcConfigService,
    }),
    InteractionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  public static register(_config: ConfigInstance): DynamicModule {
    return {
      module: this,
      imports: Reflect.getMetadata('imports', this),
      controllers: Reflect.getMetadata('controllers', this),
      providers: Reflect.getMetadata('providers', this),
    }
  }
}
