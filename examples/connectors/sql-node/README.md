# Connecteur SQL (Node.js + Kysely)

Connecteur d'exemple sur base SQL via **Kysely** (dialecte PostgreSQL par défaut).
Kysely est léger, typé et proche du SQL natif — idéal pour maîtriser les requêtes émises.

## Installer & lancer

```bash
cd examples/connectors/sql-node
npm install
CARTULAIRE_CONNECTOR_SECRET="<secret partagé>" \
DATABASE_URL="postgres://cartulaire:pass@localhost:5432/cartulaire" \
node src/index.js
```

## Schéma minimal (à adapter)

```sql
CREATE TABLE users (
  id text PRIMARY KEY, username text UNIQUE, email text UNIQUE, password_hash text
);
CREATE TABLE user_groups (user_id text, group_name text);
CREATE TABLE consents (
  subject text, client_id text, scopes text[], PRIMARY KEY (subject, client_id)
);
```

## Autres dialectes

- **MySQL / MariaDB** : `npm i mysql2` puis `MysqlDialect`. `scopes` en JSON, `onConflict` → `onDuplicateKeyUpdate`.
- **SQLite (dev)** : `npm i better-sqlite3` puis `SqliteDialect`. `scopes` en TEXT JSON.

## Commandes implémentées

`identity.resolve`, `auth.verifyPassword` (bcrypt), `claims.map`, `consent.get`, `consent.save`, `admin.health`.
