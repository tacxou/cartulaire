import { createServer, type Server } from 'node:http'
import { adminHealthResultSchema } from '@cartulaire/connector-contracts'
import {
  CARTULAIRE_HEADERS,
  dispatchCommand,
  type CommandDefinition,
  type CommandHandler,
} from './dispatch'

export interface ConnectorServerOptions {
  /** Nom lisible du connecteur (logs, health). */
  name: string
  /** Audience attendue — doit correspondre à celle configurée côté daemon. */
  audience: string
  /** Secret HMAC partagé avec le daemon. */
  secret: string
  /** Liste blanche des commandes autorisées (§26.4). */
  permissions: readonly string[]
  /** Commandes gérées, déclarées via `defineCommand`. */
  commands: CommandDefinition[]
  /** Fenêtre d'acceptation de l'horodatage (ms). */
  maxSkewMs?: number
}

/**
 * Crée un serveur connecteur minimal en `node:http` (SPEC §31.1).
 *
 * Expose `POST /commands` (protégé, signé) et `GET /health` (public). Aucun
 * framework requis : démontre que tout langage respectant le contrat HTTP signé
 * est compatible, le SDK n'étant qu'un confort.
 */
export function createConnectorServer(options: ConnectorServerOptions): Server {
  const handlers = new Map<string, CommandHandler>()
  for (const cmd of options.commands) {
    handlers.set(cmd.type, cmd.handler)
  }

  return createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      const body = adminHealthResultSchema.parse({ status: 'ok', connector: options.name })
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
      return
    }

    if (req.method !== 'POST' || req.url !== '/commands') {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'not_found' }))
      return
    }

    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', async () => {
      const rawBody = Buffer.concat(chunks).toString('utf8')
      const response = await dispatchCommand(
        rawBody,
        {
          signature: header(req.headers[CARTULAIRE_HEADERS.SIGNATURE]),
          timestamp: header(req.headers[CARTULAIRE_HEADERS.TIMESTAMP]),
        },
        {
          secret: options.secret,
          audience: options.audience,
          permissions: options.permissions,
          handlers,
          maxSkewMs: options.maxSkewMs,
        },
      )
      // On répond toujours 200 : le statut métier est porté par l'enveloppe.
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(response))
    })
  })
}

function header(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
