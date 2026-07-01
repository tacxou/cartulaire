# Connecteur SQL (Python + SQLAlchemy + FastAPI)

Connecteur d'exemple sur base SQL via **SQLAlchemy Core** (PostgreSQL par défaut),
utilisant le SDK officiel **`cartulaire-connector-sdk`**.

```bash
cd examples/connectors/sql-python
pip install -r requirements.txt
# dev local : pip install -e ../../../packages/connector-sdk-python
CARTULAIRE_CONNECTOR_SECRET="<secret partagé>" \
DATABASE_URL="postgresql+psycopg://cartulaire:pass@localhost:5432/cartulaire" \
CARTULAIRE_CONNECTOR_PORT=8443 \
python connector.py
```

## Schéma minimal

```sql
CREATE TABLE users (id text PRIMARY KEY, username text, email text, password_hash text);
CREATE TABLE consents (subject text, client_id text, scopes text,
                       PRIMARY KEY (subject, client_id));
```

## Commandes

`identity.resolve`, `auth.verifyPassword` (bcrypt), `claims.map`,
`consent.get`, `consent.save`, `admin.health`.

> Pour du très haut débit PostgreSQL, remplacez SQLAlchemy Core par `asyncpg` (§30).
