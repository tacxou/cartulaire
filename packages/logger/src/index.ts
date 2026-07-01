import pino, { type Logger, type LoggerOptions } from 'pino'

/**
 * Champs à ne JAMAIS journaliser (SPEC §34.1). La redaction Pino remplace ces
 * chemins par `[Redacted]` avant écriture.
 */
export const REDACTED_PATHS = [
  'password',
  '*.password',
  'secret',
  '*.secret',
  'clientSecret',
  '*.clientSecret',
  'token',
  '*.token',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'authorization',
  '*.authorization',
  'cookie',
  '*.cookie',
  'mfaCode',
  '*.mfaCode',
  'signature',
  '*.signature',
]

export interface CreateLoggerOptions {
  /** Nom du service (api, daemon, connector.mock, …). */
  name: string
  /** Niveau de log. Défaut : `info` (ou $CARTULAIRE_LOG_LEVEL). */
  level?: string
  /** Active le rendu lisible (`pino-pretty`) — dev uniquement. */
  pretty?: boolean
}

/**
 * Crée un logger structuré JSON avec redaction des secrets par défaut.
 * Chaque log métier devrait porter `traceId`, `requestId`, `clientId`, etc.
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  const level = options.level ?? process.env['CARTULAIRE_LOG_LEVEL'] ?? 'info'

  const base: LoggerOptions = {
    name: options.name,
    level,
    redact: { paths: REDACTED_PATHS, censor: '[Redacted]' },
    formatters: {
      level: (label) => ({ level: label }),
    },
  }

  if (options.pretty) {
    return pino({
      ...base,
      transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } },
    })
  }

  return pino(base)
}

export type { Logger }
