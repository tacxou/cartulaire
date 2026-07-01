import { Controller, Get, Res } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppService } from './app.service'
import { ThemesService } from './themes/themes.service'
import { Response } from 'express'

function issuerHostFromUri(issuer: string): string {
  if (!issuer) return 'localhost'
  try {
    const withProto = /^https?:\/\//i.test(issuer) ? issuer : `https://${issuer}`
    return new URL(withProto).host
  } catch {
    return issuer.replace(/^https?:\/\//i, '').split('/')[0] || 'localhost'
  }
}

@Controller()
export class AppController {
  public constructor(
    private readonly service: AppService,
    private readonly config: ConfigService,
    private readonly themes: ThemesService,
  ) {}

  @Get()
  public async index(@Res() res: Response) {
    const issuer = this.config.get<string>('oidc.issuer') ?? ''
    return res.render('pages/index', { issuerHost: issuerHostFromUri(issuer) })
  }

  @Get('themes')
  public listThemes() {
    const active = this.themes.getActiveTheme().id
    return {
      active,
      themes: this.themes.getAvailableThemes(),
    }
  }

  @Get('version')
  public async getInfos() {
    return this.service.getInfos()
  }
}
