import { DynamicModule, Module } from '@nestjs/common'
import type { DaemonConfig } from '../config'
import { DAEMON_CONFIG } from '../constants'
import { CommandsController } from './commands.controller'
import { CommandsService } from './commands.service'

@Module({})
export class CommandsModule {
  static register(config: DaemonConfig): DynamicModule {
    return {
      module: CommandsModule,
      controllers: [CommandsController],
      providers: [{ provide: DAEMON_CONFIG, useValue: config }, CommandsService],
    }
  }
}
