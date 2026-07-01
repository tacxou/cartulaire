import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import chalk from 'chalk'
import express from 'express'
import * as nunjucks from 'nunjucks'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PackageJson } from 'types-package-json'
import config from './config'
import swagger from './swagger'
import { AppModule } from './app.module'
import { urlencoded } from 'body-parser'
import { createThemeNunjucksEnvironment } from './themes/theme-loader'
import { ThemesService } from './themes/themes.service'

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'
const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as PackageJson
const INTERNAL_NAME = process.env?.npm_package_name || pkg.name!
const APP_NAME = INTERNAL_NAME.split('/').pop().toLocaleUpperCase()

declare const module: any
;(async () => {
  Logger.log(chalk.bold.blue(`Starting ${APP_NAME} 🚀`), `${chalk.bold.blue(APP_NAME)}\x1b[33m`)

  const cfg = await config()
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(cfg), cfg.application)

  const themesService = app.get(ThemesService)
  const expressApp = app.getHttpAdapter().getInstance()
  const isProduction = cfg.oidc.isProduction

  const { env: nunjucksEnv, loader: themeLoader } = createThemeNunjucksEnvironment({
    viewsPath: cfg.oidc.viewsPath,
    themesRoot: join(cfg.oidc.viewsPath, 'themes'),
    resolveThemeId: () => themesService.getActiveThemeId(),
    noCache: !isProduction,
  })
  themesService.registerLoader(themeLoader)

  expressApp.engine('njk', (filePath, options, callback) => {
    let templateName = filePath
    const viewsRoot = cfg.oidc.viewsPath
    if (filePath.startsWith(viewsRoot)) {
      templateName = filePath
        .slice(viewsRoot.length + 1)
        .replace(/\\/g, '/')
        .replace(/\.njk$/, '')
    }

    nunjucksEnv.render(templateName, options as Record<string, unknown>, callback)
  })

  expressApp.set('nunjucksEnv', nunjucksEnv)
  expressApp.set('view engine', 'njk')
  expressApp.set('views', cfg.oidc.viewsPath)

  expressApp.use('/theme-assets', (req, res, next) => {
    const assetsPath = themesService.getThemeAssetsPath()
    if (!existsSync(assetsPath)) {
      res.status(404).end()
      return
    }
    express.static(assetsPath)(req, res, next)
  })

  app.useStaticAssets(cfg.oidc.assetsPath)
  app.setBaseViewsDir(cfg.oidc.viewsPath)
  app.setViewEngine('njk')

  app.use('/interaction', urlencoded({ extended: false }))
  app.use('/account', urlencoded({ extended: false }))
  swagger(app)

  const port = cfg.oidc.port ?? 9000
  await app.listen(port, () => {
    if (process.env.production !== 'production') {
      Logger.warn(chalk.redBright(`Running in development mode 🛠`), `${chalk.redBright(APP_NAME)}\x1b[33m`)
    }

    Logger.log(chalk.bold.blue(`Is now running on <http://0.0.0.0:${port}> 🎥`), `${chalk.bold.blue(APP_NAME)}\x1b[33m`)
  })

  if (module.hot) {
    module.hot.accept()
    module.hot.dispose((): Promise<void> => app.close())
  }
})()
