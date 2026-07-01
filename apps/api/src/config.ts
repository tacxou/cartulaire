import { Logger, NestApplicationOptions } from '@nestjs/common'
import Joi from 'joi'
import { getLogLevel } from './_common/_functions/get-log-level'
import { SwaggerCustomOptions } from '@nestjs/swagger'
import { OidcConfiguration } from 'nest-oidc-provider'
import { join } from 'node:path'

export const validationSchema = Joi.object({
  CARTULAIRE_LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'verbose').default('debug'),

  CARTULAIRE_STORAGE_ADAPTER: Joi.string().valid('memory', 'redis').default('memory'),

  CARTULAIRE_OIDC_ISSUER: Joi.string().uri().default('http://localhost:9000/oidc'),

  CARTULAIRE_OIDC_HOST: Joi.string().hostname().default('localhost'),

  CARTULAIRE_OIDC_PORT: Joi.number().port().default(9000),

  CARTULAIRE_OIDC_PROTOCOL: Joi.string().valid('http', 'https').default('http'),

  CARTULAIRE_OIDC_COOKIE_KEYS: Joi.string().min(16).required(),

  // Lien cœur (API) → daemon : URL et secret HMAC partagé (§12.1, §26.2).
  CARTULAIRE_DAEMON_URL: Joi.string().uri().default('http://localhost:8788/commands'),
  CARTULAIRE_API_DAEMON_SECRET: Joi.string().min(16).required(),
  // Audience du connecteur d'identité ciblé par le cœur (routé par le daemon).
  CARTULAIRE_IDENTITY_AUDIENCE: Joi.string().default('connector.mock'),
  CARTULAIRE_DAEMON_TIMEOUT_MS: Joi.number().positive().default(5000),
})

export interface ConfigInstance {
  application: NestApplicationOptions

  storage: {
    adapter: 'memory' | 'redis'
  }

  oidc: OidcConfiguration & {
    issuer: string
    host: string
    port: number
    protocol: 'http' | 'https'
    viewsPath: string
    assetsPath: string
    isProduction: boolean
  }

  daemon: {
    url: string
    secret: string
    identityAudience: string
    timeoutMs: number
  }

  swagger: {
    path?: string
    api?: string
    options?: SwaggerCustomOptions
  }
}

export default async (): Promise<ConfigInstance> => {
  const isProduction = process.env.NODE_ENV === 'production'
  const viewsPath = isProduction ? join(__dirname, 'views') : join(__dirname, '..', 'views')
  const assetsPath = isProduction ? join(__dirname, 'static') : join(__dirname, '..', 'static')

  return {
    application: {
      logger: getLogLevel(process.env['CARTULAIRE_LOG_LEVEL']),
      cors: true,
    },

    storage: {
      adapter: process.env['CARTULAIRE_STORAGE_ADAPTER'] as 'memory' | 'redis',
    },

    oidc: {
      issuer: process.env['CARTULAIRE_OIDC_ISSUER'],
      host: process.env['CARTULAIRE_OIDC_HOST'],
      port: parseInt(process.env['CARTULAIRE_OIDC_PORT']!),
      protocol: process.env['CARTULAIRE_OIDC_PROTOCOL'] as 'http' | 'https',
      isProduction,
      viewsPath,
      assetsPath,
      ttl: {
        AccessToken: 3600,
        AuthorizationCode: 600,
        ClientCredentials: 600,
        IdToken: 3600,
        RefreshToken: 1209600,
      },
      cookies: {
        keys: process.env['CARTULAIRE_OIDC_COOKIE_KEYS'].split(',').map((key) => Buffer.from(key, 'base64')),
      },
    },

    daemon: {
      url: process.env['CARTULAIRE_DAEMON_URL']!,
      secret: process.env['CARTULAIRE_API_DAEMON_SECRET']!,
      identityAudience: process.env['CARTULAIRE_IDENTITY_AUDIENCE']!,
      timeoutMs: parseInt(process.env['CARTULAIRE_DAEMON_TIMEOUT_MS'] ?? '5000', 10),
    },

    swagger: {
      path: 'swagger',
      api: '/swagger/json',
      options: {},
    },
  }
}
