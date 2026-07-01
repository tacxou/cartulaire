# Connecteur LDAP (Python + ldap3 + FastAPI)

Connecteur d'exemple **autonome** (aucune dépendance au SDK Node) : il implémente
lui-même la vérification du contrat signé via `cartulaire_connector.py`.

```bash
cd examples/connectors/ldap-python
pip install -r requirements.txt
CARTULAIRE_CONNECTOR_SECRET="<secret partagé>" \
LDAP_URL="ldaps://ldap.example.local:636" \
LDAP_BIND_DN="cn=cartulaire,ou=services,dc=example,dc=local" \
LDAP_BIND_PASSWORD="…" \
LDAP_BASE_DN="dc=example,dc=local" \
uvicorn connector:app --host 0.0.0.0 --port 8443
```

## Commandes

`identity.resolve`, `auth.verifyPassword` (bind LDAP), `admin.health`.

## À adapter

- `LDAP_USER_FILTER` selon votre schéma (AD : `sAMAccountName`).
- `sub` = `entryUUID` (stable). Ajoutez `identity.getGroups` / `claims.map` au besoin.
- `cartulaire_connector.py` est le mini-SDK : ne le modifiez pas sauf besoin protocolaire.
