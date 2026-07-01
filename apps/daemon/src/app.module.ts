import { DynamicModule, Module } from '@nestjs/common'
import type { DaemonConfig } from './config'
import { CommandsModule } from './commands/commands.module'

@Module({})
export class AppModule {
  static register(config: DaemonConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [CommandsModule.register(config)],
    }
  }
}
