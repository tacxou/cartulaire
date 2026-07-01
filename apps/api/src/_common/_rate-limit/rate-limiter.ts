import type { NextFunction, Request, RequestHandler, Response } from 'express'

/**
 * Rate limiting HTTP (SPEC §37). Limiteur à fenêtre fixe, en mémoire, sans
 * dépendance — adapté au déploiement mono-instance. Le rate limiting distribué
 * (multi-instance) est délégué à un reverse proxy / microservice (§37), cohérent
 * avec le principe de non-rétention d'état du cœur.
 */
export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, { count: number; reset: number }>()

  constructor(
    public readonly windowMs: number,
    public readonly max: number,
  ) {
    const timer = setInterval(() => this.cleanup(), windowMs)
    if (typeof timer.unref === 'function') timer.unref()
  }

  hit(key: string): { allowed: boolean; remaining: number; resetSec: number } {
    const now = Date.now()
    let bucket = this.buckets.get(key)
    if (!bucket || bucket.reset <= now) {
      bucket = { count: 0, reset: now + this.windowMs }
      this.buckets.set(key, bucket)
    }
    bucket.count += 1
    return {
      allowed: bucket.count <= this.max,
      remaining: Math.max(0, this.max - bucket.count),
      resetSec: Math.ceil((bucket.reset - now) / 1000),
    }
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, bucket] of this.buckets) {
      if (bucket.reset <= now) this.buckets.delete(key)
    }
  }
}

/** IP source, en respectant X-Forwarded-For uniquement si le proxy est de confiance (§38). */
export function clientIp(req: Request, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = req.headers['x-forwarded-for']
    const first = Array.isArray(xff) ? xff[0] : (xff ?? '').split(',')[0].trim()
    if (first) return first
  }
  return req.socket?.remoteAddress ?? 'unknown'
}

export interface RateLimitOptions {
  /** Nom logique de la limite (préfixe de clé, headers). */
  name: string
  limiter: FixedWindowRateLimiter
  trustProxy: boolean
  /** Ne limiter que ces méthodes HTTP (défaut : toutes). */
  methods?: string[]
  /** Corps de la réponse 429 : JSON (endpoints API) ou HTML (pages). */
  json?: boolean
}

/**
 * Middleware Express de rate limiting, clé = `name:ip`. Émet les en-têtes
 * `RateLimit-*` et `Retry-After` ; renvoie 429 sans divulguer d'information (§36).
 */
export function rateLimit(opts: RateLimitOptions): RequestHandler {
  const methods = opts.methods?.map((m) => m.toUpperCase())
  return (req: Request, res: Response, next: NextFunction): void => {
    if (methods && !methods.includes(req.method)) return next()

    const key = `${opts.name}:${clientIp(req, opts.trustProxy)}`
    const result = opts.limiter.hit(key)
    res.setHeader('RateLimit-Limit', String(opts.limiter.max))
    res.setHeader('RateLimit-Remaining', String(result.remaining))
    res.setHeader('RateLimit-Reset', String(result.resetSec))

    if (result.allowed) return next()

    res.setHeader('Retry-After', String(result.resetSec))
    if (opts.json) {
      res.status(429).json({ error: 'rate_limited', error_description: 'Trop de requêtes. Réessayez plus tard.' })
    } else {
      res
        .status(429)
        .type('html')
        .send(
          '<!doctype html><meta charset="utf-8"><title>Trop de tentatives</title>' +
            '<p>Trop de tentatives. Veuillez réessayer dans quelques instants.</p>',
        )
    }
  }
}
