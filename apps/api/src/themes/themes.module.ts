import { Module } from '@nestjs/common'
import { SettingsModule } from '~/settings/settings.module'
import { ThemesService } from './themes.service'
import { ViewContextMiddleware } from './view-context.middleware'

@Module({
  imports: [SettingsModule],
  providers: [ThemesService, ViewContextMiddleware],
  exports: [ThemesService, ViewContextMiddleware],
})
export class ThemesModule {}
