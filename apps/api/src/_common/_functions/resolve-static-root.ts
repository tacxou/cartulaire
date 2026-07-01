import { join } from 'node:path'

/**
 * Racine des assets de marque (`dist/static`, copié depuis `apps/api/static` par nest-cli).
 * @param compiledDir `__dirname` du module appelant (typ. `dist/` en exécution).
 */
export function resolveStaticRoot(compiledDir: string): string {
  return join(compiledDir, 'static')
}
