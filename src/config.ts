import { Logger, NestApplicationOptions } from '@nestjs/common'
import Joi from 'joi'
import { getLogLevel } from './_common/_functions/get-log-level'
import { SwaggerCustomOptions } from '@nestjs/swagger'
import { OidcConfiguration } from 'nest-oidc-provider'
import { existsSync } from 'fs'
import { exportJWK, generateKeyPair } from 'jose'
import { readFile, writeFile } from 'fs/promises'

export const validationSchema = Joi.object({
  CARTULAIRE_LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'verbose').default('debug'),

  CARTULAIRE_STORAGE_ADAPTER: Joi.string().valid('memory', 'redis').default('memory'),

  CARTULAIRE_OIDC_ISSUER: Joi.string().uri().default('http://localhost:9000'),

  CARTULAIRE_OIDC_COOKIE_KEYS: Joi.string().custom((value, helpers) => {
    const keys = value.split(',')
    if (keys.length === 0) {
      return helpers.error('any.invalid')
    }
    return keys
  }),
})

export interface ConfigInstance {
  application: NestApplicationOptions

  storage: {
    adapter: 'memory' | 'redis'
  }

  oidc: OidcConfiguration & {
    issuer: string
  }

  swagger: {
    path?: string
    api?: string
    options?: SwaggerCustomOptions
  }
}

export default async (): Promise<ConfigInstance> => {
  const jwks = { keys: [] }
  const keyFile = './keys.json'

  if (!existsSync(keyFile)) {
    Logger.debug('Key file does not exist, generating new key file')
    const { privateKey } = await generateKeyPair('RS256', { extractable: true })
    jwks.keys = [await exportJWK(privateKey)]
    await writeFile(keyFile, JSON.stringify(jwks))
    Logger.debug('Key file generated')
  } else {
    jwks.keys = JSON.parse(await readFile(keyFile, 'utf8')).keys
    Logger.debug('Key file already exists, skipping key generation')
  }

  return {
    application: {
      logger: getLogLevel(process.env['CARTULAIRE_LOG_LEVEL']),
      cors: true,
    },

    storage: {
      adapter: process.env['CARTULAIRE_STORAGE_ADAPTER'] as 'memory' | 'redis',
    },

    oidc: {
      jwks,
      issuer: process.env['CARTULAIRE_OIDC_ISSUER'],
      // clients: [],
      ttl: {
        AccessToken: 3600,
        AuthorizationCode: 600,
        ClientCredentials: 600,
        IdToken: 3600,
        RefreshToken: 1209600,
      },
      cookies: {
        keys: process.env['CARTULAIRE_OIDC_COOKIE_KEYS'],
      },
    },

    swagger: {
      path: 'swagger',
      api: '/swagger/json',
      options: {},
    },
  }
}
