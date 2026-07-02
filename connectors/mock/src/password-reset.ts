import { randomBytes } from 'node:crypto'
import { outbox } from './mfa'
import { findByIdentifier, MOCK_USERS } from './users'

/**
 * Réinitialisation de mot de passe (démo) — jeton à usage unique envoyé par
 * email (boîte d'envoi simulée, comme le lien magique MFA). Le cœur ne doit
 * jamais pouvoir distinguer un identifiant inconnu d'un identifiant valide
 * (SPEC §36.1) : `requestPasswordReset` reste silencieux dans les deux cas.
 */
interface ResetToken {
  sub: string
  expiresAt: number
}
const resetTokens = new Map<string, ResetToken>()

export function requestPasswordReset(identifier: string, linkBase?: string): void {
  const user = findByIdentifier(identifier)
  if (!user) return // anti-énumération — aucune trace observable côté cœur

  const token = randomBytes(24).toString('hex')
  resetTokens.set(token, { sub: user.sub, expiresAt: Date.now() + 30 * 60_000 })
  const link = linkBase ? `${linkBase}?token=${token}` : token
  outbox.push({ channel: 'email', to: user.email, code: token, link }) // « envoi » simulé
}

export function resetPassword(token: string, newPassword: string): boolean {
  const entry = resetTokens.get(token)
  if (!entry || entry.expiresAt < Date.now()) return false

  const user = MOCK_USERS.find((u) => u.sub === entry.sub)
  if (!user) return false

  user.password = newPassword
  resetTokens.delete(token) // usage unique
  return true
}
