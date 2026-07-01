import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, RequestHandler, Response } from 'express'

/**
 * Protection CSRF par cookie double-soumission (double-submit cookie).
 *
 * Un jeton aléatoire est déposé dans un cookie (HttpOnly, SameSite=Lax) et
 * réinjecté dans chaque formulaire (`{{ csrfToken }}`). Sur toute méthode non
 * sûre, le champ `_csrf` (ou l'en-tête `x-csrf-token`) doit correspondre au
 * cookie. L'attaquant ne pouvant lire le cookie de la victime (isolation
 * d'origine), il ne peut forger la valeur — sans stockage serveur (§6, §19).
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

export interface CsrfOptions {
  cookieName?: string
  fieldName?: string
  headerName?: string
  /** Marque le cookie `Secure` (production HTTPS uniquement). */
  secure?: boolean
}

export function csrfProtection(opts: CsrfOptions = {}): RequestHandler {
  const cookieName = opts.cookieName ?? 'cartulaire_csrf'
  const fieldName = opts.fieldName ?? '_csrf'
  const headerName = (opts.headerName ?? 'x-csrf-token').toLowerCase()
  const secure = opts.secure ?? false

  return (req: Request, res: Response, next: NextFunction): void => {
    const cookies = parseCookies(req.headers.cookie)
    let token = cookies[cookieName]
    if (!token) {
      token = randomBytes(32).toString('hex')
      res.cookie(cookieName, token, { httpOnly: true, sameSite: 'lax', secure, path: '/' })
    }
    // Exposé aux templates (Express fusionne res.locals dans le contexte de rendu).
    ;(res.locals as Record<string, unknown>)['csrfToken'] = token

    if (SAFE_METHODS.has(req.method)) return next()

    const body = (req.body ?? {}) as Record<string, unknown>
    const provided =
      (typeof body[fieldName] === 'string' ? (body[fieldName] as string) : undefined) ??
      (req.headers[headerName] as string | undefined)

    if (!provided || !safeEqual(provided, token)) {
      const wantsJson =
        String(req.headers['content-type'] ?? '').includes('json') ||
        String(req.headers['accept'] ?? '').includes('json')
      if (wantsJson) {
        res.status(403).json({ error: 'csrf_failed', error_description: 'Jeton de sécurité invalide.' })
      } else {
        res
          .status(403)
          .type('html')
          .send(
            '<!doctype html><meta charset="utf-8"><title>Requête invalide</title>' +
              '<p>Requête invalide (protection CSRF). Rechargez la page et réessayez.</p>',
          )
      }
      return
    }
    next()
  }
}
