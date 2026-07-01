import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import * as nunjucks from 'nunjucks'

/**
 * Rendu SVG inline des icônes Lucide, servies localement (`lucide-static`).
 * Aucune requête réseau côté client — remplace l'ancien composant CDN
 * `iconify-icon` pour respecter le CSP strict (§5, §24.4).
 */
export interface RenderIconOptions {
  class?: string
  width?: number | string
  height?: number | string
  style?: string
}

interface ParsedIcon {
  viewBox: string
  body: string
}

const ICONS_ROOT = join(dirname(require.resolve('lucide-static/package.json')), 'icons')
const iconCache = new Map<string, ParsedIcon>()

function loadIcon(name: string): ParsedIcon {
  const cached = iconCache.get(name)
  if (cached) return cached

  const raw = readFileSync(join(ICONS_ROOT, `${name}.svg`), 'utf8')
  const parsed: ParsedIcon = {
    viewBox: raw.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 24 24',
    body: raw.match(/<svg[^>]*>([\s\S]*)<\/svg>/)?.[1]?.trim() ?? '',
  }
  iconCache.set(name, parsed)
  return parsed
}

/** Global Nunjucks `icon(name, options)` — voir apps/api/src/themes/theme-loader.ts. */
export function renderIcon(name: string, options: RenderIconOptions = {}): nunjucks.runtime.SafeString {
  const { viewBox, body } = loadIcon(name)
  const attrs = [
    'xmlns="http://www.w3.org/2000/svg"',
    `viewBox="${viewBox}"`,
    'fill="none"',
    'stroke="currentColor"',
    'stroke-width="2"',
    'stroke-linecap="round"',
    'stroke-linejoin="round"',
    'aria-hidden="true"',
    'focusable="false"',
  ]
  if (options.width !== undefined) attrs.push(`width="${options.width}"`)
  if (options.height !== undefined) attrs.push(`height="${options.height}"`)
  if (options.class) attrs.push(`class="${options.class}"`)
  if (options.style) attrs.push(`style="${options.style}"`)

  return new nunjucks.runtime.SafeString(`<svg ${attrs.join(' ')}>${body}</svg>`)
}
