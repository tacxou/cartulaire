import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import chalk from 'chalk'
import express, { type Request, type Response } from 'express'
import helmet from 'helmet'
import * as nunjucks from 'nunjucks'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PackageJson } from 'types-package-json'
import config from './config'
import swagger from './swagger'
import { AppModule } from './app.module'
import { json, urlencoded } from 'body-parser'
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

  // Nonce par requête, consommé par les vues (`cspNonce`) et le CSP ci-dessous.
  app.use((_req: Request, res: Response, next: () => void) => {
    res.locals.cspNonce = randomBytes(16).toString('base64')
    next()
  })

  // Content-Security-Policy stricte — aucun CDN externe, scripts/styles noncés (§5, §24.4).
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", (_req: Request, res: Response) => `'nonce-${res.locals.cspNonce}'`],
          scriptSrcAttr: ["'none'"],
          styleSrcElem: [
            "'self'",
            (_req: Request, res: Response) => `'nonce-${res.locals.cspNonce}'`,
            'https://fonts.googleapis.com',
          ],
          // Les attributs style="" (utilisés dans les vues) ne peuvent pas être noncés :
          // seuls les éléments <style>/<script> le peuvent. Portée volontairement
          // limitée aux attributs de style, sans affaiblir script-src.
          styleSrcAttr: ["'unsafe-inline'"],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          // Pas de restriction form-action : oidc-provider soumet la réponse
          // d'autorisation vers le redirect_uri du client (response_mode=form_post),
          // par nature cross-origin. La liste blanche des redirect_uri est déjà
          // appliquée par oidc-provider lui-même — ce n'est pas le rôle du CSP.
          // (`null` désactive le défaut form-action:'self' fourni par helmet.)
          formAction: null,
          frameAncestors: ["'none'"],
        },
      },
    }),
  )

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
  app.use('/account', json()) // endpoints WebAuthn (start/finish) en JSON

  // Rate limiting des endpoints sensibles (SPEC §37).
  if (cfg.rateLimit.enabled) {
    const { FixedWindowRateLimiter, rateLimit } = await import('./_common/_rate-limit/rate-limiter')
    const tp = cfg.rateLimit.trustProxy
    const loginLimiter = new FixedWindowRateLimiter(cfg.rateLimit.login.windowMs, cfg.rateLimit.login.max)
    const oauthLimiter = new FixedWindowRateLimiter(cfg.rateLimit.oauth.windowMs, cfg.rateLimit.oauth.max)
    app.use('/interaction', rateLimit({ name: 'login', limiter: loginLimiter, trustProxy: tp, methods: ['POST'] }))
    app.use('/oidc/token', rateLimit({ name: 'token', limiter: oauthLimiter, trustProxy: tp, json: true }))
    app.use('/oidc/device', rateLimit({ name: 'device', limiter: oauthLimiter, trustProxy: tp, json: true }))
    app.use('/oidc/me', rateLimit({ name: 'userinfo', limiter: oauthLimiter, trustProxy: tp, json: true }))
  }

  // Protection CSRF des formulaires (login, MFA, consentement, compte) — SPEC §25.
  {
    const { csrfProtection } = await import('./_common/_csrf/csrf')
    const csrf = csrfProtection({ secure: cfg.oidc.isProduction })
    app.use('/interaction', csrf)
    app.use('/account', csrf)
  }

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
