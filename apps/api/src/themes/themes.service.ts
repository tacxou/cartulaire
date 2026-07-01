import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { watch, FSWatcher } from 'chokidar'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { SettingsService } from '~/settings/settings.service'
import { scanThemeOverrides, ThemeAwareLoader } from './theme-loader'
import { ThemeManifestDto, ThemeViewContext, ViewLocals } from './themes.dto'

const THEME_FILE = 'theme.yml'
const BASE_THEME_DIR = '_base'

@Injectable()
export class ThemesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ThemesService.name)
  private readonly viewsPath: string
  private readonly themesRoot: string
  private readonly baseCss: string
  private manifests = new Map<string, ThemeManifestDto>()
  private pageScripts = new Map<string, Map<string, string>>()
  private watcher: FSWatcher | null = null
  private themeLoader: ThemeAwareLoader | null = null

  public constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {
    this.viewsPath = this.config.get<string>('oidc.viewsPath')!
    this.themesRoot = join(this.viewsPath, 'themes')
    this.baseCss = this.readBaseCss()
    this.discoverThemes()
  }

  public registerLoader(loader: ThemeAwareLoader): void {
    this.themeLoader = loader
  }

  public onModuleInit(): void {
    this.watcher = watch(this.themesRoot, {
      ignoreInitial: true,
      persistent: false,
      depth: 6,
    })
    this.watcher.on('change', (path) => {
      this.logger.log(`Changement détecté dans les thèmes (${path}), rechargement…`)
      this.discoverThemes()
      this.themeLoader?.invalidateCache()
    })
    this.watcher.on('add', (path) => {
      this.logger.log(`Fichier thème ajouté (${path}), rechargement…`)
      this.discoverThemes()
      this.themeLoader?.invalidateCache()
    })
    this.watcher.on('unlink', (path) => {
      this.logger.log(`Fichier thème supprimé (${path}), rechargement…`)
      this.discoverThemes()
      this.themeLoader?.invalidateCache()
    })
  }

  public onModuleDestroy(): void {
    this.watcher?.close()
  }

  public getActiveThemeId(): string {
    return this.settings.getUi().theme
  }

  public getThemeAssetsPath(themeId?: string): string {
    const id = themeId ?? this.getActiveThemeId()
    return join(this.themesRoot, id, 'assets')
  }

  public getAvailableThemes(): Array<{
    id: string
    name: string
    description?: string
    overrides?: ViewLocals['theme']['overrides']
  }> {
    return [...this.manifests.values()].map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      overrides: scanThemeOverrides(this.themesRoot, m.id),
    }))
  }

  public getActiveTheme(pageKey?: string): ThemeViewContext {
    const ui = this.settings.getUi()
    const manifest = this.manifests.get(ui.theme)
    if (!manifest) {
      throw new Error(
        `Thème "${ui.theme}" introuvable. Thèmes disponibles : ${[...this.manifests.keys()].join(', ')}`,
      )
    }
    return this.buildThemeContext(manifest, ui.themeOverrides, pageKey)
  }

  public getPageScript(themeId: string, pageKey: string): string | undefined {
    return this.pageScripts.get(themeId)?.get(pageKey)
  }

  public getViewLocals(pageKey?: string): ViewLocals {
    const branding = this.settings.getBranding()
    const prefs = this.settings.getPrefs()
    const theme = this.getActiveTheme(pageKey)

    return {
      theme,
      branding,
      prefs,
      availableThemes: this.getAvailableThemes(),
    }
  }

  public resolveTemplatePageKey(template: string): string {
    return template.replace(/^pages\//, '').replace(/\.njk$/, '')
  }

  private discoverThemes(): void {
    if (!existsSync(this.themesRoot)) {
      throw new Error(`Dossier themes introuvable : ${this.themesRoot}`)
    }

    const next = new Map<string, ThemeManifestDto>()
    const nextPageScripts = new Map<string, Map<string, string>>()

    for (const entry of readdirSync(this.themesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('_')) continue

      const themePath = join(this.themesRoot, entry.name, THEME_FILE)
      if (!existsSync(themePath)) continue

      const manifest = this.loadManifest(themePath)
      if (manifest.id !== entry.name) {
        throw new Error(
          `Thème ${entry.name} : l'id "${manifest.id}" ne correspond pas au nom du dossier`,
        )
      }
      next.set(manifest.id, manifest)
      nextPageScripts.set(manifest.id, this.loadPageScripts(manifest.id))
    }

    if (next.size === 0) {
      throw new Error(`Aucun thème trouvé dans ${this.themesRoot}`)
    }

    this.manifests = next
    this.pageScripts = nextPageScripts
    this.logger.log(`${next.size} thème(s) chargé(s) depuis ${this.themesRoot}`)
  }

  private loadManifest(filePath: string): ThemeManifestDto {
    const raw = parseYaml(readFileSync(filePath, 'utf8')) as Record<string, unknown>
    const variables = (raw.variables ?? {}) as Record<string, string>
    const fontGoogleUrl =
      typeof raw['font-google-url'] === 'string'
        ? raw['font-google-url']
        : typeof variables['font-google-url'] === 'string'
          ? variables['font-google-url']
          : undefined

    const dto = plainToInstance(
      ThemeManifestDto,
      {
        id: raw.id,
        name: raw.name,
        description: raw.description,
        version: raw.version,
        author: raw.author,
        variables,
        fontGoogleUrl,
      },
      { enableImplicitConversion: true },
    )

    const errors = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true })
    if (errors.length) {
      throw new Error(`Manifeste de thème invalide (${filePath})`)
    }

    return dto
  }

  private loadPageScripts(themeId: string): Map<string, string> {
    const pagesDir = join(this.themesRoot, themeId, 'assets', 'pages')
    const scripts = new Map<string, string>()
    if (!existsSync(pagesDir)) return scripts

    for (const entry of readdirSync(pagesDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.js')) continue
      const pageKey = entry.name.replace(/\.js$/, '')
      scripts.set(pageKey, readFileSync(join(pagesDir, entry.name), 'utf8'))
    }

    return scripts
  }

  private buildThemeContext(
    manifest: ThemeManifestDto,
    overrides: Record<string, string> = {},
    pageKey?: string,
  ): ThemeViewContext {
    const merged = { ...manifest.variables, ...overrides }
    const { fontGoogleUrl: _fontUrl, ...cssVars } = merged
    void _fontUrl

    const themeDir = join(this.themesRoot, manifest.id)
    const overrideCss = this.readOptionalFile(join(themeDir, 'theme.css'))
    const extraCss = this.readStylesheets(join(themeDir, 'assets', 'styles'))

    const variablesBlock = Object.entries(cssVars)
      .filter(([key]) => !key.startsWith('font-'))
      .map(([key, value]) => `  --${key}: ${value};`)
      .join('\n')

    const branding = this.settings.getBranding()
    const brandingVars = [
      `  --bg-image: url('${branding.backgroundImage}');`,
      `  --color-bg-body: ${branding.backgroundColor};`,
      `  --bg-overlay-opacity: ${branding.backgroundColorOpacity};`,
    ].join('\n')

    const styles = [
      ':root {',
      variablesBlock,
      brandingVars,
      '}',
      this.baseCss,
      overrideCss,
      ...extraCss,
    ]
      .filter(Boolean)
      .join('\n\n')

    const globalScript = this.readOptionalFile(join(themeDir, 'assets', 'theme.js'))
    const pageScript = pageKey ? this.pageScripts.get(manifest.id)?.get(pageKey) : undefined

    return {
      id: manifest.id,
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      author: manifest.author,
      fontGoogleUrl: manifest.fontGoogleUrl ?? merged['font-google-url'],
      styles,
      scripts: {
        global: globalScript || undefined,
        page: pageScript,
      },
      overrides: scanThemeOverrides(this.themesRoot, manifest.id),
      assetsBaseUrl: '/theme-assets',
    }
  }

  private readStylesheets(stylesDir: string): string[] {
    if (!existsSync(stylesDir)) return []

    const files: string[] = []
    for (const entry of readdirSync(stylesDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.css')) {
        files.push(join(stylesDir, entry.name))
      }
    }

    return files
      .sort((a, b) => a.localeCompare(b))
      .map((file) => readFileSync(file, 'utf8'))
  }

  private readOptionalFile(filePath: string): string {
    return existsSync(filePath) ? readFileSync(filePath, 'utf8') : ''
  }

  private readBaseCss(): string {
    const basePath = join(this.themesRoot, BASE_THEME_DIR, 'theme.css')
    if (!existsSync(basePath)) {
      throw new Error(`CSS de base introuvable : ${basePath}`)
    }
    return readFileSync(basePath, 'utf8')
  }
}
