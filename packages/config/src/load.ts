import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import { cartulaireConfigSchema, type CartulaireConfig } from './schema'

/** Erreur de configuration — message explicite pour un fail-fast lisible (§32). */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

/** Parse et valide une configuration Cartulaire depuis une chaîne YAML. */
export function parseConfig(yaml: string): CartulaireConfig {
  let raw: unknown
  try {
    raw = parseYaml(yaml)
  } catch (e) {
    throw new ConfigError(`YAML invalide: ${e instanceof Error ? e.message : String(e)}`)
  }

  const result = cartulaireConfigSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(racine)'}: ${i.message}`)
      .join('\n')
    throw new ConfigError(`Configuration invalide:\n${issues}`)
  }
  return result.data
}

/** Charge et valide la configuration depuis un fichier YAML (fail-fast). */
export function loadConfig(path: string): CartulaireConfig {
  let content: string
  try {
    content = readFileSync(path, 'utf8')
  } catch (e) {
    throw new ConfigError(`Impossible de lire la configuration ${path}: ${e instanceof Error ? e.message : String(e)}`)
  }
  return parseConfig(content)
}

/** Résout un secret référencé par nom de variable d'environnement (§32.1). */
export function resolveSecretEnv(envName: string | undefined): string | undefined {
  if (!envName) return undefined
  return process.env[envName]
}
