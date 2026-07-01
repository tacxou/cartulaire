import { DynamicModule, MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import config, { ConfigInstance, validationSchema } from './config'
import { OidcModule } from 'nest-oidc-provider'
import { OidcConfigService } from './oidc-config/oidc-config.service'
import { OidcConfigModule } from './oidc-config/oidc-config.module'
import { InteractionModule } from './interaction/interaction.module'
import { IdentityModule } from './identity/identity.module'
import { ConsentModule } from './consent/consent.module'
import { SettingsModule } from './settings/settings.module'
import { ThemesModule } from './themes/themes.module'
import { ViewContextMiddleware } from './themes/view-context.middleware'
import { ServeStaticModule } from '@nestjs/serve-static'
import { join } from 'node:path'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config],
      validationSchema,
    }),
    IdentityModule,
    ConsentModule,
    SettingsModule,
    ThemesModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'static'),
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
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ViewContextMiddleware).forRoutes('*')
  }

  public static register(_config: ConfigInstance): DynamicModule {
    return {
      module: this,
      imports: Reflect.getMetadata('imports', this),
      controllers: Reflect.getMetadata('controllers', this),
      providers: Reflect.getMetadata('providers', this),
    }
  }
}
