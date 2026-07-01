import { DynamicModule, Module, Provider } from '@nestjs/common'
import { ModuleMetadata } from '@nestjs/common/interfaces'
import { getRedisConnectionToken } from '@nestjs-modules/ioredis'
import Redis from 'ioredis'
import { LruAdapter } from './_adapters/lru.adapter'
import { IoredisAdapter } from './_adapters/ioredis.adapter'
import { ConfigInstance } from '~/config'
import { AbstractServiceStorage } from '~/_common/_abstracts/abstract.service.storage'

export interface StorageModuleOptions {
  adapter: 'memory' | 'redis'
}

export interface StorageModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  inject?: any[]
  useFactory: (...args: any[]) => Promise<StorageModuleOptions> | StorageModuleOptions
}

export const STORAGE_MODULE_OPTIONS = Symbol('STORAGE_MODULE_OPTIONS')
export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER')

@Module({
  providers: [],
  exports: [],
})
export class StorageModule {
  public static register(config: ConfigInstance): DynamicModule {
    const adapters = []

    switch (config.storage.adapter) {
      case 'memory':
        adapters.push(LruAdapter)
        break

      case 'redis':
        adapters.push(IoredisAdapter)
        break
    }

    return {
      module: this,
      imports: Reflect.getMetadata('imports', this),
      controllers: Reflect.getMetadata('controllers', this),
      providers: [...Reflect.getMetadata('providers', this), ...adapters],
      exports: [...Reflect.getMetadata('exports', this), ...adapters],
    }
  }

  public static registerAsync(options: StorageModuleAsyncOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: STORAGE_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    }

    const adapterProvider: Provider = {
      provide: STORAGE_ADAPTER,
      useFactory: (storageOptions: StorageModuleOptions, redis?: Redis) => {
        if (storageOptions.adapter === 'redis') {
          if (!redis) {
            throw new Error('Redis adapter requires RedisModule to be imported')
          }

          return new IoredisAdapter(redis)
        }

        return new LruAdapter()
      },
      inject: [
        STORAGE_MODULE_OPTIONS,
        {
          token: getRedisConnectionToken(),
          optional: true,
        },
      ],
    }

    const abstractProvider: Provider = {
      provide: AbstractServiceStorage,
      useExisting: STORAGE_ADAPTER,
    }

    return {
      module: this,
      imports: options.imports ?? [],
      providers: [optionsProvider, adapterProvider, abstractProvider],
      exports: [STORAGE_ADAPTER, AbstractServiceStorage],
    }
  }
}
