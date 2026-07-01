import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import chalk from 'chalk'
import { loadConfig } from './config'
import { AppModule } from './app.module'

const APP_NAME = 'DAEMON'

declare const module: any
;(async () => {
  Logger.log(chalk.bold.blue(`Starting ${APP_NAME} 🚀`), APP_NAME)
  const config = loadConfig()

  // rawBody: true expose req.rawBody (Buffer) — indispensable pour vérifier la
  // signature sur les octets exacts reçus (§26.2).
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(config), {
    rawBody: true,
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  })

  await app.listen(config.port, '0.0.0.0', () => {
    Logger.log(
      chalk.bold.blue(`Daemon en écoute sur http://0.0.0.0:${config.port} 🟢`),
      APP_NAME,
    )
    Logger.log(
      chalk.gray(`Connecteurs: ${config.connectors.map((c) => `${c.name}(${c.audience})`).join(', ')}`),
      APP_NAME,
    )
  })

  if (module.hot) {
    module.hot.accept()
    module.hot.dispose((): Promise<void> => app.close())
  }
})()
