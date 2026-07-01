import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as nunjucks from 'nunjucks'

export interface ThemeLoaderOptions {
  viewsPath: string
  themesRoot: string
  resolveThemeId: () => string
  noCache: boolean
}

interface CachedSource {
  src: string
  path: string
  noCache: boolean
}

/**
 * Résout les templates Nunjucks avec priorité :
 * 1. themes/<actif>/views/<template>
 * 2. views/<template> (défaut)
 */
export class ThemeAwareLoader extends nunjucks.Loader {
  /** Cache des sources lues — distinct de `cache` injecté par nunjucks.Environment. */
  private readonly sourceCache = new Map<string, CachedSource>()

  /**
   * Cache des templates compilés, assigné par nunjucks.Environment._initLoaders().
   * Ne pas remplacer par une Map : nunjucks utilise un objet plain `{}`.
   */
  public cache: Record<string, unknown> = {}

  public constructor(private readonly options: ThemeLoaderOptions) {
    super()
  }

  public invalidateCache(): void {
    this.sourceCache.clear()
    this.cache = {}
  }

  public getSource(name: string): CachedSource | null {
    const cacheKey = `${this.options.resolveThemeId()}:${name}`
    if (!this.options.noCache && this.sourceCache.has(cacheKey)) {
      return this.sourceCache.get(cacheKey)!
    }

    const resolved = this.resolveTemplatePath(name)
    if (!resolved) return null

    const source: CachedSource = {
      src: readFileSync(resolved.path, 'utf8'),
      path: resolved.path,
      noCache: this.options.noCache,
    }

    if (!this.options.noCache) {
      this.sourceCache.set(cacheKey, source)
    }

    return source
  }

  private resolveTemplatePath(name: string): { path: string } | null {
    const normalized = name.replace(/\\/g, '/')
    const candidates = this.buildCandidatePaths(normalized)

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return { path: candidate }
      }
    }

    return null
  }

  private buildCandidatePaths(name: string): string[] {
    const themeId = this.options.resolveThemeId()
    const themeViewsRoot = join(this.options.themesRoot, themeId, 'views')
    const defaultViewsRoot = this.options.viewsPath

    const bases = [themeViewsRoot, defaultViewsRoot]
    const names = [name]
    if (!name.endsWith('.njk')) {
      names.push(`${name}.njk`)
    }

    const paths: string[] = []
    for (const base of bases) {
      for (const fileName of names) {
        paths.push(join(base, fileName))
      }
    }

    return paths
  }
}

export function createThemeNunjucksEnvironment(
  options: ThemeLoaderOptions,
): { env: nunjucks.Environment; loader: ThemeAwareLoader } {
  const loader = new ThemeAwareLoader(options)
  const env = new nunjucks.Environment(loader, {
    autoescape: true,
    noCache: options.noCache,
    watch: false,
  })
  return { env, loader }
}

export function scanThemeOverrides(themesRoot: string, themeId: string): {
  views: string[]
  css: string[]
  scripts: string[]
} {
  const themeDir = join(themesRoot, themeId)
  const views: string[] = []
  const css: string[] = []
  const scripts: string[] = []

  const viewsRoot = join(themeDir, 'views')
  if (existsSync(viewsRoot)) {
    collectFiles(viewsRoot, viewsRoot, ['.njk'], views)
  }

  const rootCss = join(themeDir, 'theme.css')
  if (existsSync(rootCss)) {
    css.push('theme.css')
  }

  const stylesDir = join(themeDir, 'assets', 'styles')
  if (existsSync(stylesDir)) {
    collectFiles(stylesDir, themeDir, ['.css'], css)
  }

  const globalJs = join(themeDir, 'assets', 'theme.js')
  if (existsSync(globalJs)) {
    scripts.push('assets/theme.js')
  }

  const pagesJsDir = join(themeDir, 'assets', 'pages')
  if (existsSync(pagesJsDir)) {
    collectFiles(pagesJsDir, themeDir, ['.js'], scripts)
  }

  return { views, css, scripts }
}

function collectFiles(
  dir: string,
  themeDir: string,
  extensions: string[],
  output: string[],
): void {
  if (!existsSync(dir)) return

  for (const entry of readdirSafe(dir)) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      collectFiles(fullPath, themeDir, extensions, output)
      continue
    }
    if (!extensions.some((ext) => entry.name.endsWith(ext))) continue
    output.push(fullPath.slice(themeDir.length + 1).replace(/\\/g, '/'))
  }
}

function readdirSafe(dir: string): Array<{ name: string; isDirectory: () => boolean }> {
  return readdirSync(dir, { withFileTypes: true })
}
