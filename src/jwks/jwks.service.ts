import { Injectable, Logger } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validateSync, ValidationError } from 'class-validator'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { exportJWK, generateKeyPair } from 'jose'
import { join } from 'node:path'
import { JwksDto } from './jwks.dto'

export type Jwks = { keys: unknown[] }

const JWKS_FILE = 'keys.json'

@Injectable()
export class JwksService {
  private readonly logger = new Logger(JwksService.name)
  private readonly _filePath: string

  public get filePath(): string {
    return this._filePath
  }

  public constructor() {
    this._filePath = this.resolveJwksPath()
  }

  public async loadOrCreate(filePath: string = this.filePath): Promise<Jwks> {
    const jwks: Jwks = { keys: [] }

    if (!existsSync(filePath)) {
      this.logger.debug(`Fichier JWKS introuvable (${filePath}), génération…`)
      const { privateKey } = await generateKeyPair('RS256', { extractable: true })
      jwks.keys = [await exportJWK(privateKey)]
      await writeFile(filePath, JSON.stringify(jwks))
      this.logger.debug(`Fichier JWKS généré (${filePath})`)
      return jwks
    }

    const raw = JSON.parse(await readFile(filePath, 'utf8')) as object
    const dto = plainToInstance(JwksDto, raw)
    const errors = validateSync(dto, { whitelist: true, forbidNonWhitelisted: false })
    if (errors.length) {
      throw new Error(`config/${JWKS_FILE} invalide :\n${this.formatValidationErrors(errors).join('\n')}`)
    }

    jwks.keys = dto.keys
    this.logger.debug(`Fichier JWKS chargé (${filePath})`)
    return jwks
  }

  private resolveJwksPath(): string {
    const candidates = [
      join(process.cwd(), JWKS_FILE),
      join(__dirname, '..', '..', JWKS_FILE),
      join(__dirname, '..', JWKS_FILE),
    ]
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
    return candidates[0]
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

