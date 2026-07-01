import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { instanceToPlain, plainToInstance } from 'class-transformer'
import { validateSync, ValidationError } from 'class-validator'
import { watch, FSWatcher } from 'chokidar'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { ClientMetadata } from 'oidc-provider'
import { ClientDto, ClientsDto } from './clients.dto'

/** Fichier attendu : `config/clients.yml` à la racine du dépôt ou copié sous `dist/config`. */
const CLIENTS_FILE = 'clients.yml'

/** URIs de redirection injectées automatiquement en développement (NODE_ENV !== 'production'). */
const DEV_REDIRECT_URIS: string[] = [
  'https://oidcdebugger.com/debug',
]

@Injectable()
export class ClientsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClientsService.name)
  private clients: ClientMetadata[] = []
  private watcher: FSWatcher | null = null
  private readonly _filePath: string

  public get filePath(): string {
    return this._filePath
  }

  public constructor() {
    // Chargement synchrone dans le constructeur : disponible dès getConfiguration()
    this._filePath = this.resolveClientsPath()
    this.load()
  }

  public onModuleInit(): void {
    // Watcher de changements — rechargement à chaud du YAML
    this.watcher = watch(this._filePath, { ignoreInitial: true, persistent: false })
    this.watcher.on('change', () => {
      this.logger.log(`Changement détecté dans ${CLIENTS_FILE}, rechargement…`)
      this.load()
    })
  }

  public onModuleDestroy(): void {
    this.watcher?.close()
  }

  public getClients(): ClientMetadata[] {
    return this.clients
  }

  private load(): void {
    const raw = parseYaml(readFileSync(this._filePath, 'utf8'))
    const dto = plainToInstance(ClientsDto, raw as object, {
      enableImplicitConversion: true,
      exposeDefaultValues: true,
    })
    const errors = validateSync(dto, { whitelist: true, forbidNonWhitelisted: false })
    if (errors.length) {
      throw new Error(
        `config/${CLIENTS_FILE} invalide :\n${this.formatValidationErrors(errors).join('\n')}`,
      )
    }
    this.assertUniqueClientIds(dto.clients)
    this.clients = dto.clients.map((c: ClientDto) => instanceToPlain(c) as ClientMetadata)

    if (process.env.NODE_ENV !== 'production') {
      this.clients = this.clients.map((client) => ({
        ...client,
        redirect_uris: [...new Set([...(client.redirect_uris ?? []), ...DEV_REDIRECT_URIS])],
      }))
      this.logger.debug(`URIs de dev injectées : ${DEV_REDIRECT_URIS.join(', ')}`)
    }

    this.logger.log(`${this.clients.length} client(s) chargé(s) depuis ${this.filePath}`)
  }

  private resolveClientsPath(): string {
    const candidates = [
      join(__dirname, '..', '..', 'config', CLIENTS_FILE),
      join(__dirname, '..', 'config', CLIENTS_FILE),
      join(process.cwd(), 'config', CLIENTS_FILE),
    ]
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
    throw new Error(
      `${CLIENTS_FILE} introuvable. Chemins essayés :\n${candidates.join('\n')}`,
    )
  }

  private assertUniqueClientIds(clients: ClientDto[]): void {
    const seen = new Set<string>()
    for (const c of clients) {
      if (seen.has(c.client_id)) {
        throw new Error(`config/${CLIENTS_FILE} : client_id dupliqué "${c.client_id}"`)
      }
      seen.add(c.client_id)
    }
  }

  private formatValidationErrors(errors: ValidationError[], prefix = ''): string[] {
    const lines: string[] = []
    for (const e of errors) {
      const path = prefix ? `${prefix}.${e.property}` : e.property
      if (e.constraints) {
        for (const msg of Object.values(e.constraints)) {
          lines.push(`  - ${path}: ${msg}`)
        }
      }
      if (e.children?.length) {
        lines.push(...this.formatValidationErrors(e.children, path))
      }
    }
    return lines
  }
}
