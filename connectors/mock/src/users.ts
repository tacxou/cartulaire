/**
 * Base d'utilisateurs de démonstration, en mémoire.
 *
 * Ceci vit dans un connecteur — le SEUL endroit autorisé à détenir des données
 * d'identité (SPEC §10.2). Le cœur Cartulaire ignore totalement ce stockage.
 * Les mots de passe en clair ici ne sont acceptables QUE pour un mock de démo.
 */
export interface MockUser {
  sub: string
  username: string
  email: string
  password: string
  claims: Record<string, unknown>
  groups: string[]
}

export const MOCK_USERS: MockUser[] = [
  {
    sub: 'user_clement',
    username: 'clement',
    email: 'clement@example.com',
    password: 'password123',
    groups: ['admins', 'users'],
    claims: {
      name: 'Clément',
      preferred_username: 'clement',
      email: 'clement@example.com',
      email_verified: true,
    },
  },
  {
    // Utilisateur sans MFA au départ — sert à démontrer l'enrôlement d'une passkey.
    sub: 'user_bob',
    username: 'bob',
    email: 'bob@example.com',
    password: 'bobpass',
    groups: ['users'],
    claims: { name: 'Bob', preferred_username: 'bob', email: 'bob@example.com', email_verified: true },
  },
  {
    sub: 'user_alice',
    username: 'alice',
    email: 'alice@example.com',
    password: 'hunter2',
    groups: ['users'],
    claims: {
      name: 'Alice',
      preferred_username: 'alice',
      email: 'alice@example.com',
      email_verified: true,
    },
  },
]

/** Résout un identifiant libre (username ou email) vers un utilisateur. */
export function findByIdentifier(identifier: string): MockUser | undefined {
  const id = identifier.toLowerCase()
  return MOCK_USERS.find((u) => u.username.toLowerCase() === id || u.email.toLowerCase() === id)
}

export function findBySub(sub: string): MockUser | undefined {
  return MOCK_USERS.find((u) => u.sub === sub)
}

/** Projette les claims d'un utilisateur selon les scopes demandés (§16.4). */
export function mapClaims(user: MockUser, scopes: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { sub: user.sub }
  if (scopes.includes('profile')) {
    out['name'] = user.claims['name']
    out['preferred_username'] = user.claims['preferred_username']
  }
  if (scopes.includes('email')) {
    out['email'] = user.claims['email']
    out['email_verified'] = user.claims['email_verified']
  }
  return out
}
