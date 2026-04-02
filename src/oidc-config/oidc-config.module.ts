import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { RedisModule } from '@nestjs-modules/ioredis'
import { RedisOptions } from 'ioredis'
import { OidcConfigService } from './oidc-config.service'
import { StorageModule } from '~/storage/storage.module'
import { ClientsModule } from '~/clients/clients.module'
import { JwksModule } from '~/jwks/jwks.module'

const redisEnabled = process.env['CARTULAIRE_STORAGE_ADAPTER'] === 'redis'

@Module({
  imports: [
    ClientsModule,
    JwksModule,
    StorageModule.registerAsync({
      imports: [
        ConfigModule,
        ...(redisEnabled
          ? [
              RedisModule.forRootAsync({
                imports: [ConfigModule],
                inject: [ConfigService],
                useFactory: async (config: ConfigService) => ({
                  type: 'single',
                  url: config.get<string>('ioredis.uri'),
                  options: config.get<RedisOptions>('ioredis.options'),
                }),
              }),
            ]
          : []),
      ],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        adapter: config.get<'memory' | 'redis'>('storage.adapter', 'memory'),
      }),
    }),
  ],
  providers: [OidcConfigService],
  exports: [OidcConfigService],
})
export class OidcConfigModule {}
