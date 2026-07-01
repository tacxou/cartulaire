// @ts-check
/**
 * Connecteur d'exemple Cartulaire — MongoDB (Node.js + Mongoose).
 *
 * Lancer : CARTULAIRE_CONNECTOR_SECRET=... MONGODB_URI=mongodb://… node src/index.js
 */
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const {
  createConnectorServer,
  defineCommand,
  CommandFailure,
  ERROR_CODES,
} = require('@cartulaire/connector-sdk')

const cfg = {
  audience: process.env.CARTULAIRE_CONNECTOR_AUDIENCE || 'connector.mongo.main',
  secret: process.env.CARTULAIRE_CONNECTOR_SECRET,
  port: Number(process.env.CARTULAIRE_CONNECTOR_PORT || 8443),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/cartulaire',
}
if (!cfg.secret) {
  console.error('CARTULAIRE_CONNECTOR_SECRET est requis.')
  process.exit(1)
}

// ─── Schémas (à adapter) ────────────────────────────────────────────────────
const User = mongoose.model(
  'User',
  new mongoose.Schema({
    username: { type: String, index: true },
    email: { type: String, index: true },
    passwordHash: String,
    groups: [String],
    profile: { name: String },
  }),
)
const Consent = mongoose.model(
  'Consent',
  new mongoose.Schema({ subject: String, clientId: String, scopes: [String] }),
)

const commands = [
  defineCommand('identity.resolve', async (payload) => {
    const user = await User.findOne({ $or: [{ username: payload.identifier }, { email: payload.identifier }] })
      .select('_id')
      .lean()
    if (!user) {
      throw new CommandFailure(ERROR_CODES.IDENTITY_NOT_FOUND, 'no user', 'Identifiant ou mot de passe invalide.')
    }
    return { sub: String(user._id) }
  }),

  defineCommand('auth.verifyPassword', async (payload) => {
    const user = await User.findById(payload.subject).select('passwordHash').lean()
    const ok = !!user && (await bcrypt.compare(payload.password, user.passwordHash))
    if (!ok) {
      throw new CommandFailure(ERROR_CODES.INVALID_CREDENTIALS, 'bad password', 'Identifiant ou mot de passe invalide.')
    }
    return { valid: true, mfaRequired: false }
  }),

  defineCommand('claims.map', async (payload) => {
    const user = await User.findById(payload.subject).lean()
    if (!user) throw new CommandFailure(ERROR_CODES.IDENTITY_NOT_FOUND, 'no user', 'Une erreur est survenue.')
    const claims = { sub: String(user._id) }
    if (payload.scopes.includes('profile')) claims.name = user.profile?.name
    if (payload.scopes.includes('email')) claims.email = user.email
    return claims
  }),

  defineCommand('identity.getGroups', async (payload) => {
    const user = await User.findById(payload.subject).select('groups').lean()
    return { groups: user?.groups ?? [] }
  }),

  defineCommand('consent.get', async (payload) => {
    const c = await Consent.findOne({ subject: payload.subject, clientId: payload.clientId }).lean()
    return { scopes: c?.scopes ?? [] }
  }),

  defineCommand('consent.save', async (payload) => {
    await Consent.updateOne(
      { subject: payload.subject, clientId: payload.clientId },
      { $set: { scopes: payload.scopes } },
      { upsert: true },
    )
    return { saved: true }
  }),

  defineCommand('admin.health', () => ({
    status: mongoose.connection.readyState === 1 ? 'ok' : 'degraded',
    connector: 'mongo-node',
  })),
]

async function main() {
  await mongoose.connect(cfg.mongoUri)
  const server = createConnectorServer({
    name: 'mongo-node',
    audience: cfg.audience,
    secret: cfg.secret,
    permissions: [
      'identity.resolve',
      'auth.verifyPassword',
      'claims.map',
      'identity.getGroups',
      'consent.get',
      'consent.save',
      'admin.health',
    ],
    commands,
  })
  server.listen(cfg.port, () => console.log(`[mongo-node] écoute :${cfg.port} (audience=${cfg.audience})`))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
