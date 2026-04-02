import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import chalk from 'chalk'
import * as nunjucks from 'nunjucks'
import config from './config'
import pkg from '../package.json'
import swagger from './swagger'
import { AppModule } from './app.module'
import { urlencoded } from 'body-parser'

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'
const INTERNAL_NAME = process.env?.npm_package_name || pkg?.name!
const APP_NAME = INTERNAL_NAME.split('/').pop().toLocaleUpperCase()

declare const module: any
;(async () => {
  Logger.log(chalk.bold.blue(`Starting ${APP_NAME} 🚀`), `${chalk.bold.blue(APP_NAME)}\x1b[33m`)

  const cfg = await config()
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(cfg), cfg.application)

  const express = app.getHttpAdapter().getInstance()
  const nunjucksEnv = nunjucks.configure(cfg.oidc.viewsPath, {
    noCache: !cfg.oidc.isProduction,
    watch: !cfg.oidc.isProduction,
    express,
  })

  express.set('nunjucksEnv', nunjucksEnv)
  app.useStaticAssets(cfg.oidc.assetsPath)
  app.setBaseViewsDir(cfg.oidc.viewsPath)
  app.setViewEngine('njk')

  app.use('/interaction', urlencoded({ extended: false }))
  swagger(app)

  await app.listen(9000, () => {
    if (process.env.production !== 'production') {
      Logger.warn(chalk.redBright(`Running in development mode 🛠`), `${chalk.redBright(APP_NAME)}\x1b[33m`)
    }

    Logger.log(chalk.bold.blue(`Is now running on <http://0.0.0.0:9000> 🎥`), `${chalk.bold.blue(APP_NAME)}\x1b[33m`)
  })

  if (module.hot) {
    module.hot.accept()
    module.hot.dispose((): Promise<void> => app.close())
  }
})()
