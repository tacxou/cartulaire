// @ts-check
/**
 * Connecteur d'exemple Cartulaire — LDAP / Active Directory (Node.js + ldapts).
 *
 * À COPIER ET ADAPTER à votre annuaire. La sécurité du contrat (signature,
 * horodatage, audience, liste blanche) est prise en charge par le SDK ; vous
 * n'écrivez que la logique d'accès LDAP.
 *
 * Lancer :  CARTULAIRE_CONNECTOR_SECRET=... LDAP_URL=ldaps://... node src/index.js
 */
const { Client } = require('ldapts')
const {
  createConnectorServer,
  defineCommand,
  CommandFailure,
  ERROR_CODES,
} = require('@cartulaire/connector-sdk')

// ─── Configuration (à adapter) ──────────────────────────────────────────────
const cfg = {
  audience: process.env.CARTULAIRE_CONNECTOR_AUDIENCE || 'connector.ldap.main',
  secret: process.env.CARTULAIRE_CONNECTOR_SECRET, // partagé avec le daemon
  port: Number(process.env.CARTULAIRE_CONNECTOR_PORT || 8443),

  ldapUrl: process.env.LDAP_URL || 'ldaps://ldap.example.local:636',
  bindDn: process.env.LDAP_BIND_DN || 'cn=cartulaire,ou=services,dc=example,dc=local',
  bindPassword: process.env.LDAP_BIND_PASSWORD || '',
  baseDn: process.env.LDAP_BASE_DN || 'dc=example,dc=local',
  // {{identifier}} est remplacé par l'identifiant fourni ; adaptez à votre schéma.
  userFilter: process.env.LDAP_USER_FILTER || '(&(objectClass=person)(|(uid={{identifier}})(mail={{identifier}})))',
  groupFilter: process.env.LDAP_GROUP_FILTER || '(member={{dn}})',
}

if (!cfg.secret) {
  console.error('CARTULAIRE_CONNECTOR_SECRET est requis.')
  process.exit(1)
}

/** Ouvre une connexion liée (bind service) le temps d'une opération. */
async function withClient(fn) {
  const client = new Client({ url: cfg.ldapUrl })
  try {
    await client.bind(cfg.bindDn, cfg.bindPassword)
    return await fn(client)
  } finally {
    await client.unbind().catch(() => {})
  }
}

const esc = (v) => String(v).replace(/[()\\*\0]/g, (c) => '\\' + c.charCodeAt(0).toString(16))

/** Recherche une entrée utilisateur par identifiant libre. */
async function findUser(client, identifier) {
  const filter = cfg.userFilter.replace(/\{\{identifier\}\}/g, esc(identifier))
  const { searchEntries } = await client.search(cfg.baseDn, { scope: 'sub', filter })
  return searchEntries[0]
}

// ─── Handlers de commandes ──────────────────────────────────────────────────
const commands = [
  defineCommand('identity.resolve', (payload) =>
    withClient(async (client) => {
      const user = await findUser(client, payload.identifier)
      if (!user) {
        throw new CommandFailure(
          ERROR_CODES.IDENTITY_NOT_FOUND,
          `LDAP: no entry for ${payload.identifier}`,
          'Identifiant ou mot de passe invalide.',
        )
      }
      // `sub` doit être STABLE : préférez entryUUID/objectGUID au DN.
      return { sub: String(user.entryUUID || user.dn) }
    }),
  ),

  defineCommand('auth.verifyPassword', (payload) =>
    withClient(async (client) => {
      // On résout le sujet → DN, puis on tente un bind avec le mot de passe fourni.
      // Ici `subject` = entryUUID ; on recherche le DN correspondant.
      const { searchEntries } = await client.search(cfg.baseDn, {
        scope: 'sub',
        filter: `(entryUUID=${esc(payload.subject)})`,
      })
      const dn = searchEntries[0]?.dn
      if (!dn) throw new CommandFailure(ERROR_CODES.INVALID_CREDENTIALS, 'no dn', 'Identifiant ou mot de passe invalide.')

      // Un bind réussi = mot de passe valide. On utilise un client dédié.
      const authClient = new Client({ url: cfg.ldapUrl })
      try {
        await authClient.bind(dn, payload.password)
        return { valid: true, mfaRequired: false }
      } catch {
        throw new CommandFailure(ERROR_CODES.INVALID_CREDENTIALS, 'bind failed', 'Identifiant ou mot de passe invalide.')
      } finally {
        await authClient.unbind().catch(() => {})
      }
    }),
  ),

  defineCommand('identity.getGroups', (payload) =>
    withClient(async (client) => {
      const { searchEntries } = await client.search(cfg.baseDn, {
        scope: 'sub',
        filter: `(entryUUID=${esc(payload.subject)})`,
      })
      const dn = searchEntries[0]?.dn
      if (!dn) return { groups: [] }
      const groups = await client.search(cfg.baseDn, {
        scope: 'sub',
        filter: cfg.groupFilter.replace(/\{\{dn\}\}/g, esc(dn)),
        attributes: ['cn'],
      })
      return { groups: groups.searchEntries.map((g) => String(g.cn)) }
    }),
  ),

  defineCommand('admin.health', () => ({ status: 'ok', connector: 'ldap-node' })),
]

const server = createConnectorServer({
  name: 'ldap-node',
  audience: cfg.audience,
  secret: cfg.secret,
  // Liste blanche : n'exposez que ce dont vous avez besoin (§26.4).
  permissions: ['identity.resolve', 'auth.verifyPassword', 'identity.getGroups', 'admin.health'],
  commands,
})

server.listen(cfg.port, () => console.log(`[ldap-node] écoute :${cfg.port} (audience=${cfg.audience})`))
