import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

/**
 * Signature des commandes en Mode 1 — HTTP interne signé (SPEC §12.1, §26.2).
 *
 * La signature couvre un ensemble canonique de champs liés à l'anti-rejeu :
 * `timestamp . id . type . audience . sha? (body)`. On signe le corps sérialisé
 * exact reçu/émis pour éviter toute divergence de canonicalisation JSON.
 */

export interface CommandSignatureParts {
  /** Corps JSON sérialisé exact de la commande (string envoyée sur le fil). */
  body: string
  /** Horodatage d'émission (epoch ms en string), aligné avec `issuedAt`. */
  timestamp: string
  /** Identifiant unique de la commande (anti-rejeu). */
  id: string
  /** Type de commande. */
  type: string
  /** Audience ciblée (connecteur destinataire). */
  audience: string
}

function canonicalString(parts: CommandSignatureParts): string {
  return [parts.timestamp, parts.id, parts.type, parts.audience, parts.body].join('.')
}

/** Calcule la signature HMAC-SHA256 (hex) d'une commande avec le secret partagé. */
export function signCommand(parts: CommandSignatureParts, secret: string): string {
  return createHmac('sha256', secret).update(canonicalString(parts)).digest('hex')
}

export interface VerifyOptions {
  /** Fenêtre d'acceptation de l'horodatage, en millisecondes. Défaut : 5 s. */
  maxSkewMs?: number
  /** Instant de référence (injectable pour les tests). Défaut : Date.now(). */
  now?: number
}

export interface VerifyResult {
  valid: boolean
  reason?: 'signature_mismatch' | 'timestamp_expired' | 'timestamp_invalid'
}

/**
 * Vérifie la signature ET la fraîcheur de l'horodatage en temps constant.
 * Le daemon/connecteur rejette toute commande dont la signature ou la fenêtre
 * temporelle est invalide, avant toute exécution (§13.4, §26.2).
 */
export function verifyCommandSignature(
  parts: CommandSignatureParts,
  signature: string,
  secret: string,
  options: VerifyOptions = {},
): VerifyResult {
  const { maxSkewMs = 5_000, now = Date.now() } = options

  const ts = Number(parts.timestamp)
  if (!Number.isFinite(ts)) {
    return { valid: false, reason: 'timestamp_invalid' }
  }
  if (Math.abs(now - ts) > maxSkewMs) {
    return { valid: false, reason: 'timestamp_expired' }
  }

  const expected = signCommand(parts, secret)
  if (!constantTimeEquals(expected, signature)) {
    return { valid: false, reason: 'signature_mismatch' }
  }

  return { valid: true }
}

/** Comparaison à temps constant de deux chaînes hex de même schéma. */
export function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) {
    return false
  }
  return timingSafeEqual(bufA, bufB)
}

/** Génère un identifiant de commande unique (préfixé, triable visuellement). */
export function generateCommandId(): string {
  return `cmd_${randomUUID()}`
}

/** Génère un identifiant de trace propagé de bout en bout (§34). */
export function generateTraceId(): string {
  return `trace_${randomUUID()}`
}
