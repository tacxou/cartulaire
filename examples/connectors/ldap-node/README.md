# Connecteur LDAP (Node.js + ldapts)

Connecteur d'exemple résolvant les identités depuis un annuaire LDAP / Active Directory.

## Installer & lancer

```bash
cd examples/connectors/ldap-node
npm install            # installe ldapts ; @cartulaire/* est résolu depuis le monorepo
CARTULAIRE_CONNECTOR_SECRET="<le même secret que côté daemon>" \
LDAP_URL="ldaps://ldap.example.local:636" \
LDAP_BIND_DN="cn=cartulaire,ou=services,dc=example,dc=local" \
LDAP_BIND_PASSWORD="…" \
LDAP_BASE_DN="dc=example,dc=local" \
node src/index.js
```

Puis, côté daemon, déclarez ce connecteur avec la même `audience`
(`connector.ldap.main` par défaut) et le même secret.

## Commandes implémentées

`identity.resolve`, `auth.verifyPassword` (via bind LDAP), `identity.getGroups`, `admin.health`.

## À adapter

- `LDAP_USER_FILTER` / `LDAP_GROUP_FILTER` selon votre schéma (AD : `sAMAccountName`, etc.).
- Le `sub` renvoyé doit être **stable** (`entryUUID`, `objectGUID`) — pas le DN.
- Ajoutez `identity.getClaims` / `claims.map` si vous voulez projeter des attributs
  LDAP vers des claims OIDC.
