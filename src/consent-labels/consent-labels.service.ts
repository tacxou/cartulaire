import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validateSync, ValidationError } from 'class-validator'
import { watch, FSWatcher } from 'chokidar'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { ConsentClaimItemDto, ConsentLabelsDto, ConsentScopeItemDto } from './consent-labels.dto'

/** Fichier attendu : `config/consent-labels.yml` à la racine du dépôt ou copié sous `dist/config`. */
const CONSENT_LABELS_FILE = 'consent-labels.yml'

@Injectable()
export class ConsentLabelsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConsentLabelsService.name)
  private scopeDescriptions: Record<string, string> = {}
  private claimDescriptions: Record<string, string> = {}
  private watcher: FSWatcher | null = null
  private readonly _filePath: string

  public get filePath(): string {
    return this._filePath
  }

  public constructor() {
    this._filePath = this.resolveConsentLabelsPath()
    this.load()
  }

  public onModuleInit(): void {
    this.watcher = watch(this._filePath, { ignoreInitial: true, persistent: false })
    this.watcher.on('change', () => {
      this.logger.log(`Changement détecté dans ${CONSENT_LABELS_FILE}, rechargement…`)
      this.load()
    })
  }

  public onModuleDestroy(): void {
    this.watcher?.close()
  }

  public getScopeDescription(scope: string): string | null {
    return this.scopeDescriptions[scope] ?? null
  }

  public getClaimDescription(claim: string): string | null {
    return this.claimDescriptions[claim] ?? null
  }

  private load(): void {
    const raw = parseYaml(readFileSync(this._filePath, 'utf8'))
    const dto = plainToInstance(ConsentLabelsDto, raw as object, {
      enableImplicitConversion: true,
      exposeDefaultValues: true,
    })
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
    if (errors.length) {
      throw new Error(
        `config/${CONSENT_LABELS_FILE} invalide :\n${this.formatValidationErrors(errors).join('\n')}`,
      )
    }
    this.assertUniqueIds(
      dto.scopes.map((s: ConsentScopeItemDto) => s.id),
      'scopes',
    )
    this.assertUniqueIds(
      dto.claims.map((c: ConsentClaimItemDto) => c.id),
      'claims',
    )
    this.scopeDescriptions = Object.fromEntries(dto.scopes.map((s) => [s.id, s.description]))
    this.claimDescriptions = Object.fromEntries(dto.claims.map((c) => [c.id, c.description]))
    this.logger.log(`Libellés de consentement chargés depuis ${this.filePath}`)
  }

  private resolveConsentLabelsPath(): string {
    const candidates = [
      join(__dirname, '..', '..', 'config', CONSENT_LABELS_FILE),
      join(__dirname, '..', 'config', CONSENT_LABELS_FILE),
      join(process.cwd(), 'config', CONSENT_LABELS_FILE),
    ]
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
    throw new Error(
      `${CONSENT_LABELS_FILE} introuvable. Chemins essayés :\n${candidates.join('\n')}`,
    )
  }

  private assertUniqueIds(ids: string[], section: string): void {
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) {
        throw new Error(`config/${CONSENT_LABELS_FILE} : id dupliqué "${id}" dans ${section}`)
      }
      seen.add(id)
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
