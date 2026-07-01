# Connecteur MongoDB (Node.js + Mongoose)

Connecteur d'exemple sur MongoDB via **Mongoose** (schémas explicites, typage correct).

## Installer & lancer

```bash
cd examples/connectors/mongo-node
npm install
CARTULAIRE_CONNECTOR_SECRET="<secret partagé>" \
MONGODB_URI="mongodb://localhost:27017/cartulaire" \
node src/index.js
```

## Commandes implémentées

`identity.resolve`, `auth.verifyPassword` (bcrypt), `claims.map`, `identity.getGroups`,
`consent.get`, `consent.save`, `admin.health`.

## À adapter

- Ajustez les schémas `User` / `Consent` à vos collections existantes.
- Le `sub` renvoyé est l'`_id` Mongo — stable par nature.
- Cartulaire ne dépend jamais de Mongoose dans son cœur : ce connecteur est un exemple.
