import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validateSync, ValidationError } from 'class-validator'
import { watch, FSWatcher } from 'chokidar'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { SettingsDto } from './settings.dto'

const SETTINGS_FILE = 'settings.yml'

@Injectable()
export class SettingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SettingsService.name)
  private settings: SettingsDto | null = null
  private watcher: FSWatcher | null = null
  private readonly _filePath: string

  public get filePath(): string {
    return this._filePath
  }

  public constructor() {
    this._filePath = this.resolveSettingsPath()
    this.load()
  }

  public onModuleInit(): void {
    this.watcher = watch(this._filePath, { ignoreInitial: true, persistent: false })
    this.watcher.on('change', () => {
      this.logger.log(`Changement detecte dans ${SETTINGS_FILE}, rechargement...`)
      this.load()
    })
  }

  public onModuleDestroy(): void {
    this.watcher?.close()
  }

  public getSettings(): SettingsDto {
    if (!this.settings) {
      throw new Error('Settings non charges')
    }
    return this.settings
  }

  public getBranding(): SettingsDto['branding'] {
    return this.getSettings().branding
  }

  public getPrefs(): SettingsDto['prefs'] {
    return this.getSettings().prefs
  }

  private load(): void {
    const raw = parseYaml(readFileSync(this._filePath, 'utf8'))
    const dto = plainToInstance(SettingsDto, raw as object, {
      enableImplicitConversion: true,
      exposeDefaultValues: true,
    })
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    })

    if (errors.length) {
      throw new Error(`config/${SETTINGS_FILE} invalide :\n${this.formatValidationErrors(errors).join('\n')}`)
    }

    this.settings = dto
    this.logger.log(`Settings charges depuis ${this.filePath}`)
  }

  private resolveSettingsPath(): string {
    const candidates = [
      join(__dirname, '..', '..', 'config', SETTINGS_FILE),
      join(__dirname, '..', 'config', SETTINGS_FILE),
      join(process.cwd(), 'config', SETTINGS_FILE),
    ]
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
    throw new Error(`${SETTINGS_FILE} introuvable. Chemins essayes :\n${candidates.join('\n')}`)
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

