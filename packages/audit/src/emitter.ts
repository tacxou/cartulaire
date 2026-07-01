import type { AuditEvent, AuditEventInput } from './events'

/**
 * Champs interdits dans un événement d'audit (SPEC §34.1) — retirés en profondeur
 * avant émission, quel que soit l'endroit où ils apparaissent dans `data`.
 */
const FORBIDDEN_KEYS = new Set([
  'password',
  'secret',
  'clientsecret',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'authorization',
  'cookie',
  'mfacode',
  'code',
  'signature',
])

/** Un sink reçoit chaque événement (stdout, fichier, microservice, SIEM…). */
export type AuditSink = (event: AuditEvent) => void

/** Sink par défaut : une ligne JSON par événement sur stdout (§35). */
export const stdoutJsonSink: AuditSink = (event) => {
  process.stdout.write(JSON.stringify(event) + '\n')
}

/** Sink de test/mémoire : accumule les événements. */
export function memorySink(): { sink: AuditSink; events: AuditEvent[] } {
  const events: AuditEvent[] = []
  return { sink: (e) => events.push(e), events }
}

export interface AuditEmitterOptions {
  /** Destination des événements. Défaut : stdout JSON. */
  sink?: AuditSink
  /** Nom du service émetteur (ajouté dans `data.service`). */
  service?: string
}

export interface AuditEmitter {
  emit(event: AuditEventInput): void
}

/** Retire récursivement les champs sensibles. */
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(k.toLowerCase())) {
        out[k] = '[Redacted]'
      } else {
        out[k] = redact(v)
      }
    }
    return out
  }
  return value
}

/**
 * Crée un émetteur d'audit. Chaque événement est horodaté et nettoyé de tout
 * secret avant d'être remis au sink.
 */
export function createAuditEmitter(options: AuditEmitterOptions = {}): AuditEmitter {
  const sink = options.sink ?? stdoutJsonSink
  const service = options.service
  return {
    emit(input: AuditEventInput): void {
      const event: AuditEvent = {
        ...input,
        timestamp: input.timestamp ?? new Date().toISOString(),
        data: redact({ ...(service ? { service } : {}), ...(input.data ?? {}) }) as Record<string, unknown>,
      }
      try {
        sink(event)
      } catch {
        // L'audit ne doit jamais faire échouer le flux applicatif.
      }
    },
  }
}
