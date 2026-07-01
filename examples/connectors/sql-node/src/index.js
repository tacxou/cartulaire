// @ts-check
/**
 * Connecteur d'exemple Cartulaire — SQL (Node.js + Kysely, dialecte PostgreSQL).
 *
 * Schéma attendu (à adapter) :
 *   users(id text pk, username text, email text, password_hash text)
 *   user_groups(user_id text, group_name text)
 *   consents(subject text, client_id text, scopes text[])   -- PostgreSQL
 *
 * Lancer : CARTULAIRE_CONNECTOR_SECRET=... DATABASE_URL=postgres://… node src/index.js
 */
const { Kysely, PostgresDialect } = require('kysely')
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')
const {
  createConnectorServer,
  defineCommand,
  CommandFailure,
  ERROR_CODES,
} = require('@cartulaire/connector-sdk')

const cfg = {
  audience: process.env.CARTULAIRE_CONNECTOR_AUDIENCE || 'connector.sql.main',
  secret: process.env.CARTULAIRE_CONNECTOR_SECRET,
  port: Number(process.env.CARTULAIRE_CONNECTOR_PORT || 8443),
  databaseUrl: process.env.DATABASE_URL || 'postgres://cartulaire@localhost:5432/cartulaire',
}
if (!cfg.secret) {
  console.error('CARTULAIRE_CONNECTOR_SECRET est requis.')
  process.exit(1)
}

// Kysely typé faiblement ici pour rester lisible ; typez vos tables en vrai projet.
const db = new Kysely({ dialect: new PostgresDialect({ pool: new Pool({ connectionString: cfg.databaseUrl }) }) })

const commands = [
  defineCommand('identity.resolve', async (payload) => {
    const row = await db
      .selectFrom('users')
      .select(['id'])
      .where((eb) => eb.or([eb('username', '=', payload.identifier), eb('email', '=', payload.identifier)]))
      .executeTakeFirst()
    if (!row) {
      throw new CommandFailure(ERROR_CODES.IDENTITY_NOT_FOUND, 'no user', 'Identifiant ou mot de passe invalide.')
    }
    return { sub: String(row.id) }
  }),

  defineCommand('auth.verifyPassword', async (payload) => {
    const row = await db
      .selectFrom('users')
      .select(['password_hash'])
      .where('id', '=', payload.subject)
      .executeTakeFirst()
    const ok = !!row && (await bcrypt.compare(payload.password, row.password_hash))
    if (!ok) {
      throw new CommandFailure(ERROR_CODES.INVALID_CREDENTIALS, 'bad password', 'Identifiant ou mot de passe invalide.')
    }
    return { valid: true, mfaRequired: false }
  }),

  defineCommand('claims.map', async (payload) => {
    const row = await db
      .selectFrom('users')
      .select(['id', 'username', 'email'])
      .where('id', '=', payload.subject)
      .executeTakeFirst()
    if (!row) throw new CommandFailure(ERROR_CODES.IDENTITY_NOT_FOUND, 'no user', 'Une erreur est survenue.')
    const claims = { sub: String(row.id) }
    if (payload.scopes.includes('profile')) claims.preferred_username = row.username
    if (payload.scopes.includes('email')) claims.email = row.email
    return claims
  }),

  defineCommand('consent.get', async (payload) => {
    const row = await db
      .selectFrom('consents')
      .select(['scopes'])
      .where('subject', '=', payload.subject)
      .where('client_id', '=', payload.clientId)
      .executeTakeFirst()
    return { scopes: row?.scopes ?? [] }
  }),

  defineCommand('consent.save', async (payload) => {
    // UPSERT PostgreSQL ; adaptez pour MySQL/SQLite.
    await db
      .insertInto('consents')
      .values({ subject: payload.subject, client_id: payload.clientId, scopes: payload.scopes })
      .onConflict((oc) => oc.columns(['subject', 'client_id']).doUpdateSet({ scopes: payload.scopes }))
      .execute()
    return { saved: true }
  }),

  defineCommand('admin.health', async () => {
    await db.selectNoFrom((eb) => eb.lit(1).as('ok')).execute()
    return { status: 'ok', connector: 'sql-node' }
  }),
]

const server = createConnectorServer({
  name: 'sql-node',
  audience: cfg.audience,
  secret: cfg.secret,
  permissions: ['identity.resolve', 'auth.verifyPassword', 'claims.map', 'consent.get', 'consent.save', 'admin.health'],
  commands,
})

server.listen(cfg.port, () => console.log(`[sql-node] écoute :${cfg.port} (audience=${cfg.audience})`))
