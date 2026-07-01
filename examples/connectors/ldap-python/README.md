# Connecteur LDAP (Python + ldap3)

Connecteur d'exemple utilisant le SDK officiel **`cartulaire-connector-sdk`**
(qui gère signature, horodatage, audience, permissions).

```bash
cd examples/connectors/ldap-python
pip install -r requirements.txt
# dev local depuis le monorepo : pip install -e ../../../packages/connector-sdk-python
CARTULAIRE_CONNECTOR_SECRET="<secret partagé>" \
LDAP_URL="ldaps://ldap.example.local:636" \
LDAP_BIND_DN="cn=cartulaire,ou=services,dc=example,dc=local" \
LDAP_BIND_PASSWORD="…" \
LDAP_BASE_DN="dc=example,dc=local" \
CARTULAIRE_CONNECTOR_PORT=8443 \
python connector.py
```

## Commandes

`identity.resolve`, `auth.verifyPassword` (bind LDAP), `admin.health`.

## À adapter

- `LDAP_USER_FILTER` selon votre schéma (AD : `sAMAccountName`).
- `sub` = `entryUUID` (stable). Ajoutez `identity.getGroups` / `claims.map` au besoin.
