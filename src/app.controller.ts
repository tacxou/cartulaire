import { Controller, Get, Res } from '@nestjs/common'
import { AppService } from './app.service'
import { Response } from 'express'

@Controller()
export class AppController {
  public constructor(private readonly service: AppService) {}
  @Get()
  public async index(@Res() res: Response) {
    return res.render('pages/index')
  }

  @Get('version')
  public async getInfos() {
    return this.service.getInfos()
  }
}
